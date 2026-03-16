

# Recorrido real por calles en LiveMap de choferes

## Verificación del Planificador
Ambos mapas del planificador (paso 3 y panel lateral del paso 4) ya usan `realRoutePolyline` con la API de Directions — están correctos.

## Problema en el Mapa en Vivo
Cuando se selecciona un chofer y se muestra su ruta en el LiveMap, actualmente se muestra solo el **historial GPS** (snap-to-roads). Pero las paradas pendientes no están conectadas con un trazado por calles. Se necesita agregar un polyline de **ruta planificada** usando la API de Directions entre las paradas pendientes del chofer.

## Cambios en `src/pages/LiveMap.tsx`

### 1. Nuevo estado para el polyline planificado
Agregar `plannedRoutePolyline` state que almacene el trazado por calles entre las paradas pendientes.

### 2. Efecto para calcular ruta planificada
Cuando se cargan las `pendingStopsMarkers` para un chofer seleccionado, usar `google.maps.DirectionsService` para obtener el trazado real por calles:
- **Origin**: posición actual del chofer (de `driverLocations`)
- **Destination**: última parada pendiente
- **Waypoints**: paradas intermedias (ordenadas por `order`)
- Chunking si hay más de 23 waypoints (mismo patrón que RoutePlanner)

### 3. Mostrar ambos polylines en el mapa
- **Ruta recorrida** (GPS history/snapped): `driverRoute.polylinePath` — ya existe, se mantiene con gradiente
- **Ruta planificada** (Directions API): `plannedRoutePolyline` — nueva, se muestra con línea punteada o color distinto (azul claro) para diferenciar lo recorrido de lo pendiente

### 4. Limpiar al deseleccionar
Al hacer toggle off del chofer o al cambiar de chofer, limpiar `plannedRoutePolyline`.

| Archivo | Cambio |
|---------|--------|
| `LiveMap.tsx` | Estado `plannedRoutePolyline`, efecto con DirectionsService sobre pendingStops, renderizar polyline planificado en MapView |
| `MapView.tsx` | Agregar prop opcional `secondaryPolylinePath` para mostrar una segunda ruta con estilo diferente (línea punteada azul claro) |

