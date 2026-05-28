## Implementar rediseño v3 del comprobante PDF

Aplicar el layout "grilla industrial compacta" mostrado en el mockup a `src/lib/generateShipmentReceiptPDF.ts`.

### Cambios

1. **Header en 3 filas** (sin superposición, 2mm de separación):
   - Badge "COPIA AGENCIA" con borde negro 0.5mm
   - "Guía: ENV-XXXX" en 11pt bold
   - "Fecha: dd/mm/yyyy" en 8pt gris

2. **Código QR** 22mm en esquina inferior izquierda con label "Escaneá para seguir tu envío" arriba y código corto debajo en mono bold 11pt.

3. **Barras ORIGEN/DESTINO**: fondo negro / gris 40% con texto blanco.

4. **REMITENTE/DESTINATARIO**: header negro, dirección hasta 2 líneas (60 chars), teléfono/DNI en líneas separadas.

5. **Tabla CONCEPTOS**: header gris, líneas finas negras, montos bold alineados a la derecha.

6. **Caja TOTAL**: borde negro 1.5mm, monto 16pt bold, indicador de tipo de pago arriba.

7. **Firmas**: líneas sólidas 0.4mm, labels 7pt mayúsculas.

8. **Línea de corte**: punteada gris con "✂ CORTAR POR AQUÍ ✂" en 7pt.

9. **Footer**: legal en 6pt itálica gris.

### Exclusiones

- No tocar `precio_total`, lógica de fallback de Flete, `loadLogoAsBase64`, `pdfHelpers.ts`, generación remota de QR, A4, ni split de 2 comprobantes.
- `color_primario` solo como acento sutil en borde superior (todo lo crítico en negro/gris).

### Verificación

Generar PDF de prueba e inspeccionar con `pdftoppm` página por página para confirmar sin superposiciones, QR legible y todos los elementos visibles en B/N láser.
