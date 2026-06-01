## Problema

Hoy `generateShipmentReceiptPDF.ts` mete las dos copias (Agencia + Cliente) en una sola A4 (cada una ~136mm de alto). Por eso al imprimir se ve "chico" y nada parecido a la vista de pantalla `/print-receipt`, que despliega el comprobante con tipografías grandes, padding generoso, bloques ORIGEN/DESTINO, REMITENTE/DESTINATARIO, DESCRIPCIÓN/CONCEPTOS, QR+TOTAL, FIRMAS y OBSERVACIONES en todo el ancho.

## Objetivo

Que el PDF descargado se vea igual al preview de `/print-receipt`, ocupando una A4 portrait completa por copia.

## Cambios

Archivo único: `src/lib/generateShipmentReceiptPDF.ts`.

1. **Una copia = una página A4 completa**
   - `appendShipmentReceiptToDoc`: en lugar de dibujar Agencia arriba + línea de corte + Cliente abajo en una sola página, generar:
     - Página 1: COPIA AGENCIA a página completa
     - Página 2 (`doc.addPage([210, 297], 'portrait')`): COPIA CLIENTE a página completa
   - Eliminar `drawCutLine` (ya no aplica).

2. **Reescalar `drawReceipt` a A4 completa (~280mm útiles)**, replicando la jerarquía visual del componente en pantalla:
   - Márgenes: `margin = 14mm` (en lugar de 8), para que respire como el preview.
   - Header: `logoSize` 14 → 26mm; `companyName` 12 → 18; sucursal 8 → 11; "Guía Nº" 12 → 16; fecha 9 → 11; badge "COPIA AGENCIA/CLIENTE" 9 → 12; barra primaria superior 1.2 → 2mm.
   - Barras ORIGEN/DESTINO: alto 8 → 14mm; fuente 10 → 14; texto ciudad 10 → 13.
   - Cajas REMITENTE/DESTINATARIO: `boxHeight` 26 → 50mm; header 5 → 8; nombre 10 → 14; dirección 8 → 11 (hasta 3 líneas); Tel/DNI 8 → 11.
   - Fila PAGO / DESCRIPCIÓN / CONCEPTOS: `rowHeight` 24 → 55mm (o `Math.max(55, 14 + conceptos.length * 7)`); títulos 8 → 11; valores 8 → 12.
   - Bloque QR+TOTAL+FIRMAS: `blockHeight` 30 → 55mm; `qrSize` 24 → 42mm; `totalBoxWidth` 50 → 80; "TOTAL" 10 → 14; monto 18 → 28; cajas de firma con líneas de firma + aclaración + DNI/FECHA más espaciadas.
   - OBSERVACIONES + footer legal: `obsBoxH` 10 → 22mm; 3 líneas de notas; texto legal 6.5 → 9.
   - Espaciado entre bloques `+2` → `+5mm`.
   - Recalcular suma vertical para que cierre en ~275mm (margen inferior ~14mm).

3. **Ajuste en `PrintReceipt.tsx` (texto del toast)**
   - Cambiar `'Comprobante descargado (Copia Agencia + Copia Cliente)'` a `'Comprobante descargado (2 hojas A4: Copia Agencia + Copia Cliente)'` para reflejar el nuevo formato.

4. **`PrintLabel.tsx`** (combinación etiqueta + comprobante): no requiere cambios de lógica, pero como `appendShipmentReceiptToDoc` ahora agrega 2 páginas, el PDF combinado pasará a tener: 1 página etiqueta + 2 páginas comprobante. Verificar que el orden y la llamada `startNewPage: true` siga siendo correcta (la primera página de comprobante se agrega; la segunda la agrega internamente la función).

## Lo que NO se cambia

- Diseño visual del preview `/print-receipt` (queda como referencia).
- Lógica de datos (`useQuery`, branding, conceptos, `fleteCalculado`).
- Carga de logo/QR (`loadImageAsBase64`, `loadLogoAsBase64`).
- Paleta y branding por tenant (`color_primario`, `nombre_app`).
- `generateShipmentReceiptPDF` (solo cambia internamente al usar el nuevo `appendShipmentReceiptToDoc`).

## QA

1. Generar comprobante desde `/print-receipt?id=...` y verificar:
   - PDF tiene 2 páginas A4 portrait.
   - Cada página llena la hoja (sin grandes márgenes vacíos abajo).
   - Logo, nombre del tenant, badge COPIA AGENCIA/CLIENTE, guía, fecha visibles y proporcionados.
   - Bloques REMITENTE/DESTINATARIO con dirección completa (hasta 3 líneas).
   - QR escaneable (tamaño ~42mm), TOTAL grande y legible.
   - Firmas con espacio real para firmar.
2. Probar con tenant Beraexpress (logo SVG) y BlackBox Cargas (logo PNG): logo no se debe deformar — mantener `addImage` con `width=logoSize` y `height=logoSize` actual; si en QA se ve deformado en BlackBox, ajustar a `height` proporcional usando un cálculo basado en `img.width/img.height` cacheado en `assets`.
3. Probar desde `/print-label?id=...` que el PDF combinado quede: página 1 etiqueta + páginas 2 y 3 comprobante.
