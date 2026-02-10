
# Excluir pedidos ecommerce del planificador (solo mostrar si se seleccionan)

## Problema

El planificador muestra automáticamente TODOS los envíos pendientes sin chofer asignado, incluyendo los que provienen de pedidos ecommerce (MercadoLibre, Tiendanube). El flujo correcto es:

1. El operador selecciona pedidos manualmente desde el módulo ecommerce
2. Hace clic en "Planificar" que pasa los IDs por URL
3. Solo esos envíos aparecen en el planificador

## Solución

Filtrar la consulta principal del planificador para excluir envíos vinculados a pedidos ecommerce, **excepto** los que llegan explícitamente por URL.

## Cambios

### Archivo: `src/pages/RoutePlanner.tsx`

**Modificar la consulta `envios-planificador` (líneas 199-230):**

1. Después de obtener los envíos pendientes, ejecutar una segunda consulta a `ecommerce_orders` para obtener todos los `envio_id` vinculados
2. Filtrar del resultado los envíos que tengan un `envio_id` en esa lista
3. Mantener los envíos que vengan por URL params (`?envios=...`) aunque sean de ecommerce

```text
Flujo:
1. Cargar envíos pendientes (query actual)
2. Cargar lista de envio_ids vinculados a ecommerce_orders
3. Filtrar: excluir los que están en ecommerce EXCEPTO los que vienen por URL
4. Resultado: solo envíos "normales" + los ecommerce explícitamente seleccionados
```

### Detalle técnico

- Se agrega una consulta adicional a `ecommerce_orders` para obtener los `envio_id` que tienen pedido ecommerce vinculado
- Se usa un `Set` para filtrado eficiente
- Los envíos que llegan por `searchParams.get('envios')` se preservan siempre, sin importar si son ecommerce
- No se modifica ninguna tabla ni trigger; el cambio es puramente de UI/frontend
