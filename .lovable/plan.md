## Problema

En `src/lib/generateShipmentReceiptPDF.ts`, la función `drawReceipt` dibuja cada copia (agencia/cliente) con alturas fijas que totalizan ~110 mm, pero cada mitad de la A4 mide 148.5 mm. Resultado: el comprobante queda chico, centrado arriba de cada mitad, dejando ~35 mm de espacio en blanco abajo de cada copia.

Lo mismo aplica cuando el comprobante se anexa al PDF de etiqueta interna (`PrintLabel`), porque usa la misma función de dibujo.

## Cambios

**Archivo único:** `src/lib/generateShipmentReceiptPDF.ts`

1. **Calcular altura disponible por copia**
   - `availableHeight = pageHeight / 2` (≈148.5 mm) menos un pequeño margen para la línea de corte.
   - Definir alturas objetivo para cada bloque que sumen el total disponible, en lugar de los valores fijos actuales (`boxHeight = 24`, `blockHeight = 28`, `conceptBoxHeight ≈ 20`, barra obs = 10, etc.).

2. **Reescalar bloques de `drawReceipt`** proporcionalmente para llenar la mitad de A4:
   - Header / logo: subir `logoSize` de 14 → ~18 mm y aumentar tipografías del header (companyName 12→14, guía 11→13, fecha 8→10).
   - Barras ORIGEN/DESTINO: altura 6 → 8 mm, fuente 8 → 10.
   - Cajas REMITENTE/DESTINATARIO: `boxHeight` 24 → ~34 mm, ampliar líneas de dirección (mostrar hasta 3 líneas en vez de 2) y subir fuentes de nombre (9→11) y datos (7→9).
   - Fila PAGO / DESCRIPCIÓN / CONCEPTOS: `rowHeight` mínimo 20 → ~32 mm, fuente conceptos 7 → 9, separadores ajustados.
   - Bloque QR + TOTAL + FIRMAS: `blockHeight` 28 → ~38 mm, `qrSize` 22 → 30 mm, fuente TOTAL 16 → 22, firmas con más altura para firmar cómodamente.
   - Caja OBS + footer: altura 10 → ~14 mm, dos líneas para observaciones.
   - Espaciados verticales (`y += …`) recalculados para que la suma encaje en ~146 mm dejando margen para la línea de corte.

3. **Mantener el layout y la estética** (mismas columnas, colores, badges, línea de corte centrada en `pageHeight/2`). Solo cambian dimensiones y tipografías para ocupar toda la hoja.

4. **No tocar**:
   - `PrintLabel.tsx`, `PrintReceipt.tsx`, ni la firma pública de `generateShipmentReceiptPDF` / `appendShipmentReceiptToDoc`.
   - Lógica de datos, branding, QR ni de carga de imágenes.

## QA

- Generar el PDF combinado desde PrintLabel y verificar que cada copia ocupe su mitad de la A4 sin espacio muerto y sin que se corten elementos.
- Generar el comprobante solo desde `PrintReceipt` y validar lo mismo.
