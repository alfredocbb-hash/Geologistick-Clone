

## Plan: Módulo Flex Mixto con Fallback OCR

### Resumen
Crear un módulo independiente que clona el flujo de escaneo Flex actual pero agrega un "Fallback Gate": cuando un envío ML no se puede registrar vía API (seller no autorizado), se activa captura de foto + OCR con Tesseract.js para extraer la dirección de la etiqueta, permitiendo crear el envío manualmente y sumarlo a la ruta.

### Cambios

**1. Migración SQL** — Agregar columnas de trazabilidad al tabla `envios`
- `is_manual_entry BOOLEAN DEFAULT false` — marca envíos ingresados por OCR
- `source_module TEXT DEFAULT NULL` — identifica el módulo origen (`flex_mixto`, `flex`, etc.)

**2. Instalar dependencia** — `tesseract.js` para OCR en el navegador

**3. `src/components/mobile/FlexMixtoScreen.tsx`** — Componente principal (clon de FlexScanScreen)
- Copia la estructura de `FlexScanScreen` renombrada como `FlexMixtoScreen`
- Modifica `handleQRScanned`: cuando un ML shipment no se encuentra Y el `MLRegisterDialog` falla (401/403 o seller no autorizado), en lugar de mostrar error, activa el flujo OCR
- Agrega estados: `showOCRCapture`, `ocrResult`, `showOCRConfirm`

**4. `src/components/mobile/OCRCaptureDialog.tsx`** — Modal de captura + OCR
- Abre la cámara (usa `useNativeCamera` para nativo o `<input type="file" capture>` como fallback web)
- Procesa la imagen con `Tesseract.js` (idioma español)
- Extrae dirección, localidad y CP mediante regex sobre el texto reconocido
- Muestra un formulario de confirmación con campos editables:
  - Dirección detectada (editable)
  - Localidad (editable)
  - CP (editable)
  - Nombre destinatario (manual, opcional)
- Al confirmar: geocodifica la dirección via edge function `geocode-address`, y crea el envío en `envios` con:
  - `is_manual_entry: true`
  - `source_module: 'flex_mixto'`
  - `tracking_number` autogenerado via RPC `generate_tracking_number`
  - `estado: 'recogido'`
  - Coordenadas del geocoding
  - `chofer_id` = usuario actual
  - `tenant_id` del perfil

**5. `src/hooks/useFlexPackages.ts`** — Agregar función `addManualPackage`
- Nueva función que recibe datos del formulario OCR (dirección, ciudad, CP, coords, nombre)
- Crea el envío en Supabase con los campos `is_manual_entry` y `source_module`
- Lo agrega a la lista de paquetes flex como cualquier otro

**6. `src/components/mobile/MobileAppLayout.tsx`** — Integrar el módulo
- Agregar condición en `renderTabContent` para el tab `scan`: si el tenant tiene `modo_flex_mixto` (o usar un flag, se puede reusar `modo_flex` con una preferencia adicional), renderizar `FlexMixtoScreen`
- Alternativa más simple: agregar un toggle/switch dentro de `FlexScanScreen` que active el "Modo Mixto"

**7. `src/lib/ocrParser.ts`** — Utilidad de extracción de texto
- Funciones regex para extraer de texto OCR argentino:
  - Dirección: busca patrones como "Calle 1234" o "Av. San Martín 567"
  - Localidad: busca después de keywords como "Localidad:", "Ciudad:", o el bloque bajo la dirección
  - CP: busca patrones de 4 dígitos precedidos por "CP", "C.P.", o "(" 
- Función de limpieza: elimina caracteres especiales, normaliza espacios

### Flujo del usuario
```text
Escanea QR ML
    │
    ├─ Encontrado en sistema → Se agrega a lista (flujo normal)
    │
    └─ No encontrado / API falla
         │
         ├─ Intenta registrar via ML API (MLRegisterDialog)
         │    │
         │    ├─ Éxito → Se agrega a lista
         │    │
         │    └─ Error (401/403/seller no autorizado)
         │         │
         │         └─ Abre OCRCaptureDialog
         │              │
         │              ├─ Toma foto de etiqueta
         │              ├─ Extrae dirección via OCR
         │              ├─ Usuario confirma/edita datos
         │              ├─ Geocodifica dirección
         │              └─ Crea envío manual → Se agrega a lista
```

### Detalle técnico
- Tesseract.js se carga dinámicamente (`import('tesseract.js')`) para no impactar el bundle principal
- El OCR se ejecuta en un Web Worker (comportamiento por defecto de Tesseract.js)
- La cámara usa el hook `useNativeCamera` existente en entornos Capacitor, con fallback a `<input type="file" accept="image/*" capture="environment">` en web
- Los envíos manuales se identifican con `is_manual_entry = true` y `source_module = 'flex_mixto'` para poder filtrarlos en reportes

### Archivos nuevos
- `src/components/mobile/FlexMixtoScreen.tsx`
- `src/components/mobile/OCRCaptureDialog.tsx`
- `src/lib/ocrParser.ts`

### Archivos a modificar
- `src/hooks/useFlexPackages.ts` (nueva función `addManualPackage`)
- `src/components/mobile/MobileAppLayout.tsx` (integración del módulo)
- Migración SQL (columnas `is_manual_entry`, `source_module`)
- `package.json` (agregar `tesseract.js`)

