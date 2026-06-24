## Problema

En la pestaña **Cuenta Corriente por Seller** (Liquidaciones Seller → tab Sellers), la columna **Pagos** y el **Saldo** sólo consideran movimientos `tipo='pago'` registrados en `seller_cuenta_corriente`. Las liquidaciones marcadas como **pagada** antes de la automatización (o pagadas sin que se haya disparado el insert del movimiento) no se restan, por lo que el saldo aparece inflado.

Además, la columna `ecommerce_sellers.saldo_cuenta_corriente` (que se muestra en la lista de Sellers y en el header del seller) queda desincronizada con el saldo real.

## Solución

Dos frentes: corregir el cálculo en vivo + reconciliar el histórico.

### 1. Cálculo en vivo (frontend)

En `src/pages/ecommerce/Settlements.tsx`, dentro del query `sellerBalances`:

- Además de sumar movimientos `tipo='pago'` de `seller_cuenta_corriente`, traer todas las `liquidaciones_seller` con `estado='pagada'` por seller.
- Para cada liquidación pagada, verificar si ya existe un movimiento de pago con `liquidacion_id` igual.
- Si NO existe, sumar `Math.abs(saldo_periodo)` al `totalPagos` del seller (así el saldo refleja la liquidación pagada aunque no tenga el movimiento).
- Mantener el resto del cálculo igual: `saldoCalculado = totalEnvios − totalPagos`.

Esto garantiza que el saldo mostrado en la tabla Sellers (línea ~1349) y en las stats (totalSaldo, sellersConDeuda, sellersAFavor) refleje siempre las liquidaciones pagadas, sin depender del histórico.

### 2. Reconciliación histórica (one-shot)

Generar y ejecutar una migración SQL única que, para cada `liquidaciones_seller` con `estado='pagada'` que no tenga un movimiento asociado en `seller_cuenta_corriente`:

1. Inserte un movimiento `tipo='pago'`, `monto = -ABS(saldo_periodo)`, `liquidacion_id`, `descripcion = 'Reconciliación: pago liquidación ...'`, `metodo_pago`, `referencia` y `created_by` tomados de la liquidación.
2. `saldo_anterior` = saldo actual del seller; `saldo_nuevo` = `saldo_anterior − monto`. El trigger existente `update_seller_balance` actualizará `ecommerce_sellers.saldo_cuenta_corriente` automáticamente.
3. Procesarlas ordenadas por `fecha_pago` para que los saldos encadenen bien.

Implementar como una función PL/pgSQL `public.reconcile_seller_liquidacion_payments()` que recorra y devuelva la cantidad de movimientos creados, y ejecutarla una vez en la misma migración. Queda disponible para ejecuciones futuras si surgen casos.

### 3. Mostrar el saldo calculado en la lista de Sellers

En `src/pages/ecommerce/Sellers.tsx` (línea 737) y en `SellerDetailsDialog.tsx`, además de mostrar `seller.saldo_cuenta_corriente`, dejar una nota visual o usar el mismo cálculo para evitar discrepancias percibidas. **Opcional / a confirmar**: si tras la reconciliación los valores ya coinciden, no hace falta tocar esos componentes.

## Validación

1. Antes: anotar 2-3 sellers con liquidaciones pagadas conocidas y su saldo actual.
2. Aplicar migración de reconciliación → comprobar que se crearon N movimientos y que `saldo_cuenta_corriente` bajó en cada caso por el monto esperado.
3. Refrescar la pestaña Cuenta Corriente por Seller → columna Pagos suma las liquidaciones pagadas, columna Saldo coincide con el balance esperado.
4. Generar una nueva liquidación y pagarla → el flujo automatizado existente sigue funcionando (no se duplican movimientos).

## Detalles técnicos

- Archivos a editar: `src/pages/ecommerce/Settlements.tsx` (query `sellerBalances`).
- Migración nueva: función `reconcile_seller_liquidacion_payments()` + `SELECT public.reconcile_seller_liquidacion_payments();` al final.
- Sin cambios en RLS ni en esquema de tablas.
- El insert defensivo en el frontend (paso 1) cubre casos futuros donde el insert automático del pago falle por cualquier motivo.