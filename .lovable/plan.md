

# Fix: Mostrar banner de vencimiento para suscripciones manuales

## Problema

Las funciones backend `check-subscription` y `mp-check-subscription` solo verifican suscripciones de Stripe o MercadoPago. Cuando el Super Admin asigna un plan manualmente (sin pasarela de pago), no hay `stripe_subscription_id` ni `mercadopago_subscription_id`, y las funciones devuelven `subscribed: false`. Esto causa que el banner de vencimiento nunca aparezca para esos tenants.

## Solucion

Agregar un fallback en ambas funciones para que, si existe un registro en `tenant_subscriptions` con status `active` y sin ID externo de pasarela, devuelvan los datos de suscripcion correctamente usando `current_period_end` de la base de datos.

## Detalle tecnico

### Archivo: `supabase/functions/check-subscription/index.ts`

Antes de la busqueda por email en Stripe (linea ~126), agregar un bloque que detecte si `existingSub` tiene status `active` sin `stripe_subscription_id` ni `mercadopago_subscription_id`. En ese caso, devolver directamente:

```text
{
  subscribed: true (si current_period_end > now),
  plan_name: del plan asociado,
  subscription_end: current_period_end,
  limits: del plan,
  usage: del tenant_usage
}
```

### Archivo: `supabase/functions/mp-check-subscription/index.ts`

Mismo cambio: antes del fallback a Stripe (linea ~122), si `existingSub` tiene status `active` sin IDs de pasarela, devolver los datos directamente desde la BD.

### Logica del fallback (en ambas funciones)

```text
Si existingSub existe
  Y existingSub.status = 'active'
  Y NO tiene stripe_subscription_id
  Y NO tiene mercadopago_subscription_id
Entonces:
  - Verificar si current_period_end > now()
  - Si si: subscribed = true con los datos del plan
  - Si no: subscribed = false (vencida)
```

No se requieren cambios en la base de datos ni en el frontend. El `TrialBanner` y `useSubscription` ya manejan correctamente los datos una vez que la funcion devuelve `subscribed: true` con `subscription_end`.
