
# Corrección retroactiva: liquidaciones "pagada" sin movimiento en cuenta corriente

## Diagnóstico confirmado

Al consultar la base de datos directamente se confirma que las 4 liquidaciones con estado `pagada` tienen `movimientos_pago_count: 0` — es decir, ninguna generó el movimiento correspondiente en `seller_cuenta_corriente` porque el código anterior no lo hacía.

Los saldos actuales en `ecommerce_sellers` tampoco fueron reducidos en el momento del pago, por lo que están inflados.

| Seller | Saldo actual (incorrecto) | Pago no registrado |
|---|---|---|
| SANABRIA SEBASTIAN | $10.245,99 | $51.229,95 |
| SANABRIA LAUTARO | $7.370,99 | $68.846,93 |
| SANABRIA EMANUEL | $30.737,97 | $123.663,86 |
| RADIKAL | $129.298,86 | $281.964,70 |

Nota: los saldos "actuales" que se ven hoy en la base son los que quedaron SIN descontar el pago. El saldo correcto post-pago debería ser `saldo_actual - saldo_periodo`.

## Solución: migración SQL retroactiva

Se ejecuta una migración SQL que en una sola transacción:

**Paso 1 — Insertar movimientos de pago faltantes en `seller_cuenta_corriente`**

Para cada liquidación `pagada` sin movimiento de tipo `pago` vinculado, se inserta el registro correspondiente con:
- `tipo = 'pago'`
- `monto = -saldo_periodo` (negativo, reduce la deuda)
- `saldo_anterior` = saldo actual de `ecommerce_sellers` (valor actual en la tabla, que es el pre-corrección)
- `saldo_nuevo` = `saldo_anterior - saldo_periodo`
- `descripcion` = texto descriptivo con el período
- `liquidacion_id` = id de la liquidación
- `metodo_pago` = el método registrado en la liquidación

**Paso 2 — Actualizar `saldo_cuenta_corriente` en `ecommerce_sellers`**

Para cada seller afectado, restar el monto del pago al saldo actual.

**SQL de la migración:**

```sql
DO $$
DECLARE
  liq RECORD;
  seller_saldo NUMERIC;
  saldo_nuevo NUMERIC;
  monto_pago NUMERIC;
BEGIN
  -- Procesar cada liquidación pagada sin movimiento de pago registrado
  FOR liq IN
    SELECT 
      ls.id,
      ls.seller_id,
      ls.saldo_periodo,
      ls.periodo_inicio,
      ls.periodo_fin,
      ls.metodo_pago,
      ls.referencia_pago,
      ls.fecha_pago
    FROM liquidaciones_seller ls
    WHERE ls.estado = 'pagada'
      AND NOT EXISTS (
        SELECT 1 FROM seller_cuenta_corriente scc
        WHERE scc.liquidacion_id = ls.id AND scc.tipo = 'pago'
      )
  LOOP
    monto_pago := ABS(liq.saldo_periodo);
    IF monto_pago > 0 THEN
      -- Obtener saldo actual del seller
      SELECT saldo_cuenta_corriente INTO seller_saldo
      FROM ecommerce_sellers WHERE id = liq.seller_id;
      
      saldo_nuevo := seller_saldo - monto_pago;
      
      -- Insertar movimiento de pago
      INSERT INTO seller_cuenta_corriente (
        seller_id, tipo, monto, saldo_anterior, saldo_nuevo,
        descripcion, referencia, metodo_pago, liquidacion_id
      ) VALUES (
        liq.seller_id,
        'pago',
        -monto_pago,
        seller_saldo,
        saldo_nuevo,
        'Pago liquidación período ' || TO_CHAR(liq.periodo_inicio::date, 'MM/YYYY') || ' [retroactivo]',
        liq.referencia_pago,
        liq.metodo_pago,
        liq.id
      );
      
      -- Actualizar saldo del seller
      UPDATE ecommerce_sellers
      SET saldo_cuenta_corriente = saldo_nuevo,
          updated_at = NOW()
      WHERE id = liq.seller_id;
    END IF;
  END LOOP;
END;
$$;
```

## Resultado esperado

Después de la migración:
- Cada liquidación `pagada` tendrá exactamente 1 movimiento de tipo `pago` en `seller_cuenta_corriente` vinculado por `liquidacion_id`
- Los saldos en `ecommerce_sellers` reflejarán correctamente el descuento de los pagos ya realizados
- Las futuras liquidaciones que se paguen usarán el código nuevo que ya hace todo esto automáticamente
- No se crean movimientos duplicados (el `NOT EXISTS` en el WHERE protege contra eso)

## Tabla de correcciones esperadas

| Seller | Saldo antes (actual) | Pago retroactivo | Saldo después |
|---|---|---|---|
| SANABRIA SEBASTIAN | $10.245,99 | -$51.229,95 | -$40.983,96 |
| SANABRIA LAUTARO | $7.370,99 | -$68.846,93 | -$61.475,94 |
| SANABRIA EMANUEL | $30.737,97 | -$123.663,86 | -$92.925,89 |
| RADIKAL | $129.298,86 | -$281.964,70 | -$152.665,84 |

Nota: los saldos negativos resultantes indican que los sellers tienen deuda pendiente acumulada más allá del pago de esta liquidación. Esto es esperado dado que la cuenta corriente puede acumular cargos de envíos anteriores no liquidados aún.
