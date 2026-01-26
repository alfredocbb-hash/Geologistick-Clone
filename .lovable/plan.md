
## Qué está pasando (por qué “sigue sin funcionar”)

El 404 que ve el seller **ya no es de nuestro backend**, es de **Tiendanube**.

En la captura se ve que el navegador termina en:

`https://www.tiendanube.com/apps/authorize/token?...`

Ese endpoint **/apps/authorize/token** es el de **intercambio de token (POST)**, y **no sirve** como página de autorización (GET). Por eso Tiendanube responde “No encontramos lo que estás buscando”.

## Objetivo

Cuando el seller abre el link (desde WhatsApp o email), nuestro backend debe redirigirlo a la URL correcta de autorización:

`https://www.tiendanube.com/apps/{client_id}/authorize?...`

Ejemplo esperado con tu client_id:
`https://www.tiendanube.com/apps/25408/authorize?redirect_uri=...&response_type=code&state=...`

## Cambios a implementar

### 1) Corregir la URL de autorización (Edge Function tiendanube-oauth)
**Archivo:** `supabase/functions/tiendanube-oauth/index.ts`

**Cambio puntual:**
- Reemplazar esta línea (incorrecta para GET):
  - `new URL(`${TIENDANUBE_API_BASE}/apps/authorize/token`)`
- Por la ruta correcta:
  - `new URL(`${TIENDANUBE_API_BASE}/apps/${clientId}/authorize`)`

**Además:**
- Mantener `redirect_uri`, `response_type=code` y `state` como query params.
- Quitar `client_id` como query param (no es necesario para el authorize; va en el path).

### 2) Mejorar el mensaje de error cuando falte config (UX)
Ya que este flujo lo usa un seller externo, cambiaremos las respuestas de error “JSON crudo” por una **página HTML amigable** cuando:
- Falte `seller_id`
- No exista seller
- No esté configurado `client_id / client_secret`
- El seller no sea plataforma `tiendanube`

(Esto evita que el seller vea errores técnicos.)

### 3) Verificación / Prueba rápida
Después del cambio:

**Prueba técnica (sin Tiendanube):**
- Llamar al endpoint `/tiendanube-oauth/authorize?seller_id=...` y verificar que responda `302`
- Confirmar que el header `Location` apunte a:
  - `/apps/25408/authorize?...`

**Prueba real (con seller):**
- Reenviar el link por WhatsApp
- El seller debe caer en pantalla de autorización de Tiendanube (no 404)
- Luego de “Autorizar”, debe volver al callback y mostrar “✓ Tienda conectada exitosamente”

## Posibles causas adicionales (por si aún fallara luego)
Si tras corregir el endpoint aún falla, las dos causas más comunes son:
1) En Tiendanube Partners, la “Página de la aplicación / Redirect URI” no coincide exactamente con el callback que usamos.
2) El client_id que está guardado en Integraciones no coincide con el de la app (aunque por tu captura parece que sí: 25408).

## Archivos involucrados
- `supabase/functions/tiendanube-oauth/index.ts` (modificar)

## Resultado esperado para el negocio
- El admin envía link por WhatsApp/email
- El seller abre desde su propio dispositivo y autoriza sin compartir credenciales
- Conexión y sincronización quedan listas sin intervención del admin
