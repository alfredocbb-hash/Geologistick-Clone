

# Plan: Recorrido del chofer con Google Directions API en LiveMap

## Problema
En "Choferes en Ruta", el recorrido del chofer usa Snap to Roads (Google Roads API), que solo ajusta puntos GPS individuales a la carretera más cercana. Esto produce líneas rectas entre puntos snapped, no un trazado real calle por calle.

## Solución
Después de obtener los puntos snapped (o raw), usar la Google Directions API para generar el trazado real por calles, igual que ya se hace para la ruta planificada (línea punteada azul). Esto se aplica tanto en el mapa principal del LiveMap como en el diálogo de historial de ruta.

## Cambios

### `src/hooks/useDriverRoute.ts`
- Después de obtener `snappedRoute` (o `rawHistory` como fallback), invocar Google Directions API para generar un path street-level
- Reutilizar la misma lógica de fragmentación en tramos de ≤23 waypoints que ya existe en LiveMap para la ruta planificada
- Agregar un nuevo estado `directionsRoute: SnappedPoint[]` que contiene el trazado por Directions API
- Actualizar `polylinePath` para priorizar `directionsRoute` > `snappedRoute` > `rawHistory`
- Solo ejecutar si `window.google?.maps` está disponible (Google Maps JS cargado)

### `src/pages/LiveMap.tsx`
- El mapa ya consume `driverRoute.polylinePath`, así que al actualizar el hook no requiere cambios en el componente del mapa principal
- En el diálogo de historial (función `loadRouteHistoryForDialog`): aplicar la misma lógica de Directions API sobre `dialogSnappedRoute` o `dialogRouteHistory` para generar un path real por calles, almacenándolo en un nuevo estado `dialogDirectionsRoute`
- Usar `dialogDirectionsRoute` como polylinePath del MapView del diálogo cuando esté disponible

### Lógica de Directions API (reutilizable)
```text
function fetchDirectionsPath(points[]) → Promise<{lat,lng}[]>
  ├── Dividir en tramos de ≤23 waypoints
  ├── Para cada tramo: DirectionsService.route(origin, destination, waypoints, DRIVING)
  ├── Concatenar overview_path de cada tramo
  └── Retornar path completo
```

Esta función se puede definir como helper en `useDriverRoute.ts` o como un util compartido, y reutilizarla en ambos contextos (hook + diálogo).

| Archivo | Cambio |
|---------|--------|
| `useDriverRoute.ts` | Agregar paso post-snap con Directions API, nuevo estado `directionsRoute`, actualizar `polylinePath` |
| `LiveMap.tsx` | Aplicar Directions API en `loadRouteHistoryForDialog`, usar resultado en diálogo |

