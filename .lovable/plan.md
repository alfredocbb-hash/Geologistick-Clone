
## Limpieza de datos históricos y mejora de filtros

### Problema
- La página de **Envíos** carga TODOS los envíos sin límite de fecha, mostrando 407 envíos viejos (desde enero 10)
- La página de **Pedidos e-commerce** filtra por día (hoy por defecto), así que no debería mostrar datos viejos. Si ves datos viejos ahí, es porque seleccionaste otra fecha en el calendario
- Los 407 envíos viejos son de pruebas/datos previos (todos entregados o cancelados)

### Plan

**Paso 1: Limpiar envíos viejos de la base de datos**

Eliminar los 407 envíos anteriores al 9 de febrero y sus registros asociados (historial, detalles, etc.). Todos están en estado "entregado" o "cancelado", así que no hay impacto operativo.

**Paso 2: Agregar filtro de fecha por defecto en la página de Envíos**

Actualmente `Shipments.tsx` no tiene ningún filtro de fecha. Se agregará:
- Un selector de rango de fechas (similar al de pedidos e-commerce)
- Por defecto mostrará solo los envíos del día actual
- El usuario podrá cambiar la fecha para ver otros días

### Detalle técnico

**Base de datos:**
1. Eliminar registros de `envio_historial` donde el envío es anterior al 9/02
2. Eliminar registros de `envio_detalles` asociados
3. Eliminar registros de `ruta_paradas` asociados
4. Eliminar los 407 envíos de la tabla `envios`

**Archivo: `src/pages/Shipments.tsx`:**
- Agregar estado `dateFilter` con fecha de hoy como valor por defecto
- Agregar componente Calendar/Popover para seleccionar fecha
- Modificar la query para filtrar por `startOfDay` / `endOfDay` de la fecha seleccionada
- Aplicar el mismo patrón que ya usa `ecommerce/Orders.tsx`
