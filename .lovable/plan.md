
# Fix: Liquidaciones trae mas pedidos de los esperados + Seleccion multiple de sellers

## Problema 1: Mas pedidos en liquidacion que en la vista de pedidos

La pagina de **Pedidos e-Commerce** filtra por `fecha_entrega_estimada` (fecha de entrega), mientras que la **Liquidacion** filtra los envios por `created_at` (fecha de creacion del envio). Como estas fechas son distintas, el rango de fechas seleccionado trae resultados diferentes en cada pantalla.

**Ejemplo**: Un envio creado el 05/02 con fecha de entrega estimada 09/02. Si filtras del 09/02 al 13/02:
- En Pedidos aparece (porque la entrega estimada cae en el rango)
- En Liquidacion podria NO aparecer (porque fue creado el 05/02)
- Y viceversa: envios creados en el rango pero con entrega fuera, aparecen en liquidacion pero no en pedidos

### Solucion

Cambiar la logica de calculo de la liquidacion para que tambien use `fecha_entrega_estimada` en lugar de `created_at` al filtrar envios. Esto alinea ambas vistas y refleja el periodo real de entregas que el usuario esta viendo.

Ademas, agregar filtro por `created_at` de los `ecommerce_orders` (via fallback) para mantener consistencia.

## Problema 2: Seleccion multiple de sellers para liquidar juntos

Actualmente solo se puede seleccionar un seller a la vez. El usuario necesita poder seleccionar varios sellers (que corresponden a distintas cuentas de e-commerce del mismo cliente) y generar una unica liquidacion consolidada.

### Solucion

Reemplazar el Select simple de seller por un selector con checkboxes que permita elegir uno o varios sellers. Al calcular, se consultan los envios y movimientos de todos los sellers seleccionados y se consolidan en una sola liquidacion.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/ecommerce/Settlements.tsx` | 1) Cambiar filtro de envios de `created_at` a `fecha_entrega_estimada`. 2) Reemplazar selector simple por multi-select de sellers. 3) Adaptar logica de calculo y generacion para multiples sellers. |

## Detalle tecnico

### Cambio de filtro de fechas (Settlements.tsx - calculateMutation)

En las queries de envios (lineas ~226-273), cambiar:
```
// ANTES
.gte('created_at', fechaInicioStr)
.lte('created_at', fechaFinStr)

// DESPUES  
.gte('fecha_entrega_estimada', fechaInicioStr)
.lte('fecha_entrega_estimada', fechaFinStr)
```

Esto aplica tanto a la query principal (por `remitente_id`) como al fallback (por `ecommerce_orders`).

### Multi-select de sellers

- Cambiar el estado `calcSeller` de `string` a `string[]`
- Usar un Popover con checkboxes en lugar del Select simple
- Mostrar los sellers seleccionados como badges
- Al calcular, iterar sobre cada seller seleccionado, acumulando envios y movimientos
- Al generar la liquidacion, crear un registro por seller o un registro consolidado vinculado al primer seller (con referencia a los demas en las notas)

La opcion mas practica: crear una liquidacion por cada seller seleccionado pero en una sola accion ("Liquidar seleccionados"), ya que la tabla `liquidaciones_seller` tiene un campo `seller_id` singular. Esto mantiene la trazabilidad individual pero permite al usuario generar varias liquidaciones de una vez con el mismo periodo.

### UI del multi-select

```
[x] PABLO GAUNA
[x] PABLO GAUNA - Tienda 2
[ ] OTRO SELLER
---
[Calcular seleccionados (2)]
```

Se mostrara un resumen consolidado con el desglose por seller, y al confirmar se generan las liquidaciones individuales.
