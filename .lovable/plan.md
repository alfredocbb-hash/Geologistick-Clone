

## Plan: Filtro de sellers con checkbox en la leyenda del mapa

### Cambio

**Archivo**: `src/pages/RoutePlanner.tsx`

1. Agregar estado `hiddenSellers` como `Set<string>` para trackear sellers ocultos
2. En la leyenda de sellers (línea ~1738), reemplazar el círculo de color por un `Checkbox` con el color del seller, que al hacer click toggle la visibilidad
3. En `mapMarkers` (línea ~736), filtrar los envíos cuyo `nombre_remitente` esté en `hiddenSellers` para que no aparezcan en el mapa
4. En `routeDeliveryStops` (si hay ruta optimizada), aplicar el mismo filtro

```text
Estado actual:                    Nuevo:
● Seller A                       ☑ Seller A
● Seller B                       ☐ Seller B  (oculto en mapa)
● Seller C                       ☑ Seller C
```

### Archivos a modificar
- `src/pages/RoutePlanner.tsx` — Estado `hiddenSellers`, checkbox en leyenda, filtro en markers

