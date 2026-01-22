

# Plan: Corregir Visualización del Recorrido en Mapa

## Problema Identificado

El mapa muestra el diálogo correctamente y los datos existen (10+ puntos GPS, snap-to-roads funciona), pero **el polyline no se ve** porque:

1. El `fitBounds` del `MapView` solo considera los **markers**, no el **polylinePath**
2. El zoom inicial (14) es demasiado alto para rutas que abarcan 30+ km
3. El mapa no ajusta sus límites para incluir todos los puntos del recorrido

---

## Solución

Modificar el `MapView.tsx` para incluir también los puntos del `polylinePath` en el cálculo de bounds, garantizando que toda la ruta sea visible.

---

## Cambios Técnicos

### Archivo: `src/components/maps/MapView.tsx`

#### 1. Actualizar el `useEffect` de fitBounds para incluir polylinePath

**Antes (líneas 114-128):**
```typescript
useEffect(() => {
  if (!map || markers.length === 0) return;
  // Solo considera markers
}, [map, markers, zoom]);
```

**Después:**
```typescript
useEffect(() => {
  if (!map) return;
  
  const hasMarkers = markers.length > 0;
  const hasPolyline = polylinePath.length > 0;
  
  if (!hasMarkers && !hasPolyline) return;

  const bounds = new google.maps.LatLngBounds();
  
  // Incluir markers en bounds
  markers.forEach((marker) => {
    bounds.extend(marker.position);
  });
  
  // Incluir puntos del polyline en bounds
  polylinePath.forEach((point) => {
    bounds.extend(point);
  });

  // Si solo hay 1 punto total, centrar y hacer zoom
  if (markers.length <= 1 && polylinePath.length <= 1) {
    const singlePoint = markers[0]?.position || polylinePath[0];
    if (singlePoint) {
      map.setCenter(singlePoint);
      map.setZoom(zoom);
    }
  } else {
    // Ajustar a todos los puntos con padding
    map.fitBounds(bounds, 50);
  }
}, [map, markers, polylinePath, zoom]);
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/maps/MapView.tsx` | Actualizar fitBounds para incluir polylinePath |

---

## Resultado Esperado

1. Al abrir "Ver recorrido", el mapa ajustará automáticamente el zoom para mostrar **todo el trayecto**
2. La línea azul (Polyline) será visible desde el punto de inicio hasta el punto final
3. Los marcadores de inicio (verde) y posición actual (camión) estarán visibles
4. El zoom se ajustará dinámicamente según la distancia del recorrido

---

## Diagrama de Antes vs Después

```text
ANTES:                              DESPUÉS:
┌─────────────────────┐            ┌─────────────────────┐
│                     │            │    ○ Inicio         │
│    Buenos Aires     │            │    │                │
│    (zoom muy alto)  │            │    ↓ ←─ Polyline    │
│                     │            │    │    visible     │
│  Sin polyline       │            │    ↓                │
│  visible            │            │    ○ Actual         │
│                     │            │                     │
└─────────────────────┘            └─────────────────────┘
     Markers y                          Mapa ajustado
     polyline fuera                     a todo el
     del viewport                       recorrido
```

---

## Notas Adicionales

- El cambio es retrocompatible: si no hay polyline, sigue funcionando solo con markers
- El padding de 50px asegura que los puntos no queden en el borde del mapa
- Esto también mejorará la visualización en otros usos del MapView

