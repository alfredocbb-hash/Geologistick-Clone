

# Notificaciones automaticas de vencimiento de suscripcion

## Situacion actual

- Solo existe un banner visual para el periodo de prueba (trial), no para suscripciones pagas.
- Las notificaciones de suscripcion se envian manualmente por el Super Admin.
- No hay ningun proceso automatico que avise antes del vencimiento.
- Las notificaciones no desaparecen cuando se registra un pago.

## Solucion propuesta

Crear un sistema automatico que:
1. Notifique a los admins de cada tenant **5 dias antes** del vencimiento de su suscripcion.
2. Evite enviar notificaciones duplicadas.
3. Las notificaciones de vencimiento se marquen automaticamente como resueltas cuando se registra/renueva el pago.

### 1. Edge Function: `notify-subscription-expiry`

Una funcion backend que revise las suscripciones proximas a vencer y envie notificaciones automaticas.

Logica:
- Buscar en `tenant_subscriptions` las suscripciones activas con `current_period_end` entre hoy y hoy + 5 dias.
- Para cada una, verificar si ya se envio una notificacion de tipo "subscription_expiry" para ese periodo (usando un campo `link` con un identificador unico como `subscription-expiry-{tenant_id}-{YYYY-MM}`).
- Si no existe, insertar una notificacion para todos los admins del tenant con titulo "Tu suscripcion vence pronto" y un mensaje indicando la fecha.
- Tambien notificar si ya vencio (current_period_end < hoy).

### 2. Cron Job (pg_cron)

Programar la ejecucion diaria de la Edge Function (una vez al dia es suficiente).

```text
Frecuencia: 0 9 * * * (todos los dias a las 9:00 UTC)
```

### 3. Auto-limpiar notificaciones al renovar

Cuando el Super Admin registra un pago o asigna un plan (en `SuperAdminSubscriptionManager`), marcar como leidas las notificaciones de vencimiento pendientes de ese tenant. Esto se hace buscando notificaciones con `link` que contenga `subscription-expiry-{tenant_id}` y `read = false`, y actualizandolas a `read = true`.

### 4. Banner de vencimiento para suscripciones pagas

Extender el `TrialBanner` existente para que tambien muestre un aviso cuando la suscripcion paga esta por vencer (usando `daysRemaining` del hook `useSubscription`), no solo para trials.

## Detalle tecnico

| Archivo | Cambio |
|---|---|
| `supabase/functions/notify-subscription-expiry/index.ts` | Nueva Edge Function que busca suscripciones por vencer y crea notificaciones |
| `src/components/subscriptions/SuperAdminSubscriptionManager.tsx` | Al asignar plan o registrar pago, marcar como leidas las notificaciones de vencimiento del tenant |
| `src/components/trial/TrialBanner.tsx` | Extender para mostrar aviso de vencimiento de suscripcion paga (no solo trial) |
| SQL (cron job) | Programar ejecucion diaria de la funcion |

### Flujo completo

```text
Dia -5: Cron ejecuta notify-subscription-expiry
        -> Encuentra tenant con vencimiento en 5 dias
        -> Inserta notificacion para admins del tenant
        -> Admins ven la notificacion en su popover + banner

Dia 0:  Si no pago, se envia notificacion de "suscripcion vencida"

Pago:   Super Admin asigna plan / registra pago
        -> Se marcan como leidas las notificaciones de vencimiento
        -> El banner desaparece porque la suscripcion se renueva
```

### Logica de la Edge Function

```text
1. Buscar tenant_subscriptions WHERE status = 'active'
   AND current_period_end BETWEEN now() AND now() + 5 days

2. Para cada resultado:
   a. Generar link_id = 'subscription-expiry-{tenant_id}-{YYYY-MM}'
   b. Verificar si ya existe notificacion con ese link
   c. Si no existe:
      - Buscar admins del tenant (user_roles.role = 'admin')
      - Insertar notificacion por cada admin

3. Buscar suscripciones vencidas (current_period_end < now())
   y enviar notificacion similar si no existe
```

No se requieren cambios en la estructura de la base de datos. Se usa el campo `link` existente en la tabla `notifications` como identificador para evitar duplicados y para poder limpiar las notificaciones al renovar.
