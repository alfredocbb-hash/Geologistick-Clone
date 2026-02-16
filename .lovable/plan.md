
# Fix: QR de Mercado Libre no se muestra en detalle de pedidos

## Problema

El codigo QR de Mercado Libre no se muestra en el dialogo de detalles del pedido porque depende de `mlSenderId`, que se obtiene de `raw_data.sender_id`. Sin embargo, muchos pedidos tienen `raw_data = NULL` (se confirmo que la mayoria de los pedidos ML no tienen `raw_data`).

La informacion del `sender_id` esta disponible como `store_id` en la tabla `ecommerce_sellers`, pero actualmente no se incluye en la consulta de datos del seller.

## Solucion

### 1. Incluir `store_id` en la consulta de sellers (Orders.tsx)

En `src/pages/ecommerce/Orders.tsx`, linea 224, agregar `store_id` a la seleccion del seller:

```
seller:ecommerce_sellers(id, nombre, tarifa_id, sucursal_pickup_id, tiene_cuenta_corriente, store_id)
```

Actualizar la interfaz `Order` para incluir `store_id` en el tipo del seller.

### 2. Usar `store_id` del seller como fallback en OrderDetailsDialog

En `src/components/ecommerce/OrderDetailsDialog.tsx`, modificar la linea que calcula `mlSenderId`:

```
const mlSenderId = order.raw_data?.sender_id 
  || order.raw_data?.sender?.id 
  || order.seller?.store_id;
```

Esto permite que el QR se genere usando el `store_id` del seller cuando `raw_data` no tiene la informacion.

### Archivos a modificar

- `src/pages/ecommerce/Orders.tsx` - Agregar `store_id` a la consulta y al tipo del seller
- `src/components/ecommerce/OrderDetailsDialog.tsx` - Agregar fallback a `seller.store_id` para `mlSenderId`
