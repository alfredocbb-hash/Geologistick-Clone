## Problema

Cuando el chofer comparte por WhatsApp el link de seguimiento en vivo desde la app móvil (APK), el link sale como `https://localhost/tracking/ENV-...` y por lo tanto no abre nada en el celular del cliente.

Causa: en `src/pages/ActiveRouteNavigation.tsx` (línea 579) el link se arma con `window.location.origin`. En la app nativa Android (Capacitor), `window.location.origin` es `https://localhost`, no el dominio público.

## Solución

Reemplazar `window.location.origin` por una URL pública fija para el link de tracking que se comparte con clientes.

### Cambios

**`src/pages/ActiveRouteNavigation.tsx`** (función `whatsAppCustomer`, ~línea 574-583):

1. Detectar si estamos en plataforma nativa con `Capacitor.isNativePlatform()` (ya hay otros usos de Capacitor en el proyecto, ej. `useGeolocation`).
2. Usar siempre el dominio público `https://www.geologistick.com` como base del link (es el dominio custom configurado del proyecto y el que los clientes deben recibir).
   - Alternativa: usar `window.location.origin` solo cuando NO sea nativo y no sea `localhost`, y caer en `https://www.geologistick.com` en cualquier otro caso (nativo, localhost, preview).

Propuesta: usar siempre `https://www.geologistick.com/tracking/${trackingNum}` para el mensaje de WhatsApp del chofer, ya que ese es el dominio público real al que debe ir el cliente. Así se evita compartir links de preview o de localhost.

### Archivos tocados
- `src/pages/ActiveRouteNavigation.tsx` — solo la línea que arma `trackingLink`.

Sin cambios de backend ni de otras pantallas.

## Pregunta

¿Confirmás que el dominio público a usar es `https://www.geologistick.com`? Si preferís otro (por ej. `https://geologistick.com` sin `www`, o el `.lovable.app`), lo cambio.
