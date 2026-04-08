

## Plan: Reducir superposición de marcadores DeliveryStopMarker

### Análisis previo
Revisé todos los usos de marcadores en el proyecto:
- **RoutePlanner**: Ya evita correctamente la duplicación (no agrega markers estándar cuando hay `selectedOption`, solo usa `DeliveryStopMarker`)
- **LiveMap**: Usa `DeliveryStopMarker` + `DriverMarker` (OverlayView circular), sin conflicto entre tipos
- **ActiveRouteNavigation**: Solo usa markers estándar, no `DeliveryStopMarker`
- **RouteSheets**: Usa `DeliveryStopMarker` vía `driverRoute`

**Conclusión**: El único problema de superposición es entre instancias de `DeliveryStopMarker` cuando las paradas están geográficamente cerca. No hay conflicto entre tipos de marcadores distintos.

### Solución

**Archivo**: `src/components/maps/DeliveryStopMarker.tsx`

Cambiar el icono de pin SVG (alto, con cola) a **círculo compacto** que ocupa menos espacio:

```typescript
icon={{
  path: google.maps.SymbolPath.CIRCLE,
  fillColor: colors.fill,
  fillOpacity: 1,
  strokeColor: colors.stroke,
  strokeWeight: 2,
  scale: 14,
  labelOrigin: new google.maps.Point(0, 0),
}}
label={{
  text: order.toString(),
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: 'bold',
}}
```

El círculo reduce el área visual de ~48px (alto del pin) a ~28px (diámetro), eliminando la cola que causa la mayoría de las superposiciones.

### Archivos a modificar
- `src/components/maps/DeliveryStopMarker.tsx` — Pin → círculo compacto

