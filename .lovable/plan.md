

## Plan: Ocultar menú con cámara + Acelerar procesamiento + Fix modo ráfaga

### Problema 1: Menú inferior visible con cámara abierta
El `MobileBottomNav` (z-50) se mantiene visible debajo de los overlays de cámara. Aunque los overlays tienen z-index mayor, en algunos dispositivos Android el nav puede asomarse o causar interacciones fantasma. Se necesita ocultarlo explícitamente.

### Problema 2: Procesamiento lento para 50+ imágenes
Actualmente las imágenes se procesan **secuencialmente** (una por una). Con 50 imágenes a ~3-5 segundos cada una, son ~3-4 minutos de espera.

### Problema 3: Modo ráfaga no funciona
El modo ráfaga abre `OCRCaptureDialog` (z-[10000]) que ocupa toda la pantalla con sus controles de cámara en la parte inferior. El panel flotante de acciones (PLANIFICAR/LISTO, z-[10002]) queda superpuesto debajo de los botones de captura del dialog. El usuario no puede ver ni interactuar con los botones de acción.

---

### Solución

**`src/components/mobile/MobileAppLayout.tsx`** — Context para ocultar bottom nav:
- Crear un estado `isCameraActive` y pasarlo como prop a `MobileBottomNav`
- Exponer `setCameraActive` via un React Context (`MobileCameraContext`)
- En `MobileBottomNav`, si `isCameraActive === true`, no renderizar nada (return null)

**`src/components/mobile/MobileBottomNav.tsx`** — Aceptar prop `hidden`:
- Nuevo prop `hidden?: boolean`
- Si `hidden` es `true`, retornar `null`

**`src/components/mobile/BulkOCRScreen.tsx`** — Ocultar nav + procesamiento paralelo + fix ráfaga:
- Consumir `MobileCameraContext` y llamar `setCameraActive(true)` al montar, `false` al desmontar
- **Procesamiento paralelo**: Cambiar el loop secuencial de `processAlbum` para procesar en lotes de 3 imágenes concurrentes usando `Promise.all` con chunks
- **Fix modo ráfaga**: No usar `OCRCaptureDialog` como componente separado. En su lugar, integrar la cámara directamente en el modo ráfaga (reusar la misma vista de cámara del modo álbum) con el panel de acciones visible debajo. Cada foto capturada se procesa en background via `ocr-label` y el contador se actualiza en tiempo real.

**`src/components/mobile/FlexMixtoScreen.tsx`** — Ocultar nav al abrir scanner/OCR:
- Consumir `MobileCameraContext` para activarlo cuando se abre `showScanner`, `showOCRCapture`, o `showBulkOCR`

**`src/components/mobile/OCRCaptureDialog.tsx`** — Ocultar nav:
- Consumir `MobileCameraContext` al abrir

### Procesamiento paralelo (detalle técnico)

```text
Antes:  foto1 → foto2 → foto3 → ... → foto50  (secuencial ~4 min)
Después: [foto1, foto2, foto3] → [foto4, foto5, foto6] → ...  (paralelo ~1.5 min)
```

Se divide `photosToProcess` en chunks de 3 y se procesan con `Promise.allSettled`.

### Modo ráfaga corregido

```text
┌─────────────────────────┐
│     CÁMARA (video)      │
│                         │
│   [guías de encuadre]   │
│                         │
├─────────────────────────┤
│  📦 5 guardados         │
│  ⏳ Procesando 2        │
│ [  📸 CAPTURAR  ]       │
│ [PLANIFICAR] [LISTO]    │
└─────────────────────────┘
```

En vez de abrir `OCRCaptureDialog` por separado, el modo ráfaga usa su propia vista de cámara integrada con los controles y el panel de acción en una sola pantalla.

### Archivos a modificar
- `src/components/mobile/MobileAppLayout.tsx` — Crear `MobileCameraContext`, estado `isCameraActive`, pasarlo al nav
- `src/components/mobile/MobileBottomNav.tsx` — Prop `hidden`, return null si es true
- `src/components/mobile/BulkOCRScreen.tsx` — Consumir context, procesamiento paralelo, integrar cámara en ráfaga
- `src/components/mobile/FlexMixtoScreen.tsx` — Consumir context al abrir cámara
- `src/components/mobile/OCRCaptureDialog.tsx` — Consumir context al abrir

