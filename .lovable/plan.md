

## Plan: Restaurar mini-mapa con iframe embed usando API key dinámica

### Problema
El componente actual usa `GoogleMap` + `Marker` de `@react-google-maps/api`, que requiere coordenadas (`lat/lng`). Si las sucursales no tienen coordenadas, no se muestra nada. La idea original era un iframe embed simple centrado en la **dirección** de la primera sucursal.

### Solución
**Archivo:** `src/components/dashboard/DashboardMiniMap.tsx`

Volver al diseño original con iframe de Google Maps Embed API, pero usando la API key del `useGoogleMaps()` hook en lugar de una key hardcodeada.

Cambios:
1. Usar `useGoogleMaps()` para obtener `apiKey`
2. Reemplazar `<GoogleMap>` + `<Marker>` por un `<iframe>` que usa Google Maps Embed API con la dirección de la primera sucursal como query (`?q=direccion+ciudad`)
3. Eliminar imports de `@react-google-maps/api`, `useCallback`, `useEffect`, `useRef` y toda la lógica de bounds/markers
4. Mantener el listado de hasta 4 sucursales debajo del mapa y el "+X más"
5. Si no hay `apiKey` aún, mostrar fallback "Cargando mapa..."

Resultado: mapa embed simple, funcional sin coordenadas, usando la key autorizada del tenant.

