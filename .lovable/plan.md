

## Plan: Selector de rutas históricas en el panel lateral del chofer

### Problema
Actualmente el panel lateral (`DriverDetailPanel`) solo muestra la ruta activa del chofer. Si completó múltiples rutas, no hay forma de ver las anteriores ni cargar su recorrido en el mapa.

### Solución
Agregar un query de rutas históricas y un `Select` en el panel lateral para navegar entre ellas. Al seleccionar una ruta, se actualizan las paradas en el panel y se carga el recorrido GPS en el mapa.

### Cambios

**1. `src/components/livemap/DriverDetailPanel.tsx`**
- Agregar query a `rutas_planificadas` y `hojas_ruta` filtrado por `chofer_id`, ordenado por fecha descendente (últimas 10).
- Agregar estado local `selectedRouteId` que por defecto es la ruta activa.
- Mostrar un `Select` debajo del perfil con las rutas disponibles (número, fecha, estado).
- El query de paradas (`ruta_paradas`) usa `selectedRouteId` en vez del `activeRouteId` fijo.
- Agregar prop `onSelectRoute?: (driverId: string, rutaId: string) => void` para notificar al mapa.

**2. `src/pages/LiveMap.tsx`**
- Pasar callback `onSelectRoute` al `DriverDetailPanel` que llame a `toggleRouteOnMap(driverId, rutaId)` para cargar el recorrido GPS de la ruta seleccionada en el mapa.

### Detalle técnico

| Archivo | Cambio |
|---------|--------|
| `DriverDetailPanel.tsx` | Query rutas históricas, Select de ruta, paradas dinámicas, callback |
| `LiveMap.tsx` | Pasar `onSelectRoute` conectado a `toggleRouteOnMap` |

No requiere cambios en la base de datos. Se reutilizan queries y hooks existentes.

