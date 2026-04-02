

## Plan: Modo "Álbum primero, procesar después" para OCR Masivo

### Concepto
El usuario toma todas las fotos que necesite de forma rápida (se almacenan localmente como thumbnails en memoria). Al terminar, presiona "Procesar todo" y el sistema envía todas las fotos a la IA en paralelo, mostrando el progreso en tiempo real.

### Flujo UX

```text
[TOMAR FOTOS]          [ÁLBUM LOCAL]              [PROCESAMIENTO]
  Cámara rápida  →  Grid de thumbnails      →   Cola paralela
  tap-tap-tap        (10, 50, 100+ fotos)        Progress bar global
  sin esperas        Eliminar individualmente    Cada foto → OCR → auto-save
                     "PROCESAR TODO (47)"        Errores marcados en rojo
                                                 Al terminar → Planificar Ruta
```

### Cambios técnicos

**`src/components/mobile/BulkOCRScreen.tsx`** — Refactor principal:
- Agregar nuevo estado `albumMode` con dos fases: `capturing` y `processing`
- **Fase 1 (Capturing)**: Botón de cámara abre `<input type="file" capture="environment">` o cámara nativa. Cada foto se guarda como data URL en un array `photoAlbum: { id, dataUrl, thumbnail }[]`. Se muestra un grid de miniaturas con botón de eliminar individual. Botón grande "PROCESAR TODO (N)".
- **Fase 2 (Processing)**: Al presionar "Procesar todo", iterar sobre las fotos en lotes de 3-4 en paralelo (para no saturar la Edge Function). Cada foto pasa por `ocr-label` → auto-confirm → insert en `envios`. Progress bar global (X de N). Las que fallan quedan marcadas en rojo con opción de reintentar.
- Mantener el modo actual (ráfaga + cola) como opción alternativa.

**`src/components/mobile/BulkOCRScreen.tsx`** — UI del álbum:
- Grid responsive de thumbnails (3 columnas en móvil)
- Contador grande visible "47 fotos"
- Botón flotante de cámara para seguir tomando
- Progress bar durante procesamiento con "12 de 47 procesados · 2 errores"
- Al finalizar: mismos botones actuales (Planificar Ruta / Finalizar)

**Selector de modo al entrar**:
- Al abrir BulkOCRScreen, mostrar dos opciones: "Ráfaga (procesa al vuelo)" vs "Álbum (fotos primero, procesar después)"
- Guardar preferencia en localStorage

### Archivos a modificar
- `src/components/mobile/BulkOCRScreen.tsx` — Agregar modo álbum con grid, captura rápida, y procesamiento batch

