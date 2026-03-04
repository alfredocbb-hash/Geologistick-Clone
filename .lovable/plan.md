

# Plan: Marcadores estilo delivery app + paradas de entrega en el mapa

## Resumen
Crear un marcador custom para choferes con aspecto similar a PedidosYa/Uber/Rappi (círculo con iniciales, pulso animado, color por estado), y cuando se seleccione un chofer, mostrar también sus paradas pendientes de entrega en el mapa.

## Cambios

### 1. Crear `src/components/maps/DriverMarker.tsx` (nuevo)
- Usa `OverlayView` de `@react-google-maps/api` para renderizar HTML custom sobre el mapa
- Círculo con iniciales del chofer (o ícono de camioneta si no hay nombre)
- Color del borde/fondo según estado:
  - Verde (`#22c55e`): activo (< 5 min)
  - Amarillo (`#eab308`): idle (5-15 min)
  - Gris (`#9ca3af`): sin señal (> 15 min)
- Animación CSS de pulso cuando está activo
- Al hacer click muestra InfoWindow con nombre, estado y ruta activa

### 2. Modificar `src/components/maps/MapView.tsx`
- Importar `DriverMarker`
- Cuando un marker tiene `icon === 'driver'`, renderizar `DriverMarker` en lugar del `Marker` estándar de Google
- Leer `marker.data` para obtener nombre, apellido, updated_at y ruta activa

### 3. Modificar `src/pages/LiveMap.tsx`
- En `driverMarkers` (línea ~297), agregar `data` con info del chofer (nombre, apellido, updated_at, ruta_activa)
- Cuando se selecciona un chofer (toggle route), cargar también las **paradas pendientes** de la ruta activa y agregarlas como markers adicionales en `mainMapMarkers`
- Crear un nuevo estado `pendingStopsMarkers` que se llene al hacer toggle de un chofer, consultando `ruta_paradas` + `envios` para obtener lat/lng de entregas pendientes
- Mostrar estas paradas con marcadores numerados (similar a `DeliveryStopMarker` pero para pendientes, con ícono distinto — naranja/rojo)

### 4. Agregar CSS de animación pulse en `src/index.css`
```css
@keyframes driver-pulse {
  0% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(2.2); opacity: 0; }
}
```

## Resultado visual
```text
  Mapa en Vivo
  ┌─────────────────────────────┐
  │                             │
  │     🟢 JD  (pulso)         │  ← Chofer activo con iniciales
  │           ↓                 │
  │     ──── ruta ────          │
  │     📍1  📍2  📍3          │  ← Paradas pendientes numeradas
  │                             │
  └─────────────────────────────┘
```

4 archivos: 1 nuevo (`DriverMarker.tsx`) + 3 modificados (`MapView.tsx`, `LiveMap.tsx`, `index.css`).

