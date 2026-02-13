

# Fix: Liquidacion trae envios de otros sellers con mismo cliente

## Problema

Los sellers de la familia Gauna comparten el mismo `cliente_id`. La query actual busca envios por `remitente_id = cliente_id`, lo que trae los 12 envios de TODOS los sellers vinculados a ese cliente, en vez de solo los 7 del seller seleccionado (PABLO GAUNA, store_id 146864736).

## Solucion

Reescribir la seccion de busqueda de envios en `calculateMutation` con esta logica:

1. **Envios e-commerce del seller seleccionado**: Buscar en `ecommerce_orders` donde `seller_id` esta en los sellers seleccionados, con `fecha_entrega_estimada` en rango, obtener los `envio_id`, y cargar esos envios.
2. **Envios comunes (sin orden e-commerce)**: Buscar envios por `remitente_id = cliente_id` con `fecha_entrega` en rango, que NO esten vinculados a ninguna orden e-commerce de otro seller. Esto captura envios manuales como ADMIN-ENV-20260211.
3. **Combinar** ambos conjuntos sin duplicados.

## Archivo afectado

| Archivo | Cambio |
|---|---|
| `src/pages/ecommerce/Settlements.tsx` | Reescribir lineas ~236-291 del `calculateMutation` para filtrar envios por seller seleccionado via `ecommerce_orders`, y solo agregar envios comunes sin orden |

## Detalle tecnico

### Nuevo flujo (reemplaza lineas 236-291)

```text
Paso 1: ecommerce_orders WHERE seller_id IN (calcSellers)
        AND fecha_entrega_estimada entre fechas
        AND envio_id NOT NULL
        -> lista de envio_ids especificos del seller

Paso 2: Cargar envios WHERE id IN (envio_ids)
        AND liquidacion_seller_id IS NULL

Paso 3: Buscar TODOS los envio_ids de ecommerce_orders
        del mismo cliente_id (para excluirlos)

Paso 4: Envios comunes WHERE remitente_id IN (cliente_ids)
        AND fecha_entrega entre fechas
        AND liquidacion_seller_id IS NULL
        AND id NOT IN (todos los envio_ids de cualquier order)

Paso 5: Combinar paso 2 + paso 4
```

Resultado esperado para PABLO GAUNA: 6 pedidos e-commerce + 1 envio comun = 7 items.

