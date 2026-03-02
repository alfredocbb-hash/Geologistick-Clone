

# Fix: Envíos de ruta cancelada no visibles en planificador

## Problema raíz

La cancelación de la ruta de Lucas Galarza ocurrió **antes** del fix anterior. Esos envíos quedaron en estado `pendiente` (código viejo), y el filtro de e-commerce del planificador (línea 266-272) los excluye porque son envíos con `ml_shipment_id` en estado `pendiente` sin `reprogramado_count > 0`.

El fix del `CancelRouteDialog` solo aplica a **futuras** cancelaciones. Los datos ya existentes necesitan corrección.

## Solución (2 partes)

### 1. Migración: corregir envíos ya afectados

Ejecutar una migración SQL que actualice a `en_sucursal` los envíos que:
- Pertenecen a rutas canceladas
- Están en estado `pendiente`
- Tienen `chofer_id IS NULL`
- Tienen `ml_shipment_id` (son de e-commerce)

Esto recupera los envíos de la ruta de Lucas Galarza (y cualquier otro caso similar).

### 2. Robustez en el filtro del planificador

Modificar el filtro de e-commerce en `src/pages/RoutePlanner.tsx` (líneas 266-272) para incluir también envíos que tengan historial de cancelación de ruta reciente. Alternativa más simple: ampliar la condición existente para que envíos de e-commerce en `pendiente` que tengan `ultima_reprogramacion` (indicador de que pasaron por una ruta) también sean visibles.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | UPDATE envíos de rutas canceladas de `pendiente` a `en_sucursal` |
| `src/pages/RoutePlanner.tsx` | Agregar condición: envíos e-commerce en `pendiente` con `ultima_reprogramacion` también se muestran |

## Sin riesgo

- La migración es idempotente (solo afecta envíos en `pendiente` sin chofer)
- El filtro ampliado no introduce envíos no deseados porque `ultima_reprogramacion` solo se setea en flujos de cancelación/reprogramación
