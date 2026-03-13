

# Fix: Liquidaciones Seller (tarifa histórica) y Choferes (tarifa por zona = 0)

## Problema 1: Seller — Tarifa nueva aplicada a envíos viejos

En `Settlements.tsx`, cuando un envío NO tiene `precio_tarifa_vigente` (envíos creados antes de que se implementara ese campo), el código busca la tarifa ACTUAL del seller y aplica el `precio_base` vigente HOY. Esto hace que envíos del 10/03 usen la tarifa modificada el 12/03.

**Solución**: Cuando `precio_tarifa_vigente` es null, usar `precio_total` del envío como fallback (ese valor fue calculado con la tarifa vigente al momento de crear el envío), en lugar de recalcular con la tarifa actual. Solo recalcular con tarifa de zona si `precio_total` también es 0.

### Cambios en `src/pages/ecommerce/Settlements.tsx`

**En el `calculateMutation`** (líneas ~564-663): Cambiar la lógica para que cuando `precio_tarifa_vigente` es null, use `precio_total` como precio histórico. Solo buscar tarifa por zona si `precio_total` es 0 o null.

**En la query `sellerBalances`** (líneas ~280-327): Misma corrección — priorizar `precio_tarifa_vigente` > `precio_total` > zona lookup.

## Problema 2: Choferes — Comisión = 0 por falta de tarifa

En `DriverSettlements.tsx`, la comisión se calcula con `calcularComision(envio.precio_total, chofer, tarifa)` donde `tarifa` viene del join `tarifas:tarifas(comision_chofer_porcentaje, comision_chofer_fija)` vía `tarifa_id` del envío. Si el envío no tiene `tarifa_id` (común en envíos de ecommerce/ML) o la tarifa no tiene configuración de comisión chofer, el resultado es 0.

**Solución**: Si el tipo de comisión del chofer es `'tarifa'` y no hay config de tarifa en el envío, buscar la tarifa por zona del tenant (igual que en seller) para obtener `comision_chofer_porcentaje` y `comision_chofer_fija`. Si no hay config de comisión en ninguna tarifa, usar `precio_total` con un fallback a porcentaje 0 (que mostrará 0 pero al menos el usuario podrá editar manualmente).

### Cambios en `src/pages/DriverSettlements.tsx`

- En el `calculateMutation`: después de obtener envíos, cargar las tarifas de zona activas del tenant.
- Para cada envío sin `tarifa` (join null), buscar la zona que coincida con `ciudad_entrega` y usar su configuración de comisión chofer.
- Agregar `ciudad_entrega` al select de envíos para poder hacer el match por zona.

| Archivo | Cambio |
|---------|--------|
| `Settlements.tsx` | Usar `precio_total` como fallback histórico en vez de recalcular con tarifa actual |
| `DriverSettlements.tsx` | Buscar tarifa por zona cuando el envío no tiene `tarifa_id` para obtener config de comisión |

