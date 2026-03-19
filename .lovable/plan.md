

## Fase 7: Tracking en vivo para destinatarios vía WhatsApp

### Resumen
Cuando el chofer toca "WhatsApp" en la navegación de ruta, el mensaje incluirá un link de tracking en vivo donde el destinatario podrá ver la ubicación del repartidor en tiempo real sobre un mapa, junto con el estado del envío.

### Arquitectura

```text
Chofer toca "WhatsApp"
  → Genera link: /tracking/{tracking_number}?live=1
  → Mensaje: "Hola X, soy el repartidor. Estoy llegando con su envío. Seguí mi ubicación en vivo: {link}"

Destinatario abre el link
  → Página pública de tracking (ya existente)
  → Nueva sección: mapa en vivo con ubicación del chofer (si estado = en_reparto)
  → Se actualiza cada 10s vía polling al edge function
```

### Cambios necesarios

**1. Nueva edge function `public-tracking-live`**
- Endpoint público (sin JWT) que recibe `tracking_number`
- Busca el envío, valida que esté `en_reparto`
- Busca la ubicación actual del chofer asignado en `driver_locations`
- Retorna: `{ lat, lng, updated_at, estado, tracking_number }` (solo datos mínimos, sin PII)
- Rate limit básico: no más de 1 request por segundo por IP (in-memory)

**2. Modificar `ActiveRouteNavigation.tsx`**
- Actualizar `whatsAppCustomer` para incluir el link de tracking en vivo
- El link será `{window.location.origin}/tracking/{tracking_number}`
- El mensaje incluirá: "Seguí mi ubicación en vivo: {link}"

**3. Modificar `src/pages/Tracking.tsx`**
- Agregar sección de "Tracking en vivo" cuando el estado es `en_reparto`
- Nuevo componente `LiveDriverMap` que:
  - Hace polling cada 10s a `public-tracking-live`
  - Muestra mapa con marcador del chofer (posición actual) y marcador del destino
  - Muestra "Última actualización: hace X segundos"
  - Se oculta automáticamente cuando el estado ya no es `en_reparto`

**4. Nuevo componente `src/components/tracking/LiveDriverMap.tsx`**
- Mapa Google Maps embebido con dos marcadores (chofer + destino)
- Polling automático con `useQuery` + `refetchInterval: 10000`
- Indicador visual de "En vivo" con punto pulsante
- Fallback si no hay ubicación disponible

### Detalles técnicos

- **Sin tablas nuevas**: usa `driver_locations` existente (ya se actualiza cada 10s durante ruta activa)
- **Sin autenticación**: el edge function es público, pero solo expone lat/lng del chofer (sin nombre ni datos personales)
- **Seguridad**: requiere tracking_number completo (≥8 chars), solo funciona si el envío está `en_reparto`
- **Config TOML**: agregar `[functions.public-tracking-live]` con `verify_jwt = false`

