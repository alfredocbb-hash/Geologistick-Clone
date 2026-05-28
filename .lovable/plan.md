## Diagnóstico (causa raíz)

Hay **dos huecos** combinados que explican por qué ML-47149217113 quedó `en_reparto` aunque ML lo había cancelado:

1. **`mercadolibre-sync` no busca envíos `cancelled`.** En `supabase/functions/mercadolibre-sync/index.ts` línea 119:
   ```ts
   const statuses = ['ready_to_ship', 'shipped', 'delivered', 'not_delivered'];
   ```
   Cuando ML cancela una orden, deja de aparecer en `/orders/search` para esos estados → el envío local nunca se vuelve a chequear contra `/shipments/{id}`, por lo que queda congelado en el último estado conocido (`shipped → en_reparto`).

2. **El webhook puede haber fallado / no llegado** para este shipment (los logs disponibles son sólo de la última hora; no se ve la notificación del 27/05 13:11). Aunque hubiera llegado, depende de que ML reintente — no hay reconciliación nuestra que cubra el caso "el webhook se perdió".

Como bonus, en `mercadolibre-sync` la política anti-downgrade castiga bien (cancelado tiene prioridad 9 vs en_reparto 5, así que **sí** se hubiera aplicado), pero nunca se ejecuta porque el envío ni siquiera entra al loop.

## Cambios propuestos

### 1. `supabase/functions/mercadolibre-sync/index.ts` — incluir cancelados y agregar pase de reconciliación

- **Agregar `'cancelled'`** al array `statuses` (línea 119) con ventana de 7 días, igual que los activos.
- **Nuevo pase de reconciliación al final del sync**, antes del `return`:
  - Buscar en `envios` del tenant del seller (filtrando por `remitente_id` del seller o por presencia de `ml_shipment_id` ligado a una `ecommerce_order` del seller) los envíos con `ml_shipment_id IS NOT NULL` y `estado NOT IN ('entregado','cancelado','devuelto')` cuyo `ml_last_sync_at` sea > 6 h o NULL.
  - Para cada uno (cap a 100 por corrida para no agotar rate-limit), pegar `GET /shipments/{id}` directo.
  - Aplicar el mismo bloque de mapping + anti-downgrade que ya existe en líneas 230-308 (extraerlo a una función `applyShipmentStatus(envioId, realStatus, realSubstatus)` para reusar y no duplicar).
  - Throttling 150 ms entre llamadas (mismo patrón que línea 225).

### 2. `supabase/functions/mercadolibre-webhook/index.ts` — fast-path para cancelaciones

- En el bloque "For other statuses" (línea ~330 en adelante), **antes** de buscar mapping, si `shipment.status === 'cancelled'`, forzar:
  - `envios.estado = 'cancelado'`, `estado_ml = 'cancelled'`, `chofer_id = NULL`, `chofer_ultima_milla_id = NULL`, `ml_sync_status='synced'`, `ml_last_sync_at = now()`.
  - Marcar `ruta_paradas` correspondientes (`envio_id = existingEnvio.id AND estado = 'pendiente'`) como `cancelada` con nota "Cancelado en Mercado Libre".
  - `ecommerce_orders.ml_shipping_status = 'cancelled'`, `fulfillment_status = 'cancelled'`.
  - Insertar fila en `envio_historial` con la nota.
- Esto garantiza que aunque el mapping falle o la prioridad cambie, una cancelación siempre se aplica.

### 3. Cron diario de reconciliación (opcional, recomendado)

- Agregar a `supabase/config.toml` un schedule diario (06:00 ART = 09:00 UTC) que invoque `mercadolibre-sync` para cada seller activo de ML.
- Si ya existe un scheduler externo, se aclara y se omite este paso. (Confirmo en código antes de tocar config.)

## Lo que **no** voy a tocar

- No cambio la lógica del bloque "ready_to_ship → crear envío" (es ortogonal).
- No toco firmas HMAC ni autenticación del webhook.
- No purgo errores históricos de `Seller not found` (es otro seller; merece otro análisis).

## Verificación

1. Confirmo que `mercadolibre-sync` ahora trae `cancelled` y el pase de reconciliación detecta y aplica el cancel sobre un envío de prueba (puedo simular cambiando `ml_last_sync_at` de algún envío activo y disparando el sync).
2. Reviso logs de `mercadolibre-webhook` después del deploy para validar que el fast-path no rompe nada en los flujos normales (shipped, delivered, etc.).
3. Te paso un resumen con los IDs de envíos a los que el primer pase de reconciliación les corrigió el estado (si los hay), para que valides.
