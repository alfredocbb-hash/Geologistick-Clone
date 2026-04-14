

## Plan: Corregir carga de mapas en todos los módulos (incluida APK) y optimizar rendimiento

### Problemas identificados

1. **APK sin GoogleMapsProvider**: En `NativeAppWrapper` (líneas 157-166 de `App.tsx`), las rutas `/active-route`, `/route-start`, `/route-planner` y `MobileAppLayout` se renderizan **sin** `GoogleMapsProvider`. Como no están envueltas en `DashboardLayout`, los mapas no cargan en la APK.

2. **GoogleMapsProvider duplicados**: `DashboardLayout` ya envuelve todo en `GoogleMapsProvider`, pero `RoutePlanner.tsx` (línea 2583), `RouteSheets.tsx` (línea 979) y `EditOrderAddressDialog.tsx` (línea 127) crean instancias **anidadas** adicionales, lo que puede causar re-fetches de la API key y reinicios innecesarios del SDK de Google Maps.

3. **Ruta por calles lenta en Planificador**: Cuando el chofer selecciona envíos, el `useEffect` de `realRoutePolyline` (líneas 863-965 de `RoutePlanner.tsx`) hace requests de Directions API **secuenciales** (chunked de 23 waypoints). Con 69 paradas, son ~3 requests en serie. Esto bloquea la visualización del mapa.

### Solución

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Envolver `NativeAppWrapper` en `GoogleMapsProvider` para que todas las rutas móviles tengan acceso a mapas |
| `src/pages/RoutePlanner.tsx` | Eliminar el `GoogleMapsProvider` anidado (línea 2583-2607). Paralelizar los requests de Directions API en el useEffect de `realRoutePolyline` usando `Promise.all` en vez de secuencial |
| `src/pages/RouteSheets.tsx` | Eliminar el `GoogleMapsProvider` anidado (línea 979-1003) |
| `src/components/ecommerce/EditOrderAddressDialog.tsx` | Eliminar el `GoogleMapsProvider` anidado (línea 127-136), ya está disponible desde `DashboardLayout` |

### Detalle de optimización de rendimiento

**Antes** (secuencial):
```
Chunk 1 → esperar → Chunk 2 → esperar → Chunk 3 → render
```

**Después** (paralelo):
```
Chunk 1 ─┐
Chunk 2 ─┼→ Promise.all → render
Chunk 3 ─┘
```

Esto reduce el tiempo de ~3x latencia a ~1x latencia para rutas con muchas paradas.

### Sobre la APK
Al agregar `GoogleMapsProvider` en `NativeAppWrapper`, los mapas en `FlexMapPreview`, `ActiveRouteNavigation` y cualquier otro componente mobile cargarán correctamente sin necesidad de cambios adicionales.

