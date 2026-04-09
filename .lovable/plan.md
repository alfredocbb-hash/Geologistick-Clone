

## Plan: Fix foto APK + mostrar receptor/DNI en evidencia y EPOD

### Problema 1: Foto no se guarda en APK
**Causa raíz**: `useNativeCamera` usa `CameraResultType.Uri` que devuelve un `webPath` (ej: `capacitor://localhost/...`). Cuando Android recicla el WebView al abrir la cámara, esa URI queda inválida. Además, al persistir en `sessionStorage` se guarda la URI en vez de los datos reales de la imagen.

**Solución** en `src/hooks/useNativeCamera.ts`:
- Cambiar `CameraResultType.Uri` a `CameraResultType.DataUrl` tanto en `takePhoto` como en `pickFromGallery`
- Esto devuelve `result.dataUrl` directamente como base64, que sobrevive reloads del WebView
- Reducir `width` a 800 y `quality` a 40 para mantener tamaño manejable en memoria

**Solución** en `src/components/delivery/DeliveryConfirmation.tsx`:
- En `handleOpenCamera` y `handleOpenGallery`: priorizar `result.dataUrl` sobre `result.webPath` (invertir orden actual en líneas 174 y 195)

### Problema 2: Receptor/DNI no visible en evidencia
Los campos `parentesco_retira`, `nombre_retira`, `dni_retira` se guardan en la DB pero no se muestran.

**Cambio en `src/components/shipments/ShipmentDetailsDialog.tsx`** (tab Evidencia, después del bloque de geolocalización ~línea 800):
- Agregar sección "RECEPTOR DE ENTREGA" que muestre:
  - Parentesco/relación (Destinatario, Familiar, Otro)
  - Nombre de quien recibió (si no es destinatario)
  - DNI (si fue registrado)
- Usar `(envio as any).parentesco_retira`, `(envio as any).nombre_retira`, `(envio as any).dni_retira`

### Problema 3: EPOD sin datos del receptor
**Cambio en `src/lib/generateEPODPDF.ts`**:
- Agregar los campos `parentesco_retira`, `nombre_retira`, `dni_retira` a la interfaz `Envio`
- En la sección "EVIDENCIA DE ENTREGA" (~línea 487), agregar un bloque "Recibido por" que muestre relación, nombre y DNI del receptor

### Archivos a modificar
- `src/hooks/useNativeCamera.ts` — Cambiar a DataUrl para fotos
- `src/components/delivery/DeliveryConfirmation.tsx` — Priorizar dataUrl sobre webPath
- `src/components/shipments/ShipmentDetailsDialog.tsx` — Sección receptor en evidencia
- `src/lib/generateEPODPDF.ts` — Datos receptor en PDF EPOD

