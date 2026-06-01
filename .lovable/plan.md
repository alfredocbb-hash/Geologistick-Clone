
## Objetivo

Que el comprobante de envío se imprima en **una sola hoja A4** (portrait), con **Copia Agencia arriba y Copia Cliente abajo**, separadas por una línea de corte punteada. Hoy salen en 2 páginas A4 separadas.

## Cambios

### 1. `src/lib/generateShipmentReceiptPDF.ts`

- Refactorizar `drawReceipt(doc, ...)` para que acepte un parámetro `offsetY` y dibuje el comprobante dentro de **media hoja A4** (≈148mm de alto) en lugar de una página completa de 297mm.
- Reducir verticalmente los bloques internos del comprobante para que entren en ~140mm útiles:
  - Header compacto (logo ~16mm, separador más fino)
  - Barras Origen/Destino: altura ~9mm
  - Cajas Remitente/Destinatario: alto ~30mm
  - Strip Condición de Venta: ~7mm
  - Descripción / Conceptos: altura dinámica menor, ~30mm
  - Bloque QR + Total: ~30mm (QR 28mm)
  - Firmas: ~22mm
  - Observaciones: ~14mm
  - Footer mini con nombre de empresa + etiqueta de copia
- Mantener intactos: jerarquía visual, color primario, contenido (datos, conceptos, QR, firmas, observaciones, totales) y el logo con ratio real (fix Blackbox).

- Modificar `appendShipmentReceiptToDoc`:
  - Si `startNewPage`, hacer `doc.addPage([210, 297], 'portrait')` **una sola vez**.
  - Dibujar Copia Agencia en `offsetY = 0` (mitad superior).
  - Dibujar **línea punteada de corte horizontal** en y ≈ 148.5mm con texto pequeño centrado "— Cortar aquí —".
  - Dibujar Copia Cliente en `offsetY = 148.5mm` (mitad inferior).
  - **No** agregar segunda página.

- `generateShipmentReceiptPDF` queda igual (sigue llamando a `appendShipmentReceiptToDoc` con `startNewPage = false`).

### 2. `src/pages/PrintReceipt.tsx`

- Actualizar el texto del toast a algo como: `"1 hoja A4: Copia Agencia (arriba) + Copia Cliente (abajo)"`.

### 3. `src/pages/PrintLabel.tsx`

- Sin cambios funcionales. El combinado etiqueta + comprobante ahora será: 1 página A4 con la etiqueta centrada (ya implementado) + 1 página A4 con ambas copias. Total 2 hojas A4 en lugar de 3.

## QA

- Imprimir desde `/print-receipt?id=...` con tenants Blackbox y Beraexpress: una sola hoja A4 con ambas copias, sin solapamientos, todo el contenido visible.
- Imprimir desde `/print-label?id=...` con 1 bulto: 2 hojas A4 (etiqueta + comprobante doble).
- Verificar logos de tenants con distintos aspect ratios.
- Verificar envíos con muchos conceptos (que no se solapen con el bloque QR/Total).
