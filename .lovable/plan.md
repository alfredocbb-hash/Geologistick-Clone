

## Plan: Fix race condition en auto-confirm OCR (single y continuous mode)

### Problema
El auto-confirm usa `setTimeout(handleConfirmRef.current, 100)` que lee `direccion` del estado React antes de que se actualice, causando "La dirección es obligatoria". Esto afecta tanto el modo single (1 envío) como el modo continuo (varios envíos).

### Solución
Crear una función `confirmWithData(extractedData)` que reciba los datos directamente del OCR sin depender del estado React. Esto elimina la race condition en ambos modos.

### Cambio en `src/components/mobile/OCRCaptureDialog.tsx`

1. **Nueva función `confirmWithData(data)`** — Llama `onConfirm(data)` directamente con los datos extraídos, sin leer el estado React. Maneja tanto `continuousMode` (incrementa contador, resetea campos, vuelve a capture) como single mode (muestra pantalla de éxito).

2. **En `processImage`, cuando `canAutoConfirm`** — Reemplazar el `setTimeout(() => handleConfirmRef.current?.(), 100)` por una llamada directa a `confirmWithData(extracted)`. Sin timeout, sin dependencia de estado.

3. **Mantener `handleConfirm` intacto** — Sigue funcionando para edición manual (cuando el usuario corrige campos y presiona "Confirmar").

```text
processImage
  ├─ canAutoConfirm? → confirmWithData(extracted) → continuousMode? → reset+capture / success
  └─ else → setStep('confirm') → usuario edita → handleConfirm() → lee estado
```

### Archivos a modificar
- `src/components/mobile/OCRCaptureDialog.tsx`

