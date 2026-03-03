

# Plan: Implementar pantalla "Iniciar Jornada" (Check-in obligatorio)

La tabla `driver_checkins` ya existe. Falta crear el frontend completo.

## Archivos a crear

### 1. `src/hooks/useCheckIn.ts`
- Query a `driver_checkins` filtrando `chofer_id = user.id` y `fecha = hoy (YYYY-MM-DD)`
- Retorna `{ checkedIn: boolean, isLoading: boolean, invalidate() }`

### 2. `src/components/mobile/CheckInScreen.tsx`
- Pantalla fullscreen oscura con botón grande "Iniciar Jornada"
- Al tocar: obtiene GPS (Capacitor o navigator.geolocation)
- Inserta en `driver_checkins` con lat/lng/accuracy/device_info
- También hace upsert en `driver_locations` para sincronizar posición
- Muestra spinner mientras procesa, toast de éxito/error

## Archivo a modificar

### 3. `src/components/mobile/MobileAppLayout.tsx`
- Importar `useCheckIn` y `CheckInScreen`
- Después del check de permisos (línea 98), si `userRole === 'chofer'` y `!checkedIn`, renderizar `<CheckInScreen onCheckInComplete={invalidate} />` en lugar del contenido normal

## Flujo resultante
1. Chofer abre la app → splash → permisos → **pantalla "Iniciar Jornada"**
2. Toca botón → GPS + registro en DB → app se desbloquea
3. Si ya hizo check-in hoy → pasa directo al home

## LiveMap (ya implementado parcialmente)
El badge de check-in en LiveMap se abordará en un paso posterior si se desea.

