
El usuario pregunta por qué no se cargan los mapas en la APK y si puede estar desactualizada.

Causas posibles en APK Capacitor:
1. APK desactualizada — el `capacitor.config.ts` actual NO tiene `server.url` configurado, así que la APK usa `dist/` local. Cualquier cambio web requiere rebuild + `npx cap sync` + reinstalar APK.
2. La key de Google Maps en `system_integrations` puede tener restricción de **HTTP referrer** que bloquea `capacitor://localhost` / `https://localhost` (orígenes nativos).
3. La key puede no tener habilitadas las APIs necesarias (Maps JavaScript API, Places, Geometry) o tener restricción de paquete Android (SHA-1) sin incluir `com.geologic.choferapp`.
4. La APK puede no tener permiso `INTERNET` o estar bloqueando `cleartext` (improbable, ya que Google usa HTTPS).

Memoria existente confirma: `mem://mobile/google-maps-initialization` indica que app nativa va envuelta en `GoogleMapsProvider` y `mem://technical/tracking-publico-api-key-dinamica` recuerda no usar keys hardcodeadas. El flujo ya funciona en web (acabamos de verlo en EPOD), así que la key sí responde — el problema es específico al origen nativo.

## Plan

Esto es principalmente diagnóstico + configuración externa. No requiere cambios de código mayores.

### Pasos

1. **Confirmar si la APK está desactualizada**
   - Si bajaste la APK hace varios días y desde entonces se modificó código web (sí: cambios en EPOD, Footer, etc.), la APK NO refleja esos cambios porque `capacitor.config.ts` no tiene `server.url` apuntando al sandbox. La APK corre el bundle de `dist/` empacado en su momento.
   - **Acción del usuario**: hacer `git pull` → `npm install` → `npm run build` → `npx cap sync android` → reconstruir e instalar APK.

2. **Verificar restricciones de la API key de Google Maps** (causa más común)
   - En Google Cloud Console → APIs & Services → Credentials → tu key:
     - **Application restrictions**: si está como "HTTP referrers" o "Android apps" sin incluir el paquete `com.geologic.choferapp` + SHA-1 del keystore de la APK, va a fallar en nativo.
     - Para que funcione tanto en web como en APK Capacitor, lo más simple es: usar **dos keys separadas** (una con HTTP referrers para web, otra con package + SHA-1 para Android), o temporalmente poner la key como "None" para confirmar el diagnóstico.
   - **API libraries habilitadas**: Maps JavaScript API, Places API, Geometry, Static Maps API, Geocoding API, Directions API, Roads API.

3. **Revisar logs del dispositivo** (opcional, para confirmar)
   - Conectar el teléfono con `adb logcat | grep -i "maps\|chromium"` mientras se abre una pantalla con mapa para ver el error exacto (ej: `RefererNotAllowedMapError`, `ApiNotActivatedMapError`, etc.).

### Cambios de código
Ninguno necesario por ahora. El problema es de **configuración externa** (key restrictions) y/o **APK no rebuildeada**. Si después del diagnóstico se necesita un workaround (ej: detectar plataforma nativa y usar otra key), lo vemos en un segundo paso.

### Riesgo
Nulo — sólo guía de configuración y rebuild.
