
## Fix: OCR crea envío pero el usuario no ve confirmación

### Causa raíz

Hay **dos bugs** en el flujo OCR:

**Bug 1 — ScanQR.tsx cierra el diálogo antes de mostrar el éxito**: El `onConfirm` del OCRCaptureDialog en `ScanQR.tsx` (línea 798) ejecuta `setShowOCRCapture(false)` inmediatamente después del insert, lo que cierra el diálogo ANTES de que pueda transicionar al paso de éxito. Además no devuelve el tracking number.

**Bug 2 — ScanQR.tsx no envía todos los campos**: Falta `sucursal_origen_id`, `sucursal_entrega_id`, `notas` (referencia) y `barrio` en el insert del envío.

El flujo en `MobileScanTab.tsx` está correcto (devuelve tracking y no cierra el diálogo), pero el de `ScanQR.tsx` no.

### Cambios

**1. `src/pages/ScanQR.tsx`** — Corregir el `onConfirm` del OCRCaptureDialog:
- Agregar `sucursal_id` al query de profiles
- Agregar `sucursal_origen_id`, `sucursal_entrega_id`, `notas`, `source_module` al insert
- **Eliminar** `setShowOCRCapture(false)` y `setPendingOCRShipmentId(null)` del handler — dejar que el diálogo maneje su propio cierre vía el paso de éxito
- **Retornar** el `trackingNumber` para que se muestre en la pantalla de éxito

### Archivos a modificar
- `src/pages/ScanQR.tsx` (solo el bloque `onConfirm` del OCRCaptureDialog)
