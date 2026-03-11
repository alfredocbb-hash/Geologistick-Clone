

# Ampliar búsqueda en Pedidos e-Commerce

## Cambio

**Archivo: `src/pages/ecommerce/Orders.tsx`** (líneas 267-271)

Actualmente el filtro de búsqueda solo compara contra `buyer_name`, `external_order_number` y `external_order_id`. Se agregará:

- **ID ML** (`ml_shipment_id`): convertido a string para comparar
- **Tracking interno** (`envio?.tracking_number`): el tracking del envío vinculado
- **Localidad** (`shipping_city`): la ciudad/localidad de entrega

```typescript
// Antes
const matchesSearch = 
  o.buyer_name.toLowerCase().includes(search.toLowerCase()) ||
  o.external_order_number?.toLowerCase().includes(search.toLowerCase()) ||
  o.external_order_id.toLowerCase().includes(search.toLowerCase());

// Después
const s = search.toLowerCase();
const matchesSearch = 
  o.buyer_name.toLowerCase().includes(s) ||
  o.external_order_number?.toLowerCase().includes(s) ||
  o.external_order_id.toLowerCase().includes(s) ||
  o.ml_shipment_id?.toString().includes(s) ||
  o.envio?.tracking_number?.toLowerCase().includes(s) ||
  o.shipping_city?.toLowerCase().includes(s);
```

Todos los campos ya existen en la interface `Order` y en la query (el `envio` se trae con join). Un solo archivo, sin cambios de base de datos.

