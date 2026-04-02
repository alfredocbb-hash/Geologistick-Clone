

## Plan: Diálogo de elección ML no encontrado + Fix de flujo

### Problema
Cuando se escanea un paquete ML y no se encuentra en el sistema, el comportamiento actual varía según la pantalla:
- **MobileScanTab**: Abre directamente `MLRegisterDialog` (sin opción OCR)
- **CollectScanScreen**: Solo muestra un toast warning sin ninguna acción

El usuario pidió que en ambos casos se ofrezca elegir entre **registro manual** u **OCR**.

### Solución

**1. Crear componente `MLNotFoundChoiceDialog`** — Diálogo reutilizable con dos opciones:
- "Registrar con datos ML" → callback que abre `MLRegisterDialog`
- "Escanear etiqueta (OCR)" → callback que abre `OCRCaptureDialog`

**2. `src/components/mobile/MobileScanTab.tsx`** (línea 176-180):
- En vez de abrir directamente `MLRegisterDialog`, abrir `MLNotFoundChoiceDialog`
- Según la elección del usuario, abrir `MLRegisterDialog` o `OCRCaptureDialog`
- Al completar OCR, crear el envío y cerrar

**3. `src/components/mobile/CollectScanScreen.tsx`** (línea ~50, `handleQRScanned`):
- Cuando `addPackageByTracking` devuelve null para un ML, guardar el `mlShipmentId` pendiente y abrir `MLNotFoundChoiceDialog`
- Al registrar exitosamente (por cualquier vía), agregar el envío a la lista de colecta

### Archivos a crear/modificar
- **Crear**: `src/components/scan/MLNotFoundChoiceDialog.tsx` — AlertDialog con 2 botones
- **Modificar**: `src/components/mobile/MobileScanTab.tsx` — Usar nuevo diálogo de elección
- **Modificar**: `src/components/mobile/CollectScanScreen.tsx` — Usar nuevo diálogo de elección + importar `OCRCaptureDialog`

