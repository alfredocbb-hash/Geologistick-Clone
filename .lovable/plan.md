

# Sincronizar estados internos del envio al pedido ecommerce

## Problema actual

Cuando un chofer marca un envio como "primera visita", "ausente", "entregado", "cancelado", etc., ese cambio se refleja en la tabla `envios` pero el pedido de ecommerce (`ecommerce_orders`) no se entera correctamente:

1. El trigger `sync_ecommerce_order_status` solo actualiza `fulfillment_status` y `order_status`, pero NO actualiza `ml_shipping_status`
2. La sincronizacion con MercadoLibre solo busca pedidos en estado `ready_to_ship` y `shipped`, ignorando `delivered`, `not_delivered` y `cancelled`
3. Estados internos como "primera visita" o "ausente" no tienen mapeo visible en el pedido

## Cambios propuestos

### 1. Actualizar el trigger de sincronizacion

Modificar `sync_ecommerce_order_status()` para que tambien actualice `ml_shipping_status` cuando el estado del envio cambia:

| Estado envio | ml_shipping_status | Significado |
|---|---|---|
| pendiente | ready_to_ship | Listo para enviar |
| recogido | ready_to_ship | Recogido, en proceso |
| en_sucursal | ready_to_ship | En sucursal |
| en_transito | shipped | En camino entre sucursales |
| en_reparto | shipped | Salio a reparto |
| primera_visita | not_delivered | Primer intento fallido |
| ausente | not_delivered | Destinatario ausente |
| entregado | delivered | Entregado |
| devuelto | not_delivered | Devuelto |
| cancelado | cancelled | Cancelado |

### 2. Ampliar la sincronizacion ML

Agregar `delivered` y `not_delivered` a la lista de estados que se buscan durante la sincronizacion para traer pedidos finalizados.

**Archivo: `supabase/functions/mercadolibre-sync/index.ts`**

- Cambiar `const statuses = ['ready_to_ship', 'shipped']` a `['ready_to_ship', 'shipped', 'delivered', 'not_delivered']`

### 3. Agregar estados internos al mapeo visual

**Archivo: `src/pages/ecommerce/Orders.tsx`**

- Agregar estados adicionales al `ML_SHIPPING_CONFIG` para cubrir los sub-estados internos que ahora se van a reflejar

### 4. Backfill de datos existentes

Actualizar los pedidos existentes que ya tienen envio vinculado para poblar su `ml_shipping_status` segun el estado actual del envio.

---

## Seccion tecnica

| Archivo | Cambio |
|---|---|
| Migracion SQL | Actualizar trigger `sync_ecommerce_order_status` para incluir `ml_shipping_status` + backfill |
| `supabase/functions/mercadolibre-sync/index.ts` | Ampliar array de statuses a buscar |
| `src/pages/ecommerce/Orders.tsx` | Sin cambios necesarios (ya tiene `not_delivered` y `cancelled` en el mapeo) |

### Trigger actualizado (logica)

```text
WHEN 'primera_visita' THEN ml_shipping_status = 'not_delivered'
WHEN 'ausente'        THEN ml_shipping_status = 'not_delivered'
WHEN 'en_reparto'     THEN ml_shipping_status = 'shipped'
WHEN 'entregado'      THEN ml_shipping_status = 'delivered'
WHEN 'devuelto'       THEN ml_shipping_status = 'not_delivered'
WHEN 'cancelado'      THEN ml_shipping_status = 'cancelled'
```

### Backfill

```text
UPDATE ecommerce_orders eo
SET ml_shipping_status = CASE e.estado
  WHEN 'entregado'       THEN 'delivered'
  WHEN 'en_reparto'      THEN 'shipped'
  WHEN 'en_transito'     THEN 'shipped'
  WHEN 'primera_visita'  THEN 'not_delivered'
  WHEN 'ausente'         THEN 'not_delivered'
  WHEN 'devuelto'        THEN 'not_delivered'
  WHEN 'cancelado'       THEN 'cancelled'
  ELSE 'ready_to_ship'
END
FROM envios e
WHERE eo.envio_id = e.id
  AND eo.plataforma = 'mercadolibre';
```

