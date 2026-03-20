

## Plan: Fixes para Tracking, Modo Flex y Scanner

### Problema 1: Error de mapa en Tracking publico

El componente `TrackingMap.tsx` usa una API key hardcodeada (`AIzaSyB41DRUbKWJHPxaFjMAwdrzWzbVKartNGg`) que no esta autorizada para el dominio `geologistick.com`. La solucion es usar la misma API key que ya se obtiene correctamente via `get-maps-config` (visible en los network requests: `AIzaSyCZYrjp7yCOVWeWh6pgMjkCJ0GmJNGbheU`).

**Archivo:** `src/components/tracking/TrackingMap.tsx`
- Importar `useMapsApiKey` y usar la key dinamica del tenant en vez de la hardcodeada
- Mostrar un fallback mientras carga o si no hay key

**Archivo:** `src/pages/Tracking.tsx` y `src/pages/TrackingEmbed.tsx`
- Wrappear con `GoogleMapsProvider` si no esta ya, o pasar la API key al `TrackingMap`
- Nota: estas paginas son publicas (sin auth), asi que `useMapsApiKey` no tendra session. Necesitamos que el `public-tracking` edge function devuelva tambien la maps API key, o usar la key del env var como fallback. La solucion mas simple: el `TrackingMap` recibe la API key como prop opcional, y `Tracking.tsx`/`TrackingEmbed.tsx` la extraen del response de tracking (que ya incluye `branding`).

**Solucion elegida:** Agregar `maps_api_key` al response de `public-tracking` edge function y pasarla como prop a `TrackingMap`. Esto evita requerir auth.

### Problema 2: Feedback de escaneo en Modo Flex + boton de colecta

Actualmente el scan agrega paquetes pero no da feedback visual suficiente. El usuario quiere:
- Toast/alerta visible cuando se escanea un paquete exitosamente
- Un boton flotante/contador que muestre cuantos paquetes hay escaneados
- Ese boton inicia la colecta

**Archivo:** `src/components/mobile/FlexScanScreen.tsx`
- Agregar toast de exito mas visible al escanear (ya existe en `useFlexPackages` pero es sutil)
- Mover el boton "COLECTAR TODOS" mas arriba, justo debajo del contador de paquetes, haciendolo mas prominente
- Agregar animacion al contador cuando se agrega un paquete nuevo

### Problema 3: Recuadro del scanner mas arriba

En la imagen 2, el recuadro de escaneo esta centrado verticalmente pero queda bajo, dificultando apuntar a etiquetas en mesas/estantes.

**Archivo:** `src/components/qr/QRScanner.tsx`
- Cambiar el area del scanner de `flex items-center justify-center` a `flex items-start justify-center pt-8` para que el recuadro suba
- Ajustar tanto el frame nativo como el web

### Resumen de archivos

| Archivo | Cambio |
|---------|--------|
| `src/components/tracking/TrackingMap.tsx` | Recibir API key como prop, eliminar key hardcodeada |
| `supabase/functions/public-tracking/index.ts` | Incluir maps API key en el response |
| `src/pages/Tracking.tsx` | Pasar maps_api_key del response al TrackingMap |
| `src/pages/TrackingEmbed.tsx` | Pasar maps_api_key del response al TrackingMap |
| `src/components/mobile/FlexScanScreen.tsx` | Reorganizar: contador + boton colecta prominente arriba, mejor feedback |
| `src/components/qr/QRScanner.tsx` | Subir el recuadro de escaneo (padding-top en vez de centrado) |

