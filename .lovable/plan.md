

## Plan: Sub-menú OCR con opción masiva

### Problema
Cuando el usuario elige "Escanear etiqueta (OCR)" en el diálogo de ML no encontrado, va directo al OCR individual. El usuario quiere que se le pregunte si desea modo individual o masivo (álbum).

### Solución

**Modificar `src/components/scan/MLNotFoundChoiceDialog.tsx`**:
- Agregar un callback `onChooseBulkOCR` a las props
- Cuando el usuario toca "Escanear etiqueta (OCR)", en vez de llamar `onChooseOCR` directamente, mostrar un segundo paso dentro del mismo diálogo con dos opciones:
  - **"Una etiqueta"** → llama `onChooseOCR` (flujo actual, OCRCaptureDialog individual)
  - **"Modo masivo (álbum)"** → llama `onChooseBulkOCR` (abre BulkOCRScreen)
- Usar un estado interno `step: 'choice' | 'ocr-mode'` para manejar la transición

**Modificar `src/components/mobile/MobileScanTab.tsx`**:
- Agregar handler `onChooseBulkOCR` que navega a la pantalla de OCR masivo (BulkOCRScreen) o la abre inline
- Pasar el nuevo callback al `MLNotFoundChoiceDialog`

**Modificar `src/components/mobile/CollectScanScreen.tsx`**:
- Mismo patrón: agregar handler `onChooseBulkOCR` que activa el `BulkOCRScreen` desde la colecta
- Pasar el callback al diálogo

### Archivos a modificar
- `src/components/scan/MLNotFoundChoiceDialog.tsx` — Agregar paso intermedio con opción individual/masivo
- `src/components/mobile/MobileScanTab.tsx` — Conectar callback de OCR masivo
- `src/components/mobile/CollectScanScreen.tsx` — Conectar callback de OCR masivo

