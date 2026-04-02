

## Plan: Mejorar parser OCR para etiquetas ML + Pantalla de éxito

### Contexto
Las etiquetas de MercadoLibre tienen un formato con campos etiquetados: `Envio: 46236169153`, `Dirección: ...`, `CP: ...`, `Localidad: ...`, `Destinatario: ...`, `Barrio: ...`, `Referencia: ...`, `Entrega: ...`. El parser actual no extrae el número de envío ni usa los labels de ML. Además, después de confirmar no hay feedback claro de que el envío se creó.

### Cambios

**1. `src/lib/ocrParser.ts` — Agregar campo `mlShipmentId` + mejorar patrones**
- Agregar `mlShipmentId: string | null` y `referencia: string | null` y `barrio: string | null` al interface `OCRExtractedData`
- Nueva función `extractMLShipmentId`: buscar patrones `Envio\s*:?\s*(\d{8,12})`, `Env[ií]o\s*#?\s*(\d+)`, `N°?\s*envio\s*:?\s*(\d+)`
- Nueva función `extractReferencia`: buscar `Referencia\s*:?\s*(.+)`
- Nueva función `extractBarrio`: buscar `Barrio\s*:?\s*(.+)`, `Partido\s*:?\s*(.+)`
- Mejorar `extractAddress`: agregar patrón keyword `Direcci[oó]n\s*:?\s*(.+)` con mayor prioridad (ya existe como fallback, moverlo primero)
- Mejorar `extractLocality`: agregar `Barrio` como keyword alternativo
- Mejorar `extractPostalCode`: agregar patrón `Cp\s*:?\s*(\d{4})` (ML usa "Cp" minúscula)
- Mejorar `extractRecipientName`: agregar `Dest\.?\s*:?\s*(.+)` como patrón

**2. `src/components/mobile/OCRCaptureDialog.tsx` — Campos nuevos + paso éxito**
- Agregar campos editables: `referencia` y `barrio`
- Auto-poblar `mlShipmentId` desde el OCR cuando se detecta "Envio: XXXX"
- Agregar step `'success'` con checkmark verde, tracking generado, y botón "Listo"/"Siguiente"
- Cambiar `onConfirm` para que devuelva `Promise<string | void>` (tracking number)
- Agregar `referencia` y `barrio` al `OCRConfirmData` interface
- Cuando OCR no detecta ningún campo, mostrar banner "No se pudo leer. Ingresá los datos."

**3. `src/components/mobile/FlexMixtoScreen.tsx` — Devolver tracking desde onConfirm**
- `handleOCRConfirm` debe retornar el `tracking_number` generado

**4. `src/components/mobile/MobileScanTab.tsx` — Devolver tracking desde onConfirm**
- Mismo ajuste para retornar tracking

**5. `src/components/mobile/BulkOCRScreen.tsx` — Devolver tracking desde onConfirm**
- Mismo ajuste

**6. `src/hooks/useFlexPackages.ts` — Aceptar `referencia`/`barrio`/`mlShipmentId` en addManualPackage**
- Agregar campos opcionales `referencia`, `barrio`, `mlShipmentId` al `ManualPackageData`
- Guardar `observaciones` (referencia), `barrio` y `ml_shipment_id` en el insert de `envios`

### Flujo corregido
```text
Foto etiqueta ML → OCR detecta:
  Envio: 46236169153
  Dirección: Av. Rivadavia 1234
  CP: 1878
  Localidad: Quilmes
  Barrio: Centro
  Destinatario: Juan Pérez
  Referencia: Timbre 3B

→ Campos pre-llenados editables
→ Confirmar → Spinner "Guardando..."
→ ✅ Envío creado - OCR-1712345678 (ML: 46236169153)
→ "Listo" o "Siguiente" (modo continuo)
```

### Archivos a modificar
- `src/lib/ocrParser.ts`
- `src/components/mobile/OCRCaptureDialog.tsx`
- `src/components/mobile/FlexMixtoScreen.tsx`
- `src/components/mobile/MobileScanTab.tsx`
- `src/components/mobile/BulkOCRScreen.tsx`
- `src/hooks/useFlexPackages.ts`

