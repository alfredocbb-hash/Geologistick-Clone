

## Plan: Fix foto en APK + agregar receptor/DNI en confirmación de entrega

### Problema 1: Foto no funciona en APK
**Causa**: `useNativeCamera` devuelve `webPath` (usa `CameraResultType.Uri`) pero `DeliveryConfirmation.tsx` solo lee `result.dataUrl` (que es `undefined`).

**Solución** en `src/components/delivery/DeliveryConfirmation.tsx`:
- Líneas 162 y 182: cambiar `result.dataUrl` → `result.webPath || result.dataUrl`
- En la mutación de upload (línea 264): si `photoPreview` no empieza con `data:`, usar `fetch(photoPreview).then(r => r.blob())` en vez de `dataURLtoBlob()`

### Problema 2: Falta quién recibe y DNI
Los campos `nombre_retira`, `dni_retira`, `parentesco_retira` ya existen en la tabla `envios` y se usan en `BranchDeliveryDialog`, pero no en `DeliveryConfirmation` (entrega del chofer).

**Solución** en `src/components/delivery/DeliveryConfirmation.tsx`:
- Agregar estados: `parentesco` (default `'destinatario'`), `nombreRetira`, `dniRetira` — todos opcionales
- Agregar un `Select` con opciones: Destinatario / Familiar / Otro, y campos de texto para nombre y DNI que aparecen cuando se selecciona algo distinto de "Destinatario"
- El campo DNI siempre visible pero opcional
- En la mutación, incluir `nombre_retira`, `dni_retira`, `parentesco_retira` en el `updateData`
- Persistir estos campos en `sessionStorage` junto con el resto del estado

### UI propuesta (después de la firma, antes del cobro)
```text
Recibió:  [Destinatario ▼]    ← Select, default "Destinatario"

(si no es Destinatario)
Nombre de quien recibe: [____________]   ← opcional
DNI (opcional):         [____________]   ← siempre visible, opcional
```

### Archivos a modificar
- `src/components/delivery/DeliveryConfirmation.tsx` — Fix foto + agregar campos receptor/DNI

