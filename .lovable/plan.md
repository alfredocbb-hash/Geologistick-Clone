

# Fix: Mapeo de estados y total en sincronización MercadoLibre

## Problema

Cuando se sincronizan pedidos de MercadoLibre que ya están "en camino" (`shipped`), el sistema los crea con:
- `fulfillment_status: 'pending'` (Sin Preparar) — incorrecto, ya están en camino
- `estado: 'pendiente'` en envíos — debería reflejar que ya están en tránsito
- `total: 0` — porque usa `shipping_cost.receiver` que es $0 en Flex

## Solución

Modificar `supabase/functions/mercadolibre-sync/index.ts` para:

1. **Detectar el estado del shipping de ML** y mapear correctamente:
   - `ready_to_ship` → `fulfillment_status: 'pending'`, `estado: 'pendiente'`
   - `shipped` → `fulfillment_status: 'shipped'`, `estado: 'en_transito'`

2. **Calcular el total** sumando los precios de los items del pedido (`order_items`) en lugar de usar `shipping_cost.receiver`.

## Sección técnica

En `supabase/functions/mercadolibre-sync/index.ts`, dentro del loop de procesamiento de órdenes:

**Agregar mapeo de estado** (antes de crear ecommerce_order, ~línea 185):
```typescript
const mlShippingStatus = orderItem.shipping?.status || 'ready_to_ship';
const fulfillmentStatus = mlShippingStatus === 'shipped' ? 'shipped' : 'pending';
const envioEstado = mlShippingStatus === 'shipped' ? 'en_transito' : 'pendiente';
```

**Calcular total desde items** (~línea 187):
```typescript
const orderTotal = (orderItem.order_items || []).reduce(
  (sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 1), 0
);
```

**Usar las variables en el insert de ecommerce_orders** (~línea 196):
- Cambiar `order_status: 'paid'` → mantener `'paid'` (es correcto, ML confirma pago)
- Cambiar `fulfillment_status: 'pending'` → `fulfillment_status: fulfillmentStatus`
- Cambiar `total: shipment.shipping_cost?.receiver || 0` → `total: orderTotal`

**Usar la variable en el insert de envios** (~línea 216):
- Cambiar `estado: 'pendiente'` → `estado: envioEstado`

Solo se modifica un archivo: `supabase/functions/mercadolibre-sync/index.ts`.

