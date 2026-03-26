

## Plan: Filtrar pedidos y envíos de sellers inactivos

### Problema
Cuando un seller se marca como inactivo (`activo = false`), sus pedidos y envíos siguen apareciendo en:
1. **Pedidos (Orders.tsx)** — la query trae todas las `ecommerce_orders` por `tenant_id` sin verificar si el seller está activo
2. **Gestión de Envíos (Shipments.tsx)** — muestra todos los envíos sin distinción

El webhook de ML ya filtra correctamente por `activo = true`, así que no se crean envíos nuevos para sellers inactivos. El problema es solo de visualización.

### Cambios

**1. `src/pages/ecommerce/Orders.tsx`**
- En la query principal de órdenes, agregar un filtro join: solo traer órdenes cuyo `seller.activo` sea `true` (usando el join existente con `ecommerce_sellers`)
- Alternativa más simple: filtrar client-side con `orders.filter(o => o.seller?.activo !== false)` ya que el join ya trae el campo
- El select del filtro de sellers ya filtra por `activo = true` (línea 209), así que el dropdown está correcto

**2. `src/pages/Shipments.tsx`**  
- Los envíos en Gestión de Envíos no tienen relación directa con `ecommerce_sellers` en la query. Estos envíos se muestran por `tenant_id` + fecha + estado.
- Para envíos ML de sellers inactivos: agregar un filtro que excluya envíos cuyo `remitente_id` corresponda a un seller inactivo, o bien dejarlos visibles pero con un indicador visual de "seller inactivo"

### Enfoque recomendado
Filtrar **en la query de Orders** para no mostrar pedidos de sellers inactivos, ya que esos pedidos no deberían gestionarse. Para Shipments, los envíos ya creados probablemente deban seguir visibles (ya están en operación), pero se puede agregar un badge visual.

### Archivos a modificar
- `src/pages/ecommerce/Orders.tsx` — filtro client-side en `filteredOrders`
- `src/pages/Shipments.tsx` — opcional: badge indicador para envíos de sellers inactivos

