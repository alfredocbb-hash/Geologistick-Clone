

# Fix: Filtrar liquidaciones por fecha de reparto (`fecha_entrega_estimada`)

## Problema

El filtro actual en liquidaciones busca envíos por `fecha_entrega` (fecha real de entrega, solo se completa al entregar). Los envíos que están en reparto, en sucursal, cancelados, etc. no tienen `fecha_entrega` y quedan fuera. El fallback por `created_at` tampoco es preciso.

## Solución

Filtrar por `fecha_entrega_estimada` de la tabla `ecommerce_orders`, que es la fecha de reparto asignada a cada pedido (la misma que usa el planificador de rutas y la vista de Pedidos). Esta fecha existe para todos los pedidos e-commerce independientemente de su estado.

## Cambios en `src/pages/ecommerce/Settlements.tsx`

### Sección e-commerce (líneas 400-453)

**Antes**: Se traen todos los `envio_id` de `ecommerce_orders` sin filtro de fecha, y luego se filtran los envíos por `fecha_entrega` (Query 1) + `created_at` como fallback (Query 2).

**Después**: Se filtran los `ecommerce_orders` por `fecha_entrega_estimada` en el rango seleccionado, y luego se traen TODOS los envíos correspondientes sin filtro de fecha adicional (ya están filtrados por la orden).

- Líneas 401-405: Agregar `.gte('fecha_entrega_estimada', fechaInicioStr).lte('fecha_entrega_estimada', fechaFinStr)` a la query de `ecommerce_orders`
- Líneas 422-453: Reemplazar las dos queries (fecha_entrega + created_at fallback) por UNA sola query que traiga todos los envíos cuyos IDs vienen de las órdenes ya filtradas, sin filtro de fecha en `envios`

### Sección envíos comunes (líneas 471-501)

Los envíos manuales (sin orden e-commerce) no tienen `fecha_entrega_estimada`. Para estos, mantener el filtro actual por `fecha_entrega` + fallback por `created_at`, que funciona razonablemente bien.

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ecommerce/Settlements.tsx` | Filtrar `ecommerce_orders` por `fecha_entrega_estimada`; simplificar query de envíos e-commerce |

