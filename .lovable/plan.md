

# Fix: Incluir todas las paradas en los límites del mapa (segundo mapa del planificador)

## Problema
En el segundo mapa del planificador (paso 4 - Orden de Paradas), no todas las paradas son visibles porque el cálculo de `fitBounds` en `MapView` solo considera `markers` y `polylinePath`, pero NO incluye las posiciones de `deliveryStops`. Esto hace que el mapa no ajuste su zoom/encuadre para mostrar todas las paradas numeradas.

## Solución
Modificar el `useEffect` de `fitBounds` en `MapView.tsx` para incluir también las posiciones de `deliveryStops` en el cálculo de límites del mapa.

## Cambio en `src/components/maps/MapView.tsx`

En el `useEffect` de fit bounds (líneas ~130-162):
- Agregar `deliveryStops` a las dependencias del efecto
- Incluir cada posición de `deliveryStops` en el `LatLngBounds`
- Considerar `deliveryStops.length > 0` como condición para ejecutar el ajuste

```typescript
// Fit bounds to markers, polyline AND delivery stops
useEffect(() => {
  if (!map) return;
  const hasMarkers = markers.length > 0;
  const hasPolyline = polylinePath.length > 0;
  const hasDeliveryStops = deliveryStops.length > 0;
  
  if (!hasMarkers && !hasPolyline && !hasDeliveryStops) return;

  const bounds = new google.maps.LatLngBounds();
  markers.forEach(m => bounds.extend(m.position));
  polylinePath.forEach(p => bounds.extend(p));
  deliveryStops.forEach(s => bounds.extend(s.position)); // ← nuevo

  const totalPoints = markers.length + polylinePath.length + deliveryStops.length;
  if (totalPoints <= 1) { ... } else { map.fitBounds(bounds, 50); }
}, [map, markers, polylinePath, deliveryStops, zoom]);
```

| Archivo | Cambio |
|---------|--------|
| `MapView.tsx` | Incluir `deliveryStops` en el cálculo de `fitBounds` |

