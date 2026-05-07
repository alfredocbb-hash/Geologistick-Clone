# Mostrar período facturado y vencimiento de pago en el comprobante

## Contexto

El comprobante actual (`/print-invoice`) no muestra el período del servicio (Desde/Hasta) ni la fecha de vencimiento de pago, aunque esos datos ya se guardan en la tabla `facturas` como `fecha_servicio_desde`, `fecha_servicio_hasta` y `fecha_vto_pago` (los manda la edge function `arca-factura` a AFIP).

## Cambio

### `src/pages/PrintInvoice.tsx`
Agregar una nueva sección **"PERÍODO FACTURADO"** debajo del bloque "DATOS DEL RECEPTOR", solo si existe alguno de los tres campos. Mostrar tres columnas:
- **Desde:** `fecha_servicio_desde`
- **Hasta:** `fecha_servicio_hasta`
- **Vto. Pago:** `fecha_vto_pago`

Formatear con `formatFechaFiscalDisplay` (sin drift de timezone) usando `slice(0,10)` por si vienen con hora. Mismo estilo visual que el bloque del receptor (`border rounded-lg p-4`, grid de 3 columnas).

La query ya hace `select('*')` así que los campos vienen automáticamente; no hace falta tocar el fetch.
