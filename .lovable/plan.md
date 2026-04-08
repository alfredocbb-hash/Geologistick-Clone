

## Plan: Mejorar detección de duplicados OCR y recuadro de cámara

### Problemas
1. **Recuadro naranja muy chico** en modo álbum (`inset-10` = 40px cada lado, esquinas `w-8 h-8`)
2. **Duplicados se bloquean al capturar** usando fingerprint de imagen (falsos positivos en cámara nativa). El usuario quiere que se permita capturar todas las fotos y detectar duplicados al procesar, comparando por tracking number, nombre destinatario o dirección
3. **No se puede editar un duplicado** — actualmente se omite silenciosamente. El usuario quiere poder editar en cualquier caso (error o duplicado)

### Cambios en `src/components/mobile/BulkOCRScreen.tsx`

**1. Recuadro más grande** (línea 389):
- `inset-10` → `inset-4`
- Esquinas `w-8 h-8` → `w-12 h-12`

**2. Eliminar chequeo de duplicados al capturar**:
- Quitar llamada `isDuplicate()` de `handleNativeFallback` (línea 170), `captureToAlbum` (línea 187) y `handleFileSelect` (línea 359)
- Se puede eliminar `getFingerprint`, `isDuplicate` y `usedFingerprints` ref

**3. Detección de duplicados al procesar** (`processOnePhoto`, línea 212):
- Después de obtener los datos OCR y antes de insertar, comparar contra envíos ya procesados en esta sesión (`packages` state) por:
  - Mismo `trackingNumber` o `mlShipmentId`
  - Mismo `nombreDestinatario` + misma `direccion`
- Si se detecta duplicado: marcar la foto con status `'duplicate'` (nuevo status) y guardar los datos OCR extraídos en la foto para permitir edición
- NO insertar automáticamente

**4. UI para duplicados**:
- Agregar status `'duplicate'` al tipo `PhotoStatus` (junto a pending/processing/saved/error)
- En la grilla de fotos, mostrar duplicados con badge naranja "Duplicado"
- Botón "Editar" en fotos duplicadas que abra el diálogo de edición manual, pre-llenado con los datos OCR extraídos
- Botón "Guardar igual" para forzar la inserción si el usuario confirma que no es duplicado

### Archivos a modificar
- `src/components/mobile/BulkOCRScreen.tsx` — Todo lo descrito arriba

