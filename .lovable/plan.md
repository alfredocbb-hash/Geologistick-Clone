
## Objetivo

Nueva tarjeta "Conciliación" en `src/pages/Cash.tsx` que compare movimientos de caja con las otras fuentes reales del sistema (pagos, facturas, MP) para el día de la sesión abierta.

## Cambios

### 1. Nueva edge function `supabase/functions/cash-reconciliation/index.ts`
Autenticada. Recibe `{ sucursal_id, desde, hasta }`. Con service role devuelve por tenant del usuario:

- `pagos_por_metodo`: suma de `pagos.monto` con `estado IN ('pagado','cobrado_chofer','rendido')` agrupada por `metodo` en el rango, y para MP también `mercado_pago_status='approved'` cuando aplique.
- `facturas`: `SUM(importe_total) FILTER (WHERE es_nota_credito=false) - SUM(importe_total) FILTER (WHERE es_nota_credito=true)` de facturas con `estado='emitida'` en el rango, más `count`. Como `facturas` no guarda método de pago, el desglose por método se toma del `pago` asociado al `envio_id` (LEFT JOIN pagos): sumas `importe_total` agrupadas por `pagos.metodo`, y un bucket `sin_metodo` para las que no tienen pago vinculado.
- `mp_balance`: llama `GET https://api.mercadopago.com/users/me` + `GET https://api.mercadopago.com/v1/account/balance` con el access_token de `system_integrations` (mismo patrón que `mercadopago-check-status`). Si falla o no está configurado, devuelve `null` con `error`.
- `mp_cobros_dia`: `GET /v1/payments/search?range=date_created&begin_date=…&end_date=…&status=approved`, suma `transaction_amount` (paginando hasta 200) para el mismo rango. Devuelve total y cantidad.

Rango por defecto: día de apertura → ahora (usa `sesiones_caja.fecha_apertura`).

### 2. `src/pages/Cash.tsx` — nueva sección "Conciliación del día"
Se muestra debajo de "Resumen por Categoría" cuando hay `currentSession`. Usa `useQuery` que invoca la edge function.

Tarjetas:

**a) Cobros por método — Caja vs. Sistema**
Tabla comparativa por método (Efectivo, Transferencia, Mercado Pago, Tarjeta):
| Método | En Caja (ingresos) | En `pagos` (aprobados) | Diferencia |
Diferencia > 0.01 se pinta en `text-destructive` con ícono ⚠️.

**b) Facturación del día**
- Total facturado (neto de notas de crédito), cantidad de facturas.
- Desglose por método (a partir del pago asociado al envío) con las mismas columnas que arriba: Facturado vs. Cobrado en Caja vs. Diferencia.
- Bucket "Sin método asignado" si hay facturas sin pago vinculado.

**c) Mercado Pago real (API)**
- Saldo disponible actual de la cuenta MP (`available_balance`), moneda ARS.
- Cobros MP aprobados hoy según API, con comparación contra "MP en Caja" y "MP en `pagos`".
- Botón "Actualizar" que dispara `refetch`.
- Si MP no está configurado o falla el token: mensaje "Mercado Pago no configurado o token inválido" con link a `/settings/integrations`.

### 3. Sin cambios de datos

No se modifican esquemas. Sólo lectura. La sección se colapsa (accordion) por defecto para no saturar la vista.

## Notas técnicas

- `facturas` no tiene columna método; el desglose por método usa el `pago` del `envio_id`. Se documenta en el header de la tarjeta ("Método inferido del pago asociado al envío").
- El endpoint MP `/v1/account/balance` devuelve el saldo de la cuenta cuya `access_token` está guardada (típicamente el `collector_id` del tenant). Se muestra ese saldo tal cual, indicando "Cuenta: {nickname/collector_id}".
- Se reutiliza el patrón de token de `mercadopago-check-status` (prefer `production`, fallback `sandbox`).
- Rate limits MP: paginación de `payments/search` con `limit=200` y máximo 5 páginas por request para acotar costo.
