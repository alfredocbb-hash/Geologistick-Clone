

# Fix: Column `envios.fecha_entrega_estimada` does not exist

## Problema

El cambio anterior uso `fecha_entrega_estimada` como filtro en la tabla `envios`, pero esa columna no existe en `envios`. La tabla `envios` tiene `fecha_entrega`, mientras que `fecha_entrega_estimada` esta en la tabla `ecommerce_orders`.

## Solucion

Reemplazar `fecha_entrega_estimada` por `fecha_entrega` en las dos queries de la tabla `envios` dentro de `calculateMutation` en `src/pages/ecommerce/Settlements.tsx`.

**Lineas afectadas:**
- Linea 242: `.gte('fecha_entrega_estimada', ...)` cambiar a `.gte('fecha_entrega', ...)`
- Linea 243: `.lte('fecha_entrega_estimada', ...)` cambiar a `.lte('fecha_entrega', ...)`
- Linea 279: `.gte('fecha_entrega_estimada', ...)` cambiar a `.gte('fecha_entrega', ...)`
- Linea 280: `.lte('fecha_entrega_estimada', ...)` cambiar a `.lte('fecha_entrega', ...)`

Ademas, para el fallback via `ecommerce_orders`, agregar filtro por `fecha_entrega_estimada` en la query de `ecommerce_orders` (linea 260-264) para que solo traiga ordenes dentro del periodo seleccionado.

## Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/pages/ecommerce/Settlements.tsx` | Corregir nombre de columna de `fecha_entrega_estimada` a `fecha_entrega` en queries de `envios`, y filtrar `ecommerce_orders` por `fecha_entrega_estimada` |
