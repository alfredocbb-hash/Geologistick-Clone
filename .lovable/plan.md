

## Plan: Tracking live con geofencing 4km, auto-formateo de telefonos, y limpieza de mapa publico

### Problema 1: Quitar mapa estatico del tracking publico + geofencing 4km

El mapa publico tiene una API key no autorizada y ademas no queres que se muestre. Solo mostrar el mapa en vivo cuando el chofer este a menos de 4km del destino.

**Cambios:**

1. **`src/pages/Tracking.tsx`** y **`src/pages/TrackingEmbed.tsx`**: Eliminar el componente `TrackingMap` completamente. Solo mostrar `LiveDriverMap` cuando `estado === 'en_reparto'`.

2. **`src/components/tracking/TrackingMap.tsx`**: Se puede dejar o eliminar (ya no se usa).

3. **`supabase/functions/public-tracking-live/index.ts`**: Agregar calculo de distancia entre driver y destino. Solo devolver `live: true` si la distancia es <= 4km. Usar formula Haversine para calcular distancia sin APIs externas.

4. **`src/components/tracking/LiveDriverMap.tsx`**: Quitar la API key hardcodeada (`AIzaSyB41DRUb...`). Obtener la `maps_api_key` del response de `public-tracking-live` (que a su vez la busca de `system_integrations` igual que `public-tracking`). Agregar `maps_api_key` al response del edge function.

### Problema 2: Auto-formateo de telefonos para WhatsApp

Hay un bug critico en `formatArgentinaPhone`: el regex `[^\\d]` esta escapado mal (doble backslash en un string normal JS), por lo que no limpia digitos correctamente. Ademas, el formateo solo ocurre en `onBlur` del `PhoneInput`, pero si el usuario nunca usa ese componente o el telefono viene de otra fuente (CSV import, autocomplete de cliente), el numero queda sin formatear.

**Cambios:**

1. **`src/components/ui/phone-input.tsx`**: Corregir el regex de `[^\\d]` a `[^\d]` (o usar `\D`) tanto en `formatArgentinaPhone` como en `isValidArgentinePhone`.

2. **`src/pages/ActiveRouteNavigation.tsx`**: En `whatsAppCustomer`, antes de hacer `phone.replace(/\D/g, '')`, aplicar `formatArgentinaPhone` al numero para normalizarlo. Asi funciona correctamente incluso si el numero fue cargado sin el prefijo.

3. **`src/components/livemap/DriverDetailPanel.tsx`**: Igual, aplicar formateo antes de construir el link `wa.me`.

4. **`src/pages/NewShipment.tsx`**: Ya usa `formatArgentinaPhone` al guardar — solo necesita el fix del regex.

5. **`src/components/import/ImportShipmentsDialog.tsx`**: Al importar CSV, aplicar `formatArgentinaPhone` al campo de telefono del destinatario antes de guardarlo.

### Resumen de archivos

| Archivo | Cambio |
|---------|--------|
| `src/components/ui/phone-input.tsx` | Fix regex `\\d` -> `\d` |
| `supabase/functions/public-tracking-live/index.ts` | Geofencing 4km + incluir maps_api_key |
| `src/components/tracking/LiveDriverMap.tsx` | Usar maps_api_key del response, quitar key hardcodeada |
| `src/pages/Tracking.tsx` | Quitar TrackingMap estatico |
| `src/pages/TrackingEmbed.tsx` | Quitar TrackingMap estatico |
| `src/pages/ActiveRouteNavigation.tsx` | Formatear phone antes de wa.me |
| `src/components/livemap/DriverDetailPanel.tsx` | Formatear phone antes de wa.me |
| `src/components/import/ImportShipmentsDialog.tsx` | Formatear telefono al importar CSV |

### Migracion DB
No se requiere.

