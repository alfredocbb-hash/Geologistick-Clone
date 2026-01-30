

# Plan: Corrección de 3 Bugs en la App del Chofer

## Problemas Identificados

| # | Problema | Causa |
|---|----------|-------|
| 1 | Al capturar foto vuelve al menú en vez del pedido | Uso incorrecto de `useState` para GPS + posible cierre prematuro del diálogo |
| 2 | Pestaña "Mapa" no hace nada | No hay `TabsContent` ni lógica que renderice la vista de mapa |
| 3 | Solo navega a la primera parada en Google Maps | Posible problema con la construcción de waypoints o límite de Google Maps (10 waypoints) |

---

## Corrección 1: Captura de Foto

**Archivo:** `src/components/delivery/DeliveryConfirmation.tsx`

**Problema técnico:** 
- Línea 62-77: Usa `useState(() => {...})` en lugar de `useEffect` para capturar GPS, lo cual es incorrecto
- La mutación llama `onSuccess()` y `onClose()` casi simultáneamente, lo que puede cerrar el diálogo antes de que el usuario vea el resultado

**Cambios:**
1. Cambiar `useState(() => {...})` por `useEffect(() => {...}, [])`
2. Asegurar que el flujo no cierre el diálogo prematuramente
3. Agregar mejor manejo de errores en la captura de foto

```typescript
// ANTES (incorrecto)
useState(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(...)
  }
});

// DESPUÉS (correcto)
useEffect(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(...)
  }
}, []);
```

---

## Corrección 2: Implementar Pestaña "Mapa"

**Archivo:** `src/pages/ActiveRouteNavigation.tsx`

**Problema técnico:**
- Hay un toggle entre `list` y `map` en el viewMode
- Pero no existe ningún código que use `viewMode === 'map'` para mostrar contenido diferente
- La pestaña "Mapa" existe en la UI pero no hace nada

**Cambios:**
1. Agregar renderizado condicional basado en `viewMode`
2. Cuando `viewMode === 'map'`, mostrar el componente `MapView` con todas las paradas como marcadores
3. Cuando `viewMode === 'list'`, mostrar la lista actual de paradas

```tsx
{viewMode === 'list' ? (
  // Contenido actual de lista
  <div className="px-4 space-y-2">
    {/* Lista de paradas */}
  </div>
) : (
  // Vista de mapa
  <div className="px-4">
    <MapView
      markers={stopsMarkers}
      height="calc(100vh - 250px)"
      onMarkerClick={(marker) => {
        // Seleccionar parada
      }}
    />
  </div>
)}
```

---

## Corrección 3: Navegación con Todas las Paradas

**Archivo:** `src/pages/ActiveRouteNavigation.tsx`

**Problema técnico:**
- La API de direcciones de Google Maps para URLs tiene un **límite de 10 waypoints**
- La codificación puede fallar si hay caracteres especiales
- Si hay más de 10 paradas pendientes, solo se muestran las primeras 10

**Cambios:**
1. Limitar waypoints a los primeros 9 + destino final
2. Mejorar la codificación de direcciones
3. Agregar advertencia si hay más de 10 paradas
4. Filtrar direcciones vacías o inválidas

```typescript
const navigateFullRoute = useCallback(() => {
  const pendingStops = envios
    .filter(e => {...})
    .map(e => {...})
    .filter(addr => addr && addr.trim().length > 5); // Filtrar vacíos

  if (pendingStops.length === 0) {
    toast.info('No hay paradas pendientes');
    return;
  }

  // Google Maps URL API solo soporta hasta 10 waypoints
  if (pendingStops.length > 10) {
    toast.warning(`Mostrando las primeras 10 de ${pendingStops.length} paradas`);
  }

  const limitedStops = pendingStops.slice(0, 10);
  const destination = encodeURIComponent(limitedStops[limitedStops.length - 1]);
  
  if (limitedStops.length > 1) {
    const waypoints = limitedStops
      .slice(0, -1)
      .map(addr => encodeURIComponent(addr))
      .join('|');
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}&travelmode=driving`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`, '_blank');
  }
}, [envios]);
```

---

## Resumen de Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/delivery/DeliveryConfirmation.tsx` | Cambiar `useState` por `useEffect` para GPS, mejorar flujo de cierre |
| `src/pages/ActiveRouteNavigation.tsx` | Implementar vista de mapa con marcadores, corregir función de navegación |

---

## Resultado Esperado

1. ✅ Al capturar foto, el chofer permanece en el diálogo hasta confirmar y ve el resultado
2. ✅ La pestaña "Mapa" muestra un mapa con todas las paradas como marcadores
3. ✅ Al navegar la ruta completa, Google Maps abre con todas las paradas (hasta 10) correctamente

