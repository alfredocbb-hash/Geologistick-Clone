## Problema

En "Facturación → Emitidas" no hay forma de imprimir ni descargar la factura emitida. El menú de acciones (⋮) solo ofrece **Duplicar / Anular / Emitir Nota de Crédito**, pero falta el acceso a la vista de impresión.

La página `PrintInvoice` ya existe y soporta `?factura_id=<uuid>` (no requiere envío), pero **no se enlaza desde ningún lado en Facturación**. Además, cuando la factura es **manual** (sin `envio_id` ni liquidación), `PrintInvoice` no renderiza los `line_items` guardados y termina mostrando un único renglón "Flete $0".

## Cambios

### 1. `src/pages/Facturacion.tsx` — Agregar acciones de impresión

Dentro del `DropdownMenuContent` de cada fila de "Emitidas", agregar al inicio (antes de Duplicar):

- **Imprimir / Ver PDF** → abre `/print-invoice?factura_id={id}` en nueva pestaña.
- **Descargar PDF** → mismo destino con un parámetro `?factura_id={id}&download=1` para que `PrintInvoice` dispare automáticamente la descarga al cargar.

Iconos: `Printer` y `Download` de lucide-react (ya importados en otros lugares; agregar imports si faltan).

### 2. `src/pages/PrintInvoice.tsx` — Soporte de auto-descarga + facturas manuales

a) **Auto-descarga:** leer `searchParams.get('download')`. Cuando exista, en un `useEffect` que dispare cuando el DOM y la factura estén listos, llamar a `handleDownloadPDF()` automáticamente.

b) **Renderizar `line_items` para facturas manuales:** ajustar `conceptosAMostrar`:
- Si la factura tiene `line_items` (array no vacío) y no es de liquidación, usar esos ítems mapeados a `{ nombre_concepto: descripcion, monto: subtotal }`.
- Mantener el comportamiento actual para facturas con envío y liquidaciones.

c) **Botón Volver:** cuando no hay envío asociado, redirigir a `/facturacion` en lugar de `/shipments`.

### 3. Validación rápida

- Emitir Factura B manual → en Emitidas, click en ⋮ → "Imprimir" abre la vista con los ítems correctos y el QR de AFIP.
- "Descargar PDF" baja el archivo `factura-XXXX-XXXXXXXX.pdf` automáticamente.
- Facturas vinculadas a envíos siguen mostrando el detalle del envío como hasta ahora.

## Archivos a modificar

- `src/pages/Facturacion.tsx`
- `src/pages/PrintInvoice.tsx`

Sin cambios de base de datos ni de edge functions.