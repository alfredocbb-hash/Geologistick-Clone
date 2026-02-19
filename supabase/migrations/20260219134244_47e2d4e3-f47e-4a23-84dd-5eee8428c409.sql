-- Sincronizar sellers como clientes con cuenta corriente
-- Paso A: Habilitar tiene_cuenta_corriente en clientes vinculados a sellers con cta cte activa
-- y sincronizar el límite de crédito
UPDATE clientes c
SET 
  tiene_cuenta_corriente = true,
  limite_credito = GREATEST(COALESCE(c.limite_credito, 0), COALESCE(es.limite_credito, 0)),
  -- Sincronizar también el saldo con el de ecommerce_sellers (fuente de verdad)
  saldo_cuenta_corriente = COALESCE(es.saldo_cuenta_corriente, 0),
  updated_at = NOW()
FROM ecommerce_sellers es
WHERE es.cliente_id = c.id
  AND es.tiene_cuenta_corriente = true
  AND (
    c.tiene_cuenta_corriente IS DISTINCT FROM true
    OR COALESCE(c.limite_credito, 0) < COALESCE(es.limite_credito, 0)
    OR COALESCE(c.saldo_cuenta_corriente, 0) != COALESCE(es.saldo_cuenta_corriente, 0)
  );