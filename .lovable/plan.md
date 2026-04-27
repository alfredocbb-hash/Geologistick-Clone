## Objetivo

Actualizar de forma masiva los 35 envíos en estado `pendiente` creados el día **20 de abril de 2026** (zona horaria Argentina), asignándolos al chofer **Kevin Bernard** (`d6a5a65d-9594-45a6-b660-0c501554b227`) y marcándolos como `entregado`.

## Datos verificados

- Chofer destino: **Kevin Bernard** (`kevinbernard@beraexpress.com`).
- Envíos detectados: **35** registros con `estado = 'pendiente'` y `created_at` dentro del 2026-04-20 (horario AR).
- Ninguno tiene chofer asignado actualmente, por lo que se les debe setear `chofer_id`, `chofer_ultima_milla_id` y `fecha_asignacion_ultima_milla`.

## Cambios a ejecutar (vía herramienta de inserción/actualización SQL)

1. **Actualizar `envios`** para los 35 registros:
   - `estado = 'entregado'`
   - `chofer_id = d6a5a65d-...`
   - `chofer_ultima_milla_id = d6a5a65d-...`
   - `fecha_asignacion_ultima_milla = NOW()` (si está nulo)
   - `fecha_entrega = NOW()` (también lo asegura el trigger `set_fecha_entrega_on_delivered`)
   - Filtros: `estado = 'pendiente'` AND `created_at >= '2026-04-20 00:00:00-03'` AND `created_at < '2026-04-21 00:00:00-03'`.

2. **Cerrar paradas asociadas** en `ruta_paradas`: marcar como `completada` con `completada_at = NOW()` cualquier parada vinculada a esos envíos que aún esté `pendiente`.

3. **Triggers automáticos** que se dispararán y NO requieren acción manual:
   - `log_envio_estado_change` → registra el cambio en `envio_historial`.
   - `set_fecha_entrega_on_delivered` → asegura `fecha_entrega`.
   - `auto_sync_ml_status` y `sync_partner_shipment_status` → sincronización con MercadoLibre/partners si aplica.

## Notas importantes

- La operación es irreversible salvo intervención manual de un super_admin (estados finales bloqueados).
- No se modificarán envíos que ya estén entregados, cancelados o devueltos.
- Tras aprobar este plan, ejecutaré los UPDATE en una sola transacción y reportaré el conteo final.