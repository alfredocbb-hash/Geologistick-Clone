

# Backfill de ml_shipping_status en pedidos ecommerce

## Problema

Algunos pedidos en `ecommerce_orders` tienen `ml_shipping_status` vacío (NULL) porque fueron creados antes de que se implementara la sincronización automática via trigger.

## Solución

Ejecutar un UPDATE que cruce `ecommerce_orders` con `envios` y aplique el mismo mapeo de estados que usa el trigger `sync_ecommerce_order_status`.

## Cambio

Se ejecutará una única sentencia SQL (sin migración de esquema, solo datos) que actualiza todos los registros con `ml_shipping_status IS NULL` y que tengan un `envio_id` vinculado:

```sql
UPDATE ecommerce_orders eo
SET ml_shipping_status = CASE e.estado
    WHEN 'pendiente' THEN 'ready_to_ship'
    WHEN 'recogido' THEN 'ready_to_ship'
    WHEN 'en_sucursal' THEN 'ready_to_ship'
    WHEN 'en_transito' THEN 'shipped'
    WHEN 'en_reparto' THEN 'shipped'
    WHEN 'primera_visita' THEN 'not_delivered'
    WHEN 'ausente' THEN 'not_delivered'
    WHEN 'entregado' THEN 'delivered'
    WHEN 'devuelto' THEN 'not_delivered'
    WHEN 'cancelado' THEN 'cancelled'
    ELSE eo.ml_shipping_status
  END,
  fulfillment_status = CASE e.estado
    WHEN 'pendiente' THEN 'pending'
    WHEN 'recogido' THEN 'processing'
    WHEN 'en_sucursal' THEN 'processing'
    WHEN 'en_transito' THEN 'shipped'
    WHEN 'en_reparto' THEN 'shipped'
    WHEN 'primera_visita' THEN 'shipped'
    WHEN 'ausente' THEN 'shipped'
    WHEN 'entregado' THEN 'delivered'
    WHEN 'devuelto' THEN 'pending'
    WHEN 'cancelado' THEN 'pending'
    ELSE eo.fulfillment_status
  END,
  updated_at = now()
FROM envios e
WHERE eo.envio_id = e.id
  AND eo.ml_shipping_status IS NULL;
```

No se modifica ningún archivo de código ni esquema de base de datos. Es una operación de datos puntual.

