# Descarga ≤1 MB en formato PDF (no JPG)

## Objetivo
Reemplazar la descarga JPG comprimida por una descarga **PDF** que mantenga el límite de 1 MB, conservando el botón secundario junto a "Descargar PDF".

## Cambios en `src/pages/PrintInvoice.tsx`

1. **Renombrar handler** `handleDownloadJPG` → `handleDownloadCompressedPDF`.
2. **Reemplazar la lógica de generación**:
   - Seguir capturando el invoice con `html2canvas` iterando `scales = [2, 1.5, 1.2, 1, 0.85]`.
   - Para cada escala, iterar `qualities = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25]`.
   - En cada iteración: crear un `jsPDF` A4, insertar la imagen como **JPEG comprimido** (`doc.addImage(dataUrl, 'JPEG', ...)`), obtener el blob con `doc.output('blob')` y medir `blob.size`.
   - Cortar al primer resultado con `size <= 1 MB`. Guardar siempre el último intento como fallback.
3. **Descarga**: usar `URL.createObjectURL(blob)` + link con extensión `.pdf` (mismo patrón de nombre que `handleDownloadPDF`).
4. **Toasts**: éxito muestra "PDF descargado (XXX KB)"; si no se logra bajar de 1 MB tras compresión máxima, `toast.warning` indicándolo.
5. **Botón (línea ~560)**: cambiar texto a `Descargar PDF (≤1MB)` y reemplazar el ícono `ImageIcon` por `FileText` (o mantener `Download`). Quitar el import `Image as ImageIcon` si queda sin uso.

## Detalles técnicos
- jsPDF ya está importado.
- Usar `compress: true` en `new jsPDF({ compress: true })` para reducir overhead.
- Mantener el bloqueo del badge `[data-print-hide]` durante la captura.
- No tocar `handleDownloadPDF` (sigue siendo la descarga full-quality).

## Validación
- Abrir una factura, click en "Descargar PDF (≤1MB)" → archivo `.pdf` < 1 MB visible en disco.
- Abrirlo y comprobar legibilidad.
- "Descargar PDF" original sigue funcionando sin cambios.
