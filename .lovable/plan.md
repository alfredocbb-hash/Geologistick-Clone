## Objetivo

En el flujo de etiqueta interna (`/print-label`), al generar o imprimir, producir **un único PDF** que contenga:
1. La(s) etiqueta(s) actuales (100x150mm o A4 con 4 por hoja).
2. A continuación, el **comprobante de envío** completo (el mismo que hoy genera `generateShipmentReceiptPDF`).

Así, con un solo clic, el operador imprime etiqueta + comprobante juntos en la misma pestaña.

## Cambios

### 1. `src/lib/generateShipmentReceiptPDF.ts`
- Extraer la lógica de dibujo a una función reutilizable `drawShipmentReceipt(doc, shipment, options?, startNewPage = true)` que recibe un `jsPDF` existente y dibuja el comprobante en una página A4 (agregando `doc.addPage('a4','portrait')` si `startNewPage`).
- Mantener `generateShipmentReceiptPDF(...)` como wrapper que crea un nuevo `jsPDF` A4, llama a `drawShipmentReceipt(doc, ..., false)` (primera página), y hace `doc.save(...)`. No rompe llamadas existentes (`PrintReceipt.tsx`).

### 2. `src/pages/PrintLabel.tsx`
- En `handlePrint` y `handleDirectPrint`, después de `generateLabelPdf(...)`:
  - Cargar los datos necesarios del comprobante (mismo `envio` ya consultado; si el comprobante necesita relaciones extra como `tenant_branding`, reutilizar las que ya trae el query o ampliarlo).
  - Llamar `await drawShipmentReceipt(doc, envio, opts, true)` para anexar el comprobante como página(s) adicional(es).
  - Mantener `doc.save(\`etiqueta-comprobante-${tracking}.pdf\`)` o `doc.autoPrint()` + `window.open(bloburl)`.
- Actualizar el copy del header: subtítulo "Etiqueta + comprobante de envío" y textos de botones ("Imprimir etiqueta y comprobante" / "Generar PDF (etiqueta + comprobante)").

### 3. Compatibilidad
- `PrintReceipt.tsx` sigue funcionando igual (usa el wrapper).
- No se tocan `ShipmentDetailsDialog`, rutas, ni `NewShipment` — siguen navegando a `/print-label?id=...`, pero ahora ese PDF ya incluye el comprobante.

## Consideraciones técnicas
- El comprobante actual ya es A4 portrait con jsPDF, así que se agrega vía `doc.addPage([210,297],'portrait')` independientemente de si la etiqueta fue 100x150mm o A4 — jsPDF acepta tamaño por página.
- Si `generateShipmentReceiptPDF` requiere datos adicionales (logo, sucursal, etc.), revisar y ampliar el `select` del query de `PrintLabel` para no hacer un segundo round-trip.
- Manejo de errores: si la carga del comprobante falla, igual entregar el PDF con solo etiquetas y mostrar un toast de warning.

## Fuera de alcance
- Etiqueta ML (MercadoLibre): no se modifica.
- Página `/print-receipt`: queda como acceso directo al comprobante solo.
