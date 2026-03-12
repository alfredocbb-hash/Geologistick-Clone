

# Fix: Liquidaciones no respetan tarifa histórica congelada

## Problema

El campo `precio_tarifa_vigente` (tarifa congelada al momento de crear el envío) **no se incluye en las queries** que cargan los envíos para el cálculo de liquidaciones. Hay 3 queries en `Settlements.tsx` que seleccionan envíos pero ninguna incluye este campo:

- **Línea 429** (envíos e-commerce)
- **Línea 464** (envíos comunes con fecha_entrega)
- **Línea 476** (envíos comunes sin fecha_entrega)

Aunque la lógica de priorización en línea 570 (`if (e.precio_tarifa_vigente != null && e.precio_tarifa_vigente > 0)`) está correcta, `e.precio_tarifa_vigente` siempre es `undefined` porque nunca se pidió en el SELECT. El sistema cae siempre al fallback de recalcular con la tarifa actual.

## Cambio

### `src/pages/ecommerce/Settlements.tsx`

Agregar `precio_tarifa_vigente` al SELECT de las 3 queries de envíos:

1. **Línea 429** — query de envíos e-commerce:
```
.select('id, tracking_number, nombre_destinatario, direccion_entrega, ciudad_entrega, precio_total, precio_tarifa_vigente, estado, created_at, ...')
```

2. **Línea 464** — query de envíos comunes (con fecha_entrega):
```
.select('id, tracking_number, nombre_destinatario, direccion_entrega, ciudad_entrega, precio_total, precio_tarifa_vigente, estado, created_at, ...')
```

3. **Línea 476** — query de envíos comunes (sin fecha_entrega):
```
.select('id, tracking_number, nombre_destinatario, direccion_entrega, ciudad_entrega, precio_total, precio_tarifa_vigente, estado, created_at, ...')
```

Con esto, los envíos que ya tienen `precio_tarifa_vigente` guardado usarán ese valor (tarifa vieja), y solo los envíos nuevos sin precio congelado recalcularán con la tarifa actual.

