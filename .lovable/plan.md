

## Fix: Mostrar opción OCR cuando falla el registro ML

### Problema
Cuando el chofer escanea un envío ML no registrado, se abre el `MLRegisterDialog`. Si el registro falla (seller no autorizado, 401/403), el diálogo muestra un error pero no ofrece alternativa. El usuario tiene que cerrar el diálogo manualmente y recién ahí se activa el OCR — pero eso no es intuitivo ni claro.

### Solución
Dos cambios coordinados:

**1. `MLRegisterDialog` — agregar prop `onFallbackOCR` y botón OCR en estado de error**

- Nueva prop opcional: `onFallbackOCR?: () => void`
- Cuando hay un error Y `onFallbackOCR` está definido, mostrar un botón "📷 Usar OCR (foto etiqueta)" debajo del alert de error
- Al tocarlo, llama `onFallbackOCR()` (que cerrará el diálogo y abrirá el OCR)

```tsx
{error && onFallbackOCR && (
  <Button variant="outline" onClick={onFallbackOCR} className="w-full gap-2">
    <Camera className="h-4 w-4" />
    Usar OCR (foto de etiqueta)
  </Button>
)}
```

**2. `FlexMixtoScreen` — pasar `onFallbackOCR` al diálogo**

- Agregar handler `handleFallbackOCR` que cierra el `MLRegisterDialog`, guarda el `pendingMLShipmentId`, y abre `showOCRCapture`
- Pasar este handler como `onFallbackOCR` prop al `MLRegisterDialog`

```tsx
const handleFallbackOCR = useCallback(() => {
  setMlRegisterData(null);
  setShowOCRCapture(true);
}, []);
```

### Archivos a modificar
- `src/components/scan/MLRegisterDialog.tsx` — agregar prop y botón OCR
- `src/components/mobile/FlexMixtoScreen.tsx` — pasar el handler

### Resultado
El chofer verá: intenta registrar → falla → aparece botón "Usar OCR" en el mismo diálogo → toca → se abre la cámara OCR.

