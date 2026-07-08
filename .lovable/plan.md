# Facturación: autocompletar desde AFIP y corregir Documento del Receptor

## Diagnóstico

**Problema 1 – No trae datos desde AFIP al ingresar CUIT/DNI.**
`InvoiceDataDialog` sólo usa `useCuitLookup`, que busca en `clientes` y `empresas_terciarizadas` locales. Nunca invoca la función `arca-consultar-padron` (que ya existe y funciona con WSAA + Padrón A13). Por eso, para receptores nuevos, no se autocompleta razón social / domicilio / condición IVA.

**Problema 2 – AFIP muestra "99 – Doc. (otro)" y sin número.**
En `supabase/functions/arca-factura/index.ts`:
- Cuando la condición IVA es `consumidor_final`, `IVA_CONDITIONS.consumidor_final.docTipo = 99` y `DocNro = '0'`.
- El fallback `tipoDocumento = rawBody.tipo_documento ?? (receptor?.cuit ? 80 : 99)` asume que cualquier valor en `cuit` es CUIT (80). Si el usuario carga un DNI de 8 dígitos, igual va como 80 y AFIP lo rechaza o el flujo termina enviando 99/0.
- El diálogo nunca envía `tipo_documento` explícito, y no distingue DNI (8 dígitos → DocTipo 96) de CUIT (11 dígitos → DocTipo 80).

Resultado: la factura B a Consumidor Final se emite con DocTipo=99, DocNro=0, aunque el PDF local muestre el CUIT/DNI ingresado.

## Cambios

### 1. `src/hooks/useCuitLookup.ts` – fallback a AFIP
Agregar un paso extra en `lookup(rawCuit)`: si no hay match en `clientes` ni `empresas_terciarizadas`, invocar `supabase.functions.invoke('arca-consultar-padron', { body: { cuit: clean } })` y, si `found: true`, devolver un `CuitMatch` nuevo con `source: 'afip'` que contenga `nombre / razon_social / direccion / condicion_iva / cuit`.

Extender el tipo `CuitMatch['source']` a `'cliente' | 'empresa_terciarizada' | 'afip'`.

### 2. `src/components/invoicing/InvoiceDataDialog.tsx`
- Mostrar el badge "AFIP" cuando `cuitMatch.source === 'afip'`.
- Detectar tipo de documento a partir de la longitud del input:
  - 11 dígitos válidos → `tipoDocumento = 80` (CUIT), enviar formateado.
  - 7–8 dígitos → `tipoDocumento = 96` (DNI), enviar sin formato.
  - vacío → `tipoDocumento = 99`, `DocNro = 0`.
- Enviar `tipo_documento` y el número correcto en el body de `arca-factura`, además del actual `receptor.cuit` / `receptor.dni`:
  - Si es CUIT: `receptor.cuit = "XX-XXXXXXXX-X"`, `receptor.dni = undefined`.
  - Si es DNI: `receptor.cuit = undefined`, `receptor.dni = "XXXXXXXX"`, `tipo_documento = 96`.
- Ajustar el label ("CUIT o DNI") y aceptar el largo variable sin marcar error cuando IVA es Consumidor Final.

### 3. `supabase/functions/arca-factura/index.ts` – fallback robusto
En el bloque que arma `tipoDocumento` (~línea 1588), reemplazar por:

```ts
const rawDoc = (receptor?.cuit || receptor?.dni || '').replace(/\D/g, '');
const inferredDocTipo =
  rawDoc.length === 11 ? 80 :
  (rawDoc.length >= 7 && rawDoc.length <= 8) ? 96 : 99;
const tipoDocumento: number = (rawBody.tipo_documento as number) ?? inferredDocTipo;
```

En `solicitarCAE` (línea 557) ajustar `docNro` para que use `rawDoc` cuando `docTipo !== 99`, y `'0'` cuando sea 99.

Persistir el `tipo_documento` real en el registro de `facturas` (`receptor_tipo_documento` si existe la columna; si no, guardarlo en `arca_response.docTipo`) para trazabilidad.

## Verificación

1. Cargar un CUIT válido no existente en clientes: debe aparecer badge "AFIP" y autocompletarse Razón Social + Domicilio + Condición IVA (llamada real a `arca-consultar-padron`).
2. Emitir Factura B a Consumidor Final con CUIT (11 dígitos) → verificar en AFIP: DocTipo = 80 – CUIT, DocNro = CUIT ingresado.
3. Emitir Factura B a Consumidor Final con DNI (8 dígitos) → DocTipo = 96 – DNI, DocNro = DNI ingresado.
4. Emitir Factura B sin identificar receptor → DocTipo = 99, DocNro = 0.
5. Revisar `supabase/functions/arca-factura` logs: `DocTipo` y `DocNro` deben coincidir con lo mostrado en AFIP.

## Notas técnicas

- La función `arca-consultar-padron` requiere que el certificado del tenant tenga habilitado el servicio `ws_sr_padron_a13` en AFIP. Si no está autorizado, devuelve `error_code: "SERVICE_NOT_AUTHORIZED"`; en ese caso el hook simplemente sigue sin autocompletar y el usuario carga los datos a mano (no se rompe el flujo).
- El fallback por longitud (11 → CUIT, 7–8 → DNI) cubre el 100% de los casos B2C. Casos raros (CDI, LE, LC, Pasaporte) siguen pudiendo pasarse vía `tipo_documento` explícito desde otros formularios (factura manual), sin cambios de contrato.
- No se toca el motor SOAP ni el manejo de CAE / caché WSAA.
