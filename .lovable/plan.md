

# Fix: Todas las paradas visibles + diferenciación retiro/entrega por color

## Problemas identificados

### 1. Segundo mapa no muestra todas las paradas
El `GoogleMap` recibe `zoom={zoom}` (default 12) como prop controlado. Cada re-render de React puede resetear el zoom a 12, deshaciendo el `fitBounds`. Esto causa que paradas lejanas queden fuera de vista.

### 2. No hay diferenciación visual retiro vs entrega
`DeliveryStopMarker` usa siempre verde (`#10B981`) para todos los marcadores. No recibe información de tipo (retiro/entrega/sucursal).

## Cambios

### `src/components/maps/DeliveryStopMarker.tsx`
- Agregar prop `type?: 'retiro' | 'entrega' | 'sucursal'`
- Cambiar color del marcador según tipo:
  - **Entrega**: verde `#10B981`
  - **Retiro**: naranja `#F59E0B`
  - **Sucursal**: azul `#3B82F6`
- Actualizar el título del InfoWindow para mostrar "Retiro" o "Entrega"

### `src/components/maps/MapView.tsx`
- Agregar `type` a la interfaz `DeliveryStop`
- Pasar `type` al componente `DeliveryStopMarker`
- Cambiar `zoom` en `GoogleMap` para que sea controlado solo al inicio: usar un estado `initialZoom` que se setea en `onLoad` y no compita con `fitBounds`. Alternativa más simple: no pasar `zoom` como prop controlado cuando hay datos para fitBounds (usar `undefined`).

### `src/pages/RoutePlanner.tsx`
- En `routeDeliveryStops`, agregar el campo `type` desde `stop.tipo`

| Archivo | Cambio |
|---------|--------|
| `DeliveryStopMarker.tsx` | Prop `type`, colores por tipo |
| `MapView.tsx` | Pasar `type` a DeliveryStopMarker, evitar que `zoom` compita con `fitBounds` |
| `RoutePlanner.tsx` | Incluir `type` en `routeDeliveryStops` |

