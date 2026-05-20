## Mostrar factura de origen en Notas de Crédito

Hoy las NC se identifican con un badge "NC A/B/C" pero no muestran a qué factura corresponden, aunque el dato ya existe en la base (`facturas.factura_origen_id`).

### Cambios

**1. `src/pages/Facturacion.tsx` — listado de Emitidas**
- Ampliar el `select` de la query `facturas-emitidas` para traer la factura origen:
  ```ts
  .select('*, factura_origen:facturas!factura_origen_id(id, punto_venta, numero_comprobante, tipo_comprobante)')
  ```
- En la fila de la tabla, cuando `factura.es_nota_credito === true`, mostrar debajo del número de comprobante (o como sub-línea en la columna "Tipo") un texto pequeño:
  > `Aplica a: Factura A 0007-00000026`
  con click que abra el PDF de esa factura (`/print-invoice?factura_id=...`).
- Si `factura_origen` es null (NC importada de AFIP sin vínculo local), mostrar `Aplica a: —`.

**2. `src/pages/PrintInvoice.tsx` — PDF/impresión**
- Para NC, traer también `factura_origen` y renderizar en el encabezado del comprobante una línea:
  > `Comprobante asociado: Factura {tipo} {PV-Número} — Fecha: dd/MM/yyyy — CAE: …`
- Esto es lo que AFIP espera en el cuerpo de toda NC.

**3. (Opcional, recomendado) `CreditNoteDialog`**
- Verificar que ya guarda `factura_origen_id` (sí lo hace, línea 66). Sin cambios.

### Fuera de alcance
- No se modifica la edge function `arca-factura` (ya envía `CbtesAsoc` a AFIP).
- No se toca el esquema de base — el FK `facturas_factura_origen_id_fkey` ya existe.

¿Procedo?