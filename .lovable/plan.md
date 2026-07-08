## Problema

Al ingresar un DNI (7-8 dígitos) en el diálogo de facturación:
1. No busca en `clientes` (el hook `useCuitLookup` corta antes: solo acepta 11 dígitos con `validateCUIT`).
2. No consulta AFIP (el edge function `arca-consultar-padron` rechaza cualquier valor que no tenga 11 dígitos).
3. El `useEffect` del diálogo tampoco dispara `lookupCuit` si no son 11 dígitos válidos.

## Cambios

### 1. `src/hooks/useCuitLookup.ts` — aceptar DNI
- Cambiar el guard inicial: aceptar tanto CUIT (11 dígitos + `validateCUIT`) como DNI (7-8 dígitos numéricos).
- Buscar en `clientes.dni_cuit` con `.or(...)` cubriendo variantes: valor crudo, con puntos (`12.345.678`), y para CUIT también formateado.
- Buscar en `empresas_terciarizadas.cuit` solo cuando es CUIT (empresas no tienen DNI).
- Fallback AFIP:
  - Si es CUIT (11) → llamar `arca-consultar-padron` como hoy con el CUIT.
  - Si es DNI (7-8) → llamar `arca-consultar-padron` probando los prefijos estándar `20, 23, 24, 27` + DNI + dígito verificador calculado (algoritmo módulo 11 estándar de AFIP). Se detiene en el primer `found:true`. Si ninguno responde, `setMatch(null)`.
- El `CuitMatch` conserva `cuit` como el CUIT resuelto (11 díg. formateado) cuando AFIP lo encuentra a partir del DNI, así el receptor va como CUIT válido a la factura.

### 2. `src/components/invoicing/InvoiceDataDialog.tsx` — disparar lookup con DNI
- Ajustar el `useEffect` (líneas 65-73) para llamar `lookupCuit(cuit)` cuando:
  - `clean.length === 11 && validateCUIT(clean)`, o
  - `clean.length === 7 || clean.length === 8` (DNI).
- Cuando el match viene de AFIP a partir de un DNI y resolvió el CUIT, autocompletar el input con el CUIT formateado (opcional, ya lo hace `nombre/dirección/condición` vía el `useEffect` existente).
- No tocar la lógica de derivación de `tipoDocumento` (11→80, 7-8→96, else→99) ya implementada en la mutación.

### 3. Sin cambios en `arca-consultar-padron`
- El edge function sigue recibiendo CUIT (11 dígitos). Todo el "probar prefijos" ocurre en el cliente y hace hasta 4 llamadas cortadas al primer hit.

## Cómo validarlo
1. Ingresar un CUIT 11 dígitos existente en `clientes` → autocompleta desde DB (badge "Cliente").
2. Ingresar un DNI 8 dígitos existente en `clientes.dni_cuit` → autocompleta desde DB (badge "Cliente").
3. Ingresar un DNI 8 dígitos NO cargado → intenta AFIP con prefijos, si encuentra muestra badge "AFIP" y completa nombre/dirección/condición.
4. Ingresar DNI inválido → sin match, sin error.
5. Emitir factura B a Consumidor Final con DNI → en AFIP debe verse DocTipo=96 y DocNro=DNI (esto ya está en la lógica actual del backend).
