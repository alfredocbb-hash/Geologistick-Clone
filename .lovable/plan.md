

## Respuestas y Plan de Mejora

### Pregunta 1: Cómo acelerar el escaneo masivo OCR

**Situación actual:** Cada foto requiere: abrir cámara → sacar foto → esperar OCR (IA) → confirmar/auto-confirmar → repetir. El cuello de botella es la llamada a la Edge Function `ocr-label` (~3-5 segundos por imagen).

**Mejoras propuestas:**

1. **Pipeline paralelo en modo masivo**: Mientras la IA procesa la foto actual, permitir sacar la siguiente foto inmediatamente. Esto se logra enviando la imagen al OCR en background y dejando la cámara lista para la próxima captura sin esperar el resultado.

2. **Cola de procesamiento visual**: Mostrar una lista en tiempo real con estados: "procesando...", "guardado OK", "error — revisar", para que el operador vea el progreso sin bloquear la cámara.

3. **Captura rápida (tap-to-snap)**: En modo masivo, la cámara queda siempre abierta. Un solo tap toma la foto, la manda al OCR, y la cámara vuelve al viewfinder automáticamente sin transiciones.

### Pregunta 2: Flujo posterior — del OCR al planificador

**Flujo actual ya funcional:**

```text
OCR crea envío (estado: pendiente, sucursal_origen = tu sucursal)
  │
  ├─ Opción A: Planificador de Rutas (/route-planner)
  │   → Los envíos "pendiente" de tu sucursal ya aparecen ahí
  │   → Seleccionás envíos → Optimizás ruta → Asignás chofer → Iniciar
  │
  ├─ Opción B: Flex Scan / Flex Mixto
  │   → Escaneás los mismos paquetes con QR → Se acumulan → "Iniciar Reparto"
  │
  └─ Opción C: Asignación manual (Routes page)
      → Admin ve envíos sin chofer → Los asigna
```

**Problema:** Después de terminar el OCR masivo, no hay un botón directo para ir al planificador con esos envíos.

**Mejora propuesta:** Agregar un botón "Ir al Planificador" al finalizar el escaneo masivo en `BulkOCRScreen`, que navegue a `/route-planner` con los IDs de los envíos recién creados como parámetro URL, pre-seleccionándolos.

---

### Cambios técnicos

**Fase 1 — Pipeline paralelo (cámara no-bloqueante)**

**`src/components/mobile/OCRCaptureDialog.tsx`**:
- En `continuousMode`, al tomar la foto, enviar `processImage` como fire-and-forget y volver inmediatamente al paso `capture` (viewfinder listo).
- Agregar un estado `queueCount` (procesando en background) que se muestra como badge.
- Si la auto-confirmación falla, acumular en una lista de "pendientes de revisión" en vez de bloquear.

**`src/components/mobile/BulkOCRScreen.tsx`**:
- Recibir callbacks de éxito/error del pipeline y actualizar la lista en tiempo real.
- Agregar botón "Planificar Ruta" al finalizar, que navega a `/route-planner?envio_ids=id1,id2,...`.

**Fase 2 — Botón "Planificar" post-escaneo**

**`src/components/mobile/BulkOCRScreen.tsx`**:
- Al presionar "LISTO", mostrar dos opciones: "Finalizar" y "Planificar Ruta" que navega al planificador con los envíos pre-cargados.

### Archivos a modificar
- `src/components/mobile/OCRCaptureDialog.tsx` — Pipeline paralelo en modo continuo
- `src/components/mobile/BulkOCRScreen.tsx` — Cola visual + botón "Planificar Ruta"

