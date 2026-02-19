
# Corrección de emisión de facturas ARCA: número de comprobante + DocNro Consumidor Final

## Diagnóstico de los dos bugs

### Bug 1: Número de comprobante desincronizado (error principal)
El sistema tiene en la tabla `arca_config` el campo `ultimo_numero_b = 4`, por lo que intenta emitir el comprobante número `5`. Sin embargo, AFIP en el punto de venta 7 tiene registrado un número diferente (probablemente ya existe un comprobante emitido directamente desde otro software o portal ARCA que no pasó por este sistema).

**Error de AFIP:** `El numero de comprobante no se corresponde con el proximo a autorizar. Consultar metodo FECompUltimoAutorizado`

**Solución:** Antes de emitir el comprobante, llamar al método `FECompUltimoAutorizado` del WSFEv1 para obtener el último número que tiene AFIP, y usar ese valor +1 como número del próximo comprobante. Si AFIP devuelve un número mayor al que tiene el sistema, también se actualiza `arca_config` para mantener sincronía.

### Bug 2: DocNro incorrecto para Consumidor Final
El código actual en `solicitarCAE()`:
```typescript
const docNro = receptor.cuit
  ? receptor.cuit.replace(/[-]/g, '')
  : (receptor.dni || '0');
```
Esto envía el DNI `35498740` → que AFIP transforma a `20354987407` (prefijado) → pero para Factura B menor a $10M con DocTipo=99 (Consumidor Final), AFIP exige que DocNro sea `0`.

**Error de AFIP:** `Para facturas B (CbteDesde igual a CbteHasta) menor a $10000000, si DocTipo = 99 DocNro debe ser igual a 0`

**Solución:** Cuando `docTipo === 99` (Consumidor Final), siempre enviar `DocNro = 0` sin importar qué DNI haya ingresado el usuario. El DNI se guarda igualmente en la tabla `facturas` para referencia interna.

## Cambios en `supabase/functions/arca-factura/index.ts`

### Cambio 1: Agregar función `FECompUltimoAutorizado`
Nueva función que consulta a AFIP el último número emitido por tipo de comprobante y punto de venta:

```typescript
async function getUltimoComprobanteAFIP(
  token: string, sign: string, cuit: string,
  puntoVenta: number, tipoComprobante: 'A' | 'B' | 'C',
  wsfeUrl: string
): Promise<number> {
  const tipoCode = INVOICE_CODES[tipoComprobante].factura;
  // SOAP call to FECompUltimoAutorizado
  // Returns CbteNro – the last authorized invoice number
  // Returns 0 if no invoices have been issued yet
}
```

### Cambio 2: Usar `FECompUltimoAutorizado` en el flujo principal
En la función `getNextInvoiceNumber`, en lugar de solo leer `arca_config`, se llama primero a AFIP y se toma el mayor entre el valor local y el de AFIP:

```typescript
async function getNextInvoiceNumber(...): Promise<number> {
  const localNumber = (data[field] || 0);
  const afipNumber = await getUltimoComprobanteAFIP(token, sign, cuit, puntoVenta, tipo, wsfeUrl);
  return Math.max(localNumber, afipNumber) + 1;
}
```

Esto requiere pasar token/sign/cuit/wsfeUrl al helper, por lo que se refactoriza la firma de `getNextInvoiceNumber` para recibirlos, o se hace la consulta directamente en el flujo principal antes de llamar a `solicitarCAE`.

### Cambio 3: DocNro = 0 para Consumidor Final (DocTipo=99)
```typescript
const docTipo = ivaCondition.docTipo;
// RG AFIP: cuando DocTipo = 99 (Consumidor Final), DocNro DEBE ser 0
// para comprobantes B < $10M
const docNro = docTipo === 99
  ? '0'
  : (receptor.cuit?.replace(/[-]/g, '') || receptor.dni || '0');
```

### Cambio 4: También guardar el DNI en `receptor_cuit` en la tabla `facturas`
El campo `receptor_cuit` ya almacena el DNI para referencia interna aunque AFIP reciba `0`. Esto ya funciona bien actualmente dado que `receptor_cuit` se setea desde `receptor.cuit || receptor.dni` antes de la llamada a AFIP.

## Flujo del `serve()` después del cambio

```
1. getWSAAToken() → token, sign
2. getUltimoComprobanteAFIP(token, sign, cuit, puntoVenta, tipo, wsfeUrl)
   → afipLastNumber (ej: 6)
3. localNumber = arca_config.ultimo_numero_b (ej: 4)
4. numeroComprobante = max(localNumber, afipLastNumber) + 1 = 7
5. updateInvoiceNumber(7) en arca_config
6. solicitarCAE(..., numeroComprobante=7, ...) con DocNro=0 si DocTipo=99
```

## Archivo a modificar

| Archivo | Cambios |
|---|---|
| `supabase/functions/arca-factura/index.ts` | 1) Nueva función `getUltimoComprobanteAFIP` SOAP call; 2) Consultar AFIP antes de emitir para obtener número correcto; 3) Corregir DocNro=0 para Consumidor Final |

## Resultado esperado

- La factura se emite correctamente usando el número que AFIP espera
- Consumidor Final ya no genera error por DocNro
- El sistema siempre se sincroniza con AFIP antes de cada emisión, incluso si se emitieron comprobantes por fuera del sistema
