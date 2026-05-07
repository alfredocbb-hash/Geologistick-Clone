## Objetivo
Agregar una opción adicional para descargar el comprobante como **imagen JPG** comprimida a un máximo de **1 MB**, junto al botón existente "Descargar PDF" en `PrintInvoice.tsx`.

## Cambios

### `src/pages/PrintInvoice.tsx`

1. **Nueva función `handleDownloadJPG`** (junto a `handleDownloadPDF`):
   - Renderiza `#invoice-print-area` con `html2canvas` (scale 2, fondo blanco).
   - Genera la imagen con `canvas.toDataURL('image/jpeg', quality)`.
   - Comprime iterativamente: arranca en `quality = 0.92` y va bajando (0.85, 0.75, 0.65, 0.55, 0.45) hasta que el tamaño sea ≤ 1 MB.
   - Si aún supera 1 MB, re-renderiza el canvas con `scale = 1.5` y reintenta.
   - Descarga el archivo `.jpg` con el mismo patrón de nombre (`factura-XXXX-YYYY.jpg`).
   - `toast.info` mientras genera, `toast.success` con el tamaño final (KB), `toast.error` si falla.

2. **Botón "Descargar JPG"** en la barra de acciones (línea ~490):
   - Agregar un `<Button variant="outline">` con icono `ImageIcon` (lucide-react) entre "Imprimir" y "Descargar PDF".
   - Texto: "Descargar JPG (≤1MB)".

### Detalles técnicos
- Reutiliza el patrón existente de ocultar `[data-print-hide]`.
- Se mantiene el flujo `?download=1` actual (sigue descargando PDF).
- No requiere cambios de backend ni de base de datos.