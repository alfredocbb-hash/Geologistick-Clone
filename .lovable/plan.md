

# Fix: Mostrar recorrido real por calles en el Planificador de Rutas

## Problema
Actualmente `routePolyline` simplemente conecta las coordenadas de las paradas con líneas rectas (punto a punto). Esto no refleja el recorrido real por calles, como se ve en la imagen donde las líneas cortan entre puntos sin seguir las vías.

## Solución
Usar la API de Google Maps Directions para obtener el trazado real por calles entre cada par de paradas consecutivas, y reemplazar las líneas rectas con el path decodificado de la ruta vial.

## Cambios en `src/pages/RoutePlanner.tsx`

### 1. Agregar estado para el polyline real
Nuevo state `realRoutePolyline` que almacena el path por calles, calculado cuando se selecciona una opción de ruta.

### 2. Función para obtener ruta por calles
Cuando `selectedOption` cambia, usar `google.maps.DirectionsService` con waypoints intermedios para obtener el trazado real. Google Directions soporta hasta 25 waypoints por request — si hay más paradas, dividir en tramos.

```
useEffect: selectedOption cambia →
  DirectionsService.route({
    origin: sucursalOrigen,
    destination: última parada,
    waypoints: paradas intermedias (optimizeWaypoints: false),
    travelMode: DRIVING
  }) → decodificar overview_path → setRealRoutePolyline
```

### 3. Pasar el polyline real al MapView
Cambiar `polylinePath={routePolyline}` por `polylinePath={realRoutePolyline.length > 0 ? realRoutePolyline : routePolyline}`, manteniendo las líneas rectas como fallback mientras se carga la ruta real.

### 4. Actualizar distancia y tiempo con datos reales
Opcionalmente actualizar `totalDistance` y `estimatedTime` del `selectedOption` con los valores reales de la Directions API (legs distance/duration), para que los datos mostrados sean más precisos.

| Archivo | Cambio |
|---------|--------|
| `RoutePlanner.tsx` | Estado `realRoutePolyline`, efecto con DirectionsService, fallback en MapView, datos reales de distancia/tiempo |

