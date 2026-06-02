## Objetivo

Cuando el envío tiene `tipo_pago = 'cuenta_corriente'`, ocultar los **valores monetarios** (tarifa/precio total y montos de conceptos) en **etiquetas e impresiones** (label + comprobante). Se sigue mostrando el rótulo "Cta Cte" para que quede claro el tipo de pago, pero sin importes.

No se toca ninguna lógica de negocio (creación de envío, cuenta corriente, liquidaciones), solo presentación en los PDFs/HTML de impresión.

## Cambios

### 1. `src/pages/PrintLabel.tsx` — Etiqueta (PDF y vista HTML)

- **PDF de etiqueta (función `drawLabel`, ~líneas 396-405):** si `envio.tipo_pago === 'cuenta_corriente'`, dibujar solo el recuadro con `tipoPagoLabel` ("Cta Cte") y omitir `precioStr`.
- **Vista HTML de etiqueta (~líneas 829-846, Fila 6 Observaciones + QR):** si es cuenta corriente, ocultar el `<span>` con `${envio.precio_total}`, mantener el badge "CTA CTE".

### 2. `src/lib/generateShipmentReceiptPDF.ts` — Comprobante A4

Cuando `shipment.tipo_pago === 'cuenta_corriente'`:

- **Bloque CONCEPTOS (~líneas 384-403):** mantener el encabezado y los nombres de los conceptos, pero **no imprimir los montos** (`formatCurrency(detalle.monto)`). Alternativa más limpia: mostrar un mensaje único centrado del tipo "Facturación en cuenta corriente" en lugar del listado de importes.
- **Bloque QR + TOTAL (~líneas 429-442):** ocultar el rótulo "TOTAL" y el `formatCurrency(shipment.precio_total)`. En su lugar mostrar el texto "CUENTA CORRIENTE" donde iba el monto, manteniendo el QR, tracking y leyenda intactos.
- El texto `tipoPago` debajo del total ya dice "Cta Cte" y se mantiene.

### 3. No se modifica

- `src/lib/pdfHelpers.ts`, lógica de tarifas, conceptos almacenados en BD, ni la creación de envíos.
- Otras impresiones (rendiciones, liquidaciones, hoja de ruta, factura) — el pedido es solo etiquetas y comprobante de envío.

## QA

Probar con un envío `tipo_pago = 'cuenta_corriente'`:
- Imprimir etiqueta: no debe aparecer el `$importe`, sí el badge "Cta Cte".
- Imprimir comprobante A4: ambas copias (Agencia y Cliente) sin montos por concepto y sin TOTAL numérico.

Probar con un envío `tipo_pago = 'contado'`: todo se ve como hoy.