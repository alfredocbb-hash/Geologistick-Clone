## Problema

Cada copia del comprobante (función `drawReceipt` en `src/lib/generateShipmentReceiptPDF.ts`) hoy mide ~166 mm de alto, pero cada mitad de A4 son 148.5 mm. Resultado:

- La **copia agencia** se mete ~17 mm dentro de la mitad inferior → se superpone con la **copia cliente** (justo donde está el bloque QR/TOTAL/firmas, como se ve en la captura).
- La **copia cliente** termina en ~314 mm, sobrepasando los 297 mm de la A4 → la parte inferior (barra ORIGEN/DESTINO + observaciones) sale cortada al imprimir.

El último cambio había agrandado demasiado los bloques tratando de "llenar" la hoja.

## Cambios

**Archivo único:** `src/lib/generateShipmentReceiptPDF.ts` → función `drawReceipt`.

Objetivo: que cada copia mida ~138–140 mm, dejando ~8–10 mm de margen libre antes de la línea de corte y antes del borde inferior de la A4.

Reescalado de bloques (todas las demás proporciones, colores, textos y layout quedan iguales):

1. **Header / logo**: `logoSize` 18 → 14 mm. Tipografías del header bajan acordemente (companyName 14 → 12, guía 13 → 12, fecha 10 → 9, sucursal 9 → 8). Recalcular `y = headerStart + logoSize + 3`.
2. **Cajas REMITENTE / DESTINATARIO**: `boxHeight` 34 → 26 mm. Dirección limitada a 2 líneas (en lugar de 3). Tipografías nombre 11 → 10, datos 9 → 8.
3. **Fila PAGO / DESCRIPCIÓN / CONCEPTOS**: `rowHeight` mínimo 30 → 24 mm, y la fórmula pasa a `Math.max(24, 9 + conceptos.length * 4.2)`. Tipografía conceptos 9 → 8, interlineado 5 → 4.2.
4. **Bloque QR + TOTAL + FIRMAS**: `blockHeight` 38 → 30 mm, `qrSize` 30 → 24 mm, `qrBoxWidth` 34 → 28, `totalBoxWidth` 56 → 50. Tipografía TOTAL 22 → 18. Reposicionar líneas de firma para que entren en 30 mm (línea firma en y+19, "Firma y aclaración" en y+22, línea DNI en y+26, "DNI" en y+29).
5. **OBS + footer**: `obsBoxH` 14 → 10 mm, observaciones a 1 línea.
6. **Espaciados verticales** entre bloques: mantener `+2` actuales (ya son ajustados).

Recalculo final aproximado por copia:
`5 (top) + 1.2 + 2.8 + 14 + 3 + 1 + 3 + 8 + 2 + 26 + 2 + 24 + 2 + 30 + 2 + 10 ≈ 136 mm` ✓

## Lo que NO cambia

- `appendShipmentReceiptToDoc`, `generateShipmentReceiptPDF`, `drawCutLine`.
- `PrintLabel.tsx`, `PrintReceipt.tsx`.
- Estética: mismos colores, badges, línea de corte, columnas, branding, QR.

## QA

- Generar comprobante desde `PrintReceipt` y verificar que ambas copias entren completas en una A4 sin superposición y sin cortes en el borde inferior.
- Generar el PDF combinado desde `PrintLabel` (etiqueta + comprobante) y validar lo mismo en la página del comprobante.
- Verificar legibilidad del bloque TOTAL y de las firmas con los nuevos tamaños.
