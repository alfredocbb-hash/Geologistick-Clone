## Problema

Cuando se imprime/visualiza una **Nota de Crédito** desde `/print-invoice?factura_id=...`, la vista muestra "FACTURA A/B/C" en lugar de "NOTA DE CRÉDITO A/B/C".

**Causa raíz:** las NC se guardan en la tabla `facturas` con `tipo_comprobante = 'A' | 'B' | 'C'` (la letra) y un flag separado `es_nota_credito = true`. Pero `src/pages/PrintInvoice.tsx` arma el label únicamente a partir de `tipo_comprobante`, sin mirar `es_nota_credito`, por lo que siempre cae en "FACTURA X".

Esto afecta:
- Encabezado grande ("FACTURA A" → debe decir "NOTA DE CRÉDITO A")
- Letra grande del centro (A/B/C) — se mantiene igual
- Código AFIP (`Cod. 01/06/11` → debe ser `03/08/13` para NC)
- Número de comprobante: el `tipoCmpMap` para el QR ya soporta `nota_credito_a/b/c`, pero recibe la letra cruda y termina usando el código de factura. Hay que normalizar antes.
- Nombre del archivo descargado y título del PDF deberían decir "nota-credito-..."

## Cambios

### `src/pages/PrintInvoice.tsx`

1. **Normalizar tipo considerando `es_nota_credito`:**
   En la función / línea donde se calcula `tipoNormalizado`, detectar el flag y mapear a la clave de NC:
   ```ts
   const esNC = !!(factura as any)?.es_nota_credito;
   const letra = normalizarTipoComprobante(factura.tipo_comprobante).replace('factura_', '');
   const tipoNormalizado = factura
     ? (esNC ? `nota_credito_${letra}` : `factura_${letra}`)
     : '';
   ```
   Con esto:
   - `TIPO_COMPROBANTE_LABELS[tipoNormalizado]` ya devuelve "NOTA DE CRÉDITO A/B/C".
   - `tipoCodigo` (el `Cod. 0X` que se imprime junto a la letra) debe ampliarse:
     - `nota_credito_a` → `03`
     - `nota_credito_b` → `08`
     - `nota_credito_c` → `13`

2. **`buildAfipQRUrl`:** ya soporta NC en `tipoCmpMap`. Como ahora `factura.tipo_comprobante` se pasa tal cual (letra), hay que pasarle el `tipoNormalizado` calculado en lugar del campo crudo. Ajustar la firma o construir un objeto temporal `{ ...factura, tipo_comprobante: tipoNormalizado }` al invocarla.

3. **Título y archivo PDF:**
   - Cambiar `<title>` / encabezado del documento generado para usar `tipoLabel` (ya queda "Nota de Crédito ..." automáticamente).
   - En `handleDownloadPDF`, cambiar `fileName` a:
     ```ts
     const prefix = esNC ? 'nota-credito' : 'factura';
     const fileName = `${prefix}-${formatNumeroComprobante(...)}${...}.pdf`;
     ```
   - Toast: `'Nota de Crédito descargada'` cuando `esNC`, sino `'Factura descargada'`.

4. **Referencia a factura origen (opcional, mejora visual):**
   Si `factura.factura_origen_id` existe, mostrar bajo el encabezado una línea pequeña:
   `"Asociada a Factura {tipoOrigen} N° {pv-nro}"`. Requiere fetch adicional de la factura origen por id (un `useQuery` corto). Se puede dejar fuera de este fix si se prefiere mantener el cambio mínimo.

### Validación

- Emitir una NC desde "Facturación → Emitidas → ⋮ → Emitir Nota de Crédito".
- Abrir "Imprimir / Ver PDF" en la NC recién emitida → debe mostrar "NOTA DE CRÉDITO A/B/C" y `Cod. 03/08/13`.
- "Descargar PDF" baja `nota-credito-XXXX-XXXXXXXX.pdf` y el QR de AFIP valida el comprobante como NC.
- Las facturas normales siguen mostrando "FACTURA A/B/C" y `Cod. 01/06/11`.

## Archivos

- `src/pages/PrintInvoice.tsx`

Sin cambios de DB ni de edge functions.
