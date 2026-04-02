

## Plan: Fix OCR pantalla en blanco + Error de cliente al crear envío

### Problema 1: OCR se pone en blanco después de tomar la foto

**Causa raíz**: Tesseract.js intenta descargar ~15MB de archivos WASM en el WebView móvil. Esto causa un crash de memoria o recarga silenciosa del WebView, dejando la pantalla en blanco. El timeout de 30 segundos no ayuda si el WebView se reinicia antes.

**Solución**: Eliminar la dependencia de Tesseract.js en el flujo OCR. En su lugar, usar el modelo de IA de Lovable Cloud (Gemini Flash) vía una edge function para extraer datos de la etiqueta directamente desde la imagen. Esto es más rápido, más liviano, y funciona mejor en WebViews móviles.

**Cambios**:
- **Crear `supabase/functions/ocr-label/index.ts`**: Edge function que recibe la imagen en base64, la envía a Gemini Flash con un prompt estructurado para extraer los campos (Envio, Dirección, CP, Localidad, Barrio, Destinatario, Referencia), y devuelve JSON.
- **Modificar `src/components/mobile/OCRCaptureDialog.tsx`**: Reemplazar el bloque de Tesseract.js por una llamada a `supabase.functions.invoke('ocr-label', { body: { image: dataUrl } })`. Eliminar la importación dinámica de `tesseract.js`. Mantener el timeout de 30 segundos y el botón "Saltar OCR" como fallback.

### Problema 2: Error de cliente al crear envío en Berazategui (BlackBox)

**Causa raíz**: El índice único `idx_clientes_dni_cuit_unique` es **global** (no incluye `tenant_id`). Cuando un cliente con el mismo DNI/CUIT existe en otro tenant, el INSERT falla con error 23505. La búsqueda previa por DNI no lo encuentra (RLS filtra por tenant), y la recuperación post-error tampoco (mismo RLS).

```text
Flujo actual:
1. Buscar por DNI → No encuentra (RLS filtra otro tenant)
2. Buscar por nombre+dirección → No encuentra (cliente nuevo)
3. INSERT → Falla: unique violation en idx_clientes_dni_cuit_unique
4. Recovery: buscar otra vez → No encuentra → ERROR
```

**Solución**: Migración SQL para reemplazar el índice global por uno per-tenant.

**Cambios**:
- **Migración SQL**: 
  ```sql
  DROP INDEX IF EXISTS idx_clientes_dni_cuit_unique;
  CREATE UNIQUE INDEX idx_clientes_dni_cuit_unique 
    ON public.clientes (tenant_id, lower(trim(dni_cuit))) 
    WHERE dni_cuit IS NOT NULL AND dni_cuit <> '';
  ```

### Archivos a crear/modificar
- `supabase/functions/ocr-label/index.ts` — nueva edge function con Gemini Flash
- `src/components/mobile/OCRCaptureDialog.tsx` — reemplazar Tesseract por llamada a edge function
- Migración SQL — fix índice único de DNI per-tenant

