## Causa del problema

En el tenant **Blackbox** el envío tiene 1 bulto. En ese caso `generateLabelPdf` crea el PDF con la primera página de **100×150 mm** (tamaño etiqueta térmica). Luego `appendShipmentReceiptToDoc` agrega 2 páginas A4 (210×297 mm) al mismo documento.

Al imprimir desde Chrome con "Ajustar al ancho de página", Chrome usa el ancho de la **primera página (100 mm)** como referencia y aplica esa misma escala (~2.1×) a las páginas A4. Resultado: el comprobante se "agranda" fuera del A4 y solo se ve la esquina superior izquierda (lo que muestra la captura).

En **Beraexpress** sale bien porque seguramente se imprimen envíos con más de 1 bulto (PDF arranca en A4 con grilla 2×2) o se usa directamente `/print-receipt` (sin etiqueta), por lo que todas las páginas son del mismo tamaño y la escala es uniforme.

## Cambio propuesto

**`src/pages/PrintLabel.tsx`** — Unificar el tamaño de todas las páginas a **A4** cuando el PDF incluye etiqueta + comprobante:

1. Modificar `generateLabelPdf` (o introducir una variante usada por `handlePrint`/`handleDirectPrint`) para que, **cuando `bultos === 1`**, en lugar de generar una página de 100×150 mm, cree una página A4 portrait y dibuje la etiqueta centrada horizontalmente en la parte superior (mismas dimensiones 100×150 mm que ya usa `drawLabel`, con `offsetX = (210 − 100) / 2 = 55` y `offsetY = 10`).

2. Multi-bulto (`bultos > 1`) ya está en A4 con grilla 2×2 → sin cambios.

3. Resultado: el PDF combinado tendrá siempre **páginas A4 uniformes**, la escala de impresión de Chrome será correcta y el comprobante de Blackbox se verá completo, igual que en Beraexpress.

**No se toca** `generateShipmentReceiptPDF.ts` (sigue funcionando bien desde `/print-receipt` solo) ni la lógica de datos, branding o logo. Solo se ajusta el tamaño/posición de la etiqueta dentro del PDF combinado.

## QA

- Probar `/print-label?id=...` con Blackbox (1 bulto): verificar que las 3 páginas A4 se ven completas en el preview de impresión.
- Verificar que Beraexpress sigue saliendo bien.
- Verificar multi-bulto (4 etiquetas por hoja) sin cambios.
- Verificar que `/print-receipt` (sin etiqueta) sigue generando 2 páginas A4 correctas.
