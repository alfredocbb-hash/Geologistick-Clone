

## Plan: Mostrar paradas numeradas en mapa post-optimización

### Problema

Cuando hay ruta optimizada, `mapMarkers` agrega marcadores estándar (líneas 701-725) para las mismas posiciones que `routeDeliveryStops` ya muestra con números de orden. Los marcadores estándar tapan a los numerados.

### Solución

**Archivo:** `src/pages/RoutePlanner.tsx` (líneas 700-725)

Cuando `selectedOption` existe, **no agregar** las paradas al array `markers`. Solo mantener el marcador de origen (sucursal origen). Las paradas ya se visualizan correctamente mediante `deliveryStops={routeDeliveryStops}` que muestra los `DeliveryStopMarker` con números 1, 2, 3...

Cambio concreto: reemplazar el bloque `if (selectedOption)` (líneas 701-725) por un bloque vacío o simplemente eliminarlo, dejando que solo el `else` (envíos sin optimizar) agregue marcadores estándar.

