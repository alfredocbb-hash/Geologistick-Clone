
## Problema

Los webhooks de Mercado Libre están fallando en dos frentes visibles en los logs:

1. **Race condition en el refresh de tokens** — ML envía múltiples webhooks casi simultáneos para el mismo seller. Todos los workers ven el token expirado y disparan `refresh_token` en paralelo. Como ML invalida el `refresh_token` apenas se usa una vez, sólo el primero triunfa; el resto recibe `invalid_grant` y termina con "Token refresh failed" → "Could not get valid access token" → el webhook responde 401 y **no se actualizan los estados**.
2. **Sellers inactivos** — `KINGDOM VINTAGE` (user_id 222370892) y `RUEDAS NG` (user_id 70517482) tienen `activo=false`, por eso salen "Seller not found". Si el usuario quiere que sincronicen, hay que reactivarlos.

## Cambios

### 1. `supabase/functions/mercadolibre-webhook/index.ts`
Al fallar el `POST /oauth/token`:
- Loguear `status` + body real de ML (hoy sólo dice "failed" a ciegas).
- Esperar ~500ms, releer `ecommerce_seller_tokens` para ese seller.
- Si otro worker ya guardó un token vigente → devolverlo.
- Si el `refresh_token` en la tabla cambió respecto al que usamos → reintentar el refresh con el nuevo.
- Sólo devolver `null` si ambas rutas fallan.

### 2. `supabase/functions/_shared/ml-tokens.ts`
Aplicar el mismo patrón (log + re-read + retry) en `getValidMLAccessToken` para que también se beneficien `mercadolibre-sync` y el resto de funciones que ya usan el helper compartido.

### 3. Datos
Confirmar con el usuario si reactivamos (`activo=true`) los sellers **KINGDOM VINTAGE** y **RUEDAS NG**, o si se desconectan definitivamente de ML (en cuyo caso conviene desregistrar el webhook del lado de ML para no seguir recibiendo notificaciones inútiles).

## Fuera de alcance
- No se toca la lógica de mapeo de estados ni el flujo de `mercadolibre-sync` más allá del helper compartido.
- No se cambia el esquema de `ecommerce_seller_tokens`.

## Verificación
- Después de deploy: mirar `edge_function_logs` de `mercadolibre-webhook` por 5 minutos y confirmar que los "Token refresh failed" concurrentes se reemplazan por "Recovered fresh token from concurrent refresh" o refresh exitoso, y que llegan updates de estado a `envios`.
