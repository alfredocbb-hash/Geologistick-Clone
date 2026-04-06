

## Plan: Detección de imágenes duplicadas en BulkOCRScreen

### Problema
Cuando se cargan fotos iguales (mismo archivo seleccionado dos veces, o misma captura), el sistema las procesa todas y crea envíos duplicados.

### Solución
Generar un hash simple del contenido de cada imagen (usando los primeros N caracteres del dataUrl como fingerprint) y comparar contra las fotos ya cargadas. Si ya existe, mostrar un toast de aviso y no agregarla.

### Cambios en `src/components/mobile/BulkOCRScreen.tsx`

1. **Crear función de fingerprint**: Extraer una porción representativa del dataUrl (ej: substring de 100 chars desde posición 200) como identificador único de la imagen. Esto es suficiente para detectar archivos idénticos sin overhead de hashing criptográfico.

2. **Mantener un Set de fingerprints**: Nuevo estado `usedFingerprints` (Set) que acumula los fingerprints de todas las fotos ya en `albumPhotos`.

3. **Validar en `handleFileSelect`** (desktop): Antes de agregar cada foto, verificar si el fingerprint ya existe. Si es duplicada, mostrar `toast.warning("Imagen ya cargada, se omitió")` y no agregarla.

4. **Validar en `captureToAlbum`** (móvil cámara): Misma verificación tras capturar.

5. **Validar en `handleNativeFallback`** (móvil nativa): Misma verificación.

6. **Limpiar fingerprints en `removePhoto`**: Al eliminar una foto, remover su fingerprint del Set para permitir re-cargarla si el usuario lo desea.

### Archivos a modificar
- `src/components/mobile/BulkOCRScreen.tsx` — Agregar fingerprint Set + validación en los 3 puntos de ingreso de fotos

