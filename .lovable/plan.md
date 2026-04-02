

## Fix: Error handling en registro ML y bugs en OCR fallback

### Problema 1: Error genérico al registrar
`supabase.functions.invoke` devuelve `FunctionsHttpError` con mensaje genérico ("Edge Function returned a non-2xx status code"). El error real del backend (ej: "Invalid caller.id: 293662607") se pierde porque no se lee `error.context.json()`. Esto hace que el usuario vea un mensaje inútil.

### Problema 2: Query de perfil usa columna incorrecta
En los handlers de OCR confirm de `ScanQR.tsx` y `MobileScanTab.tsx`, la query `profiles` usa `.eq('id', user!.id)` pero la columna correcta es `user_id`. Esto causa que `tenant_id` sea `null` y el envío falle al insertarse.

### Cambios

**1. `src/components/scan/MLRegisterDialog.tsx`** — Mejorar error handling
```tsx
// Reemplazar el bloque try/catch de handleRegister para leer el body real del error:
const { data, error: fnError } = await supabase.functions.invoke(...);

if (fnError) {
  // Leer el mensaje real del edge function
  let errorMessage = 'Error al registrar envío';
  try {
    const errorBody = await fnError.context?.json?.();
    if (errorBody?.error) errorMessage = errorBody.error;
  } catch {
    errorMessage = fnError.message || errorMessage;
  }
  throw new Error(errorMessage);
}
```

**2. `src/pages/ScanQR.tsx`** — Fix query de perfil
- Cambiar `.eq('id', user!.id)` → `.eq('user_id', user!.id)` en el handler `onConfirm` del `OCRCaptureDialog`

**3. `src/components/mobile/MobileScanTab.tsx`** — Mismo fix
- Cambiar `.eq('id', user!.id)` → `.eq('user_id', user!.id)` en el handler `onConfirm` del `OCRCaptureDialog`

### Resultado
- El usuario verá el mensaje de error real ("Error al obtener envío de MercadoLibre: 401") en lugar del genérico
- El botón "Usar OCR" aparecerá correctamente después del error (ya funciona, pero ahora con mejor contexto)
- El flujo OCR podrá crear envíos correctamente al tener el `tenant_id` correcto

### Archivos a modificar
- `src/components/scan/MLRegisterDialog.tsx`
- `src/pages/ScanQR.tsx`
- `src/components/mobile/MobileScanTab.tsx`

