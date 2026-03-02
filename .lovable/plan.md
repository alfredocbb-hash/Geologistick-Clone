

# Fix: Envíos de ruta cancelada de Lucas Galarza no aparecen

## Diagnóstico

La ruta RP-20260302-8889 de Lucas Galarza fue cancelada **antes** de los fixes anteriores. Los 13 envíos quedaron en estado `pendiente` sin `chofer_id`, pero **sin** `ultima_reprogramacion` ni `reprogramado_count`. Por eso:

- La migración anterior (que buscaba `ultima_reprogramacion IS NOT NULL`) no los encontró
- El fix de código (misma condición) tampoco los incluye

## Solución (2 partes)

### 1. Corrección de datos existentes

Actualizar a `en_sucursal` todos los envíos de e-commerce en `pendiente` sin chofer asignado que tienen historial de cancelación de ruta. Se identifican los envíos exactos via la tabla `envio_historial` donde las notas contienen "cancelada".

Los 13 envíos afectados de la ruta RP-20260302-8889 serán actualizados.

### 2. Filtro más robusto en el planificador

**Archivo:** `src/pages/RoutePlanner.tsx` (líneas 266-272)

Agregar una condición adicional: envíos de e-commerce en `pendiente` que no tengan chofer asignado también deben mostrarse. La lógica es:

- Un envío e-commerce **nuevo** en `pendiente` tiene sentido ocultarlo (aún no fue recolectado del seller)
- Un envío e-commerce en `pendiente` **sin chofer** que ya pasó por una ruta (fue liberado) debe verse

La condición nueva será: `(envio.estado === 'pendiente' && !envio.chofer_id && envio.ml_shipment_id)` -- pero esto es demasiado amplio. Mejor verificar si el envío tiene historial previo, o simplemente confiar en que los envíos e-commerce sin chofer en `pendiente` que tienen `sucursal_actual_id` seteado ya fueron procesados.

Solución más simple y segura: cambiar el filtro para no excluir envíos de e-commerce que estén en `pendiente` **si no tienen chofer asignado**. Porque los nuevos tampoco tienen chofer, pero ya aparecen en la pestaña de ecommerce/orders, no en el planificador directo.

En resumen, la condición del filtro se amplía agregando:
```typescript
(envio.estado === 'pendiente' && !envio.chofer_id)
```

Esto es seguro porque el query principal ya filtra por estados específicos y la sucursal del usuario.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Datos (SQL UPDATE) | Actualizar los 13 envíos de ruta cancelada de `pendiente` a `en_sucursal` |
| `src/pages/RoutePlanner.tsx` | Agregar condición al filtro: envíos e-commerce en `pendiente` sin chofer se muestran |

## Sin cambios de esquema

Solo UPDATE de datos existentes y ajuste de filtro en código.
