

# Fix: Incluir envíos Flex "en camino" en la sincronización de MercadoLibre

## Problema

El envío Flex con ID `46424630379` del seller PABLO GAUNA no se sincroniza porque la Edge Function `mercadolibre-sync` solo busca pedidos con `shipping.status=ready_to_ship`. Si el paquete ya fue marcado como "en camino" (`shipped`) en MercadoLibre, el sync lo ignora completamente.

## Solución

Ampliar la búsqueda para incluir también pedidos con estado `shipped`, realizando dos llamadas a la API de MercadoLibre y combinando los resultados sin duplicados.

## Cambios en `supabase/functions/mercadolibre-sync/index.ts`

**Línea 103** - Reemplazar la búsqueda única por dos búsquedas paralelas:

```
Actual:
  shipping.status=ready_to_ship

Nuevo:
  1. shipping.status=ready_to_ship
  2. shipping.status=shipped
```

Flujo:
1. Hacer `fetch` a ambos endpoints en paralelo (`Promise.all`)
2. Combinar los resultados en un solo array
3. Deduplicar por `order.id` para evitar procesar el mismo pedido dos veces
4. El resto del procesamiento (filtro `self_service`, creación de envío, cuenta corriente) permanece igual

## Sección técnica

Se reemplaza la línea 103 y el bloque de fetch (líneas 103-125) por:

```typescript
const statuses = ['ready_to_ship', 'shipped'];
const searchPromises = statuses.map(status => {
  const url = `${ML_API_BASE}/orders/search?seller=${seller.store_id}&shipping.status=${status}&sort=date_desc&limit=50`;
  return fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
});

const responses = await Promise.all(searchPromises);
const allOrders = [];
const seenIds = new Set();

for (const response of responses) {
  if (response.ok) {
    const data = await response.json();
    for (const order of (data.results || [])) {
      if (!seenIds.has(order.id)) {
        seenIds.add(order.id);
        allOrders.push(order);
      }
    }
  }
}

const orders = allOrders;
```

Solo se modifica un archivo: `supabase/functions/mercadolibre-sync/index.ts`.
