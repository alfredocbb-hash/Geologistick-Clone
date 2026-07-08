## Objetivo
Al abrir el diálogo de facturación desde un envío, precargar los datos del destinatario (nombre, DNI/CUIT, domicilio) editables por el usuario antes de emitir la factura.

## Cambios

### `src/components/invoicing/InvoiceDataDialog.tsx`
- Agregar un `useEffect` que, cuando `open === true` y hay `envioId`, consulte `envios` (columnas `nombre_destinatario`, `dni_destinatario`, `direccion_entrega`, `ciudad_entrega`, `destinatario_id`) y, si existe `destinatario_id`, complete con un join opcional a `clientes` (razón social, condición IVA, dirección) que tiene prioridad sobre los campos del envío.
- Precargar los estados `nombre`, `cuit` (con `dni_destinatario`) y `domicilio` (armando `direccion_entrega, ciudad_entrega`) solo si el usuario aún no editó (comparación contra los valores iniciales vacíos, para no pisar edición manual).
- El `useEffect` existente que dispara `lookupCuit` seguirá corriendo con el DNI precargado, así que si el cliente ya está en base o AFIP responde, se autocompletan condición IVA/razón social/domicilio como hoy.
- Los inputs siguen editables — sin cambios de UI, solo el prefill inicial.
- Al cerrar (`handleClose`) mantener el reset actual para que la próxima apertura vuelva a precargar.

## Validación
1. Abrir "solicitar factura" desde un envío con destinatario cargado → los tres campos aparecen precargados y editables.
2. Editar cualquiera manualmente antes de emitir → se envía el valor editado.
3. Si el envío tiene `destinatario_id` con datos fiscales en `clientes`, prevalecen esos (razón social, condición IVA).
4. Abrir sin envío (liquidación) → comportamiento actual, campos vacíos.
