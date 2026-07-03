## Objetivo

Asegurar que el **saldo real de Mercado Pago** aparezca correctamente en la sección "Conciliación del día" del módulo Caja para BeraExpress (que ya tiene el token de MP configurado en producción).

## Diagnóstico

Verifiqué que:
- BeraExpress (`tenant_id: 94a9ea85-...`) tiene `access_token` activo en `system_integrations` para MP producción (`APP_USR-...`).
- La edge function `cash-reconciliation` está desplegada y bootea correctamente.
- La lógica actual llama a `GET https://api.mercadopago.com/v1/account/balance`, pero este endpoint es inestable — a menudo devuelve 404 o un payload que no incluye `available_balance` (según el tipo de cuenta y credenciales usadas). Cuando eso pasa, el card muestra `—` en "Saldo disponible MP" y no queda claro por qué.

Además no hay logs propios en el edge function que ayuden a debuggear, y el `mp_error` que se muestra al usuario es genérico ("MP balance HTTP 404").

## Cambios

### 1. `supabase/functions/cash-reconciliation/index.ts` — obtención robusta del saldo MP

- Después de obtener `me` (`/users/me`) usar el `me.id` (collector_id) para intentar primero el endpoint recomendado para cuentas propias:
  - `GET https://api.mercadopago.com/users/{collector_id}/mercadopago_account/balance`
  - Este endpoint devuelve `{ total_amount, available_balance, unavailable_balance }` para el titular de la cuenta.
- Si falla (401/403/404), hacer fallback a `GET /v1/account/balance` (comportamiento actual).
- Normalizar la respuesta a `{ available, total, unavailable, currency, nickname, collector_id }` — leyendo `available_balance` (prioritario), `total_amount` o `amount` según cuál esté presente.
- Loggear (`console.log`) cada intento con endpoint + status para que quede rastro en los edge logs. No loggear el token.
- Loggear también el `me.nickname` y la `environment` (production/sandbox) elegida.
- Mejorar `mp_error` para incluir el endpoint que falló y un mensaje legible (ej: "No se pudo obtener el saldo MP (endpoint balance 404). Verificá que el token sea de la cuenta titular.").

### 2. `src/components/cash/ReconciliacionCard.tsx` — mostrar más info del saldo

- Extender el tipo `mp_balance` con `total` y `unavailable` opcionales.
- En el card "Saldo disponible MP", si viene `total` distinto de `available`, mostrar también en pequeño: "Total: $X · Retenido: $Y".
- Mostrar el `nickname` y `collector_id` juntos cuando estén disponibles ("Cuenta: NICKNAME · ID 12345").
- Si `mp_error` está presente pero `mp_balance` también, mostrar ambos (nota de advertencia debajo del saldo).

### 3. Verificación

Después de deployar, abrir la sección "Conciliación del día" en `/cash` y confirmar que:
- Aparece el nickname/ID de la cuenta MP de BeraExpress.
- Aparece un monto en "Saldo disponible MP" (distinto de `—`).
- Aparece un valor en "Cobros MP aprobados (rango)".

Si aún falla, revisar los logs del edge function `cash-reconciliation` (ahora tendrán detalle suficiente) y decidir el siguiente paso.

## Fuera de alcance

- No se toca el esquema de la BD ni las políticas RLS.
- No se cambia dónde/cómo se configura el token MP (Ajustes → Integraciones sigue igual).
- No se toca la lógica de conciliación por método (esa parte ya funciona).
