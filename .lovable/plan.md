

# Fix: Mapa del Planificador — Origen como partida y ajuste de zoom

## Problemas identificados

### 1. Primer mapa no centra en la sucursal origen
El `center` prop se pasa siempre con las coordenadas de la sucursal origen + `zoom={12}` fijo. Esto hace que `GoogleMap` fuerce el centro al origen en vez de dejar que `fitBounds` ajuste la vista para mostrar TODA la ruta incluyendo origen y destinos.

### 2. Segundo mapa no muestra todas las paradas
Mismo problema: el `center` prop forzado compite con `fitBounds`. Además, cuando `realRoutePolyline` se carga asincrónicamente (vía Directions API), la ruta real puede extenderse más allá de los bounds calculados inicialmente.

## Solución

### Cambio en `MapView.tsx`
- Cuando hay datos suficientes para `fitBounds` (markers + polyline + stops > 1), **ignorar** el `center` prop y dejar que `fitBounds` controle la vista
- Incluir `secondaryPolylinePath` en el cálculo de bounds para cubrir todos los trazados visibles

### Cambio en `RoutePlanner.tsx`  
- Pasar `center` solo como fallback (cuando no hay datos para fitBounds)
- No pasar `zoom={12}` fijo — dejar que `fitBounds` calcule el zoom óptimo

| Archivo | Cambio |
|---------|--------|
| `MapView.tsx` | `fitBounds` ignora `center` cuando hay datos, incluir `secondaryPolylinePath` en bounds |
| `RoutePlanner.tsx` | No forzar `center`/`zoom` cuando hay ruta seleccionada |

