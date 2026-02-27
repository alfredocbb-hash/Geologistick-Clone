
# Fix: Suscripciones de cobro por Mercado Pago

## Problemas detectados

El sistema de suscripciones por Mercado Pago ya existe pero tiene **3 bugs criticos** que impiden que funcione:

### Bug 1: Columnas incorrectas en las queries
Las 4 edge functions (`mp-create-subscription`, `mp-check-subscription`, `mp-cancel-subscription`, `mp-subscription-webhook`) consultan `system_integrations` usando columnas `key` y `value`, pero las columnas reales son `config_key` y `config_value`. Ademas usan `.eq("type", "mercado_pago")` pero la columna se llama `integration_type`.

### Bug 2: Credenciales MP del tenant equivocado
Las funciones buscan las credenciales de MP en el tenant del usuario que se suscribe. Pero para cobrar suscripciones SaaS, se necesitan las credenciales de MP del **dueño de la plataforma** (tu cuenta). La solucion es usar un secret de entorno (`MP_SUBSCRIPTION_ACCESS_TOKEN`) para las suscripciones, independiente de la config de cada tenant.

### Bug 3: No se crea el registro en `tenant_subscriptions`
`mp-create-subscription` crea la suscripcion en MP pero nunca inserta el registro en la tabla `tenant_subscriptions`, por lo que `mp-check-subscription` no puede encontrarlo despues.

## Solucion

### 1. Agregar secret `MP_SUBSCRIPTION_ACCESS_TOKEN`
Se pedira tu access token de Mercado Pago para cobrar suscripciones. Este es diferente del que cada tenant configura para sus propios cobros.

### 2. Corregir `mp-create-subscription`
- Usar `MP_SUBSCRIPTION_ACCESS_TOKEN` del entorno en lugar de buscar en `system_integrations`
- Insertar registro en `tenant_subscriptions` con el `mercadopago_subscription_id` devuelto por MP
- Corregir la `back_url` para redirigir correctamente

### 3. Corregir `mp-check-subscription`
- Usar `MP_SUBSCRIPTION_ACCESS_TOKEN` del entorno
- Corregir nombres de columnas (`config_key`/`config_value`, `integration_type`)

### 4. Corregir `mp-cancel-subscription`
- Usar `MP_SUBSCRIPTION_ACCESS_TOKEN` del entorno
- Corregir nombres de columnas

### 5. Corregir `mp-subscription-webhook`
- Usar `MP_SUBSCRIPTION_ACCESS_TOKEN` del entorno
- Manejar suscripciones nuevas que llegan por webhook (crear registro en `tenant_subscriptions` si no existe, parseando el `external_reference`)

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| Secret `MP_SUBSCRIPTION_ACCESS_TOKEN` | Nuevo secret con el access token de tu cuenta de MP |
| `supabase/functions/mp-create-subscription/index.ts` | Usar secret, corregir columnas, insertar en `tenant_subscriptions` |
| `supabase/functions/mp-check-subscription/index.ts` | Usar secret, corregir columnas |
| `supabase/functions/mp-cancel-subscription/index.ts` | Usar secret, corregir columnas |
| `supabase/functions/mp-subscription-webhook/index.ts` | Usar secret, manejar nuevas suscripciones |

## Flujo corregido

```text
1. Admin del tenant va a /subscription
2. Elige plan y hace clic en "Suscribirse"
3. mp-create-subscription:
   - Usa MP_SUBSCRIPTION_ACCESS_TOKEN (tu cuenta)
   - Crea preapproval en MP
   - Inserta registro en tenant_subscriptions
   - Devuelve URL de pago
4. Usuario paga en MP
5. Webhook actualiza estado en tenant_subscriptions
6. mp-check-subscription verifica estado periodicamente
```
