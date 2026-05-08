# Fix: error de tipo al insertar en `envio_historial`

## Causa

En `reschedule_envio`, el INSERT a `envio_historial` pasa `v_new_estado` (text) a la columna `estado_nuevo`, que es de tipo `shipment_status`. Por eso aparece:

`column "estado_nuevo" is of type shipment_status but expression is of type text`

## Cambio

Migración para reemplazar la función casteando explícitamente:

- `estado_nuevo` → `v_new_estado::shipment_status`
- `estado_anterior` ya viene tipado desde `v_envio.estado`, se mantiene.

Sin cambios en frontend ni en otras tablas. Resto de la lógica intacta.

## Validación

Reprogramar desde la APK un envío `en_reparto`: debe quedar en `reprogramado` (ML) o `pendiente`, con toast de éxito y un registro nuevo en `envio_historial`.
