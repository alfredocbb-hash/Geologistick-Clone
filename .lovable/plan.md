

# Mostrar solo Total Envíos (sin cargos de cuenta corriente) en liquidaciones de sellers

## Resumen

Actualmente el campo "Total Cargos + Envíos" suma los movimientos tipo "cargo" de la cuenta corriente con el total de envíos. Como ya no se muestran movimientos al usuario, este valor genera confusión. Se va a simplificar para que solo refleje el total de envíos del período, mostrando los cargos en $0.

## Cambios

### 1. `src/pages/ecommerce/Settlements.tsx`

**Calculo de liquidacion (linea 681):**
- Cambiar `total_cargos: sellerTotalCargos + sellerTotalEnvios` a `total_cargos: sellerTotalEnvios` (solo envíos, sin sumar cargos de cuenta corriente)
- Cambiar `saldo_periodo: sellerTotalCargos + sellerTotalEnvios - sellerTotalPagos` a `saldo_periodo: sellerTotalEnvios - sellerTotalPagos`

**Preview de totales (lineas 1160-1164):**
- Cambiar label "Total Cargos + Envíos" a "Total Envíos"
- Cambiar valor de `(calculatedTotals.totalCargos || 0) + (calculatedTotals.totalEnvios || 0)` a solo `calculatedTotals.totalEnvios || 0`

### 2. `src/components/ecommerce/SellerLiquidacionDetailDialog.tsx`

**Card de totales (linea 205):**
- Cambiar label "Total Cargos + Envíos" a "Total Envíos"

**Detalle de saldos (linea ~225):**
- Cambiar "Cargos + Envíos del Período" a "Envíos del Período"

### 3. `src/pages/PrintSettlement.tsx`

**Card de resumen (linea 331):**
- Cambiar label "Total Cargos" a "Total Envíos" cuando es liquidacion de seller

### 4. `src/lib/generateSettlementPDF.ts`

**PDF de seller:**
- Cambiar texto "Total Cargos" a "Total Envíos" en la seccion de totales del PDF para sellers

