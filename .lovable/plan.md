

# Plan: Movimiento en tiempo real del marcador del chofer (estilo PedidosYa)

## Situación actual

Ya tenemos los bloques fundamentales:
- **`useGeolocation.ts`**: El celular del chofer envía su GPS cada 10-15s a la tabla `driver_locations` via upsert.
- **`LiveMap.tsx`**: Suscripción realtime a `driver_locations` via `postgres_changes` — pero al recibir un cambio, hace `refetchDrivers()` completo, lo que reconstruye los markers y el ícono "salta" instantáneamente.
- **`DriverMarker.tsx`**: Usa `OverlayView` con posición fija — no hay interpolación entre posiciones.

## Qué falta para que se mueva como PedidosYa

### 1. Animación suave del marcador (interpolación de posición)

**Modificar `src/components/maps/DriverMarker.tsx`**:
- Guardar la posición anterior en un `useRef`.
- Cuando cambia `position`, interpolar entre la posición vieja y la nueva usando `requestAnimationFrame` durante ~1 segundo.
- Calcular el ángulo de dirección (heading) para rotar el ícono en la dirección del movimiento.
- Usar un `div` con `transition` CSS o animación JS frame-by-frame para mover el `OverlayView` suavemente.

Técnica: En lugar de pasar `position` directo al `OverlayView`, mantener un `animatedPosition` en state que se actualiza gradualmente:
```text
Posición A ───interpolación 1s──→ Posición B
  (vieja)                          (nueva del GPS)
```

### 2. Actualización realtime más eficiente (sin refetch completo)

**Modificar `src/pages/LiveMap.tsx`**:
- En el listener de `postgres_changes`, en vez de llamar `refetchDrivers()` (que hace un query completo), actualizar directamente el state `driverLocations` con el payload del evento.
- Esto evita el parpadeo de "desmontar y remontar" markers, permitiendo que `DriverMarker` reciba la nueva posición como prop update y anime la transición.

```text
Antes:  postgres_changes → refetchDrivers() → nuevo array → remonta markers → salto
Ahora:  postgres_changes → merge payload → mismos markers → prop update → animación suave
```

### 3. Rotación del ícono según dirección

**Modificar `src/components/maps/DriverMarker.tsx`**:
- Calcular el bearing entre posición anterior y nueva.
- Aplicar `transform: rotate(Xdeg)` al ícono del marcador.
- Esto da el efecto de que el "auto" gira hacia donde va.

### 4. (Ya implementado) Backend del chofer

El `useGeolocation.ts` ya maneja:
- GPS cada 10s con ruta activa, 15s sin ruta
- Filtro de accuracy > 50m
- Umbral de movimiento mínimo (3-5m)
- Upsert a `driver_locations` + insert a `driver_location_history`

No se necesitan cambios en el backend/hook del chofer.

## Archivos a modificar

1. **`src/components/maps/DriverMarker.tsx`** — Agregar interpolación de posición con `requestAnimationFrame`, cálculo de heading, y rotación del ícono
2. **`src/pages/LiveMap.tsx`** — Cambiar el realtime handler para hacer merge directo al state en vez de refetch completo

2 archivos modificados. Sin cambios de base de datos.

