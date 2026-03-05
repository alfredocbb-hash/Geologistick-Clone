

# Fix: Tipo de movimiento en caja para liquidaciones

## Situación actual

| Liquidación | Tipo en caja actual | Tipo correcto |
|---|---|---|
| Chofer | `egreso` | `egreso` ✅ (la empresa le paga al chofer) |
| Sucursal | `egreso` | **`ingreso`** ❌ (la sucursal paga a la empresa) |
| Seller | `egreso` | **`ingreso`** ❌ (el seller paga a la empresa) |
| Terciarizado | sin registro | — (no impacta caja actualmente) |
| Cliente | sin registro | — (no impacta caja actualmente) |

## Cambios

### 1. `src/pages/BranchSettlements.tsx` (~línea 650)
- Cambiar `tipo: 'egreso'` → `tipo: 'ingreso'`
- Cambiar concepto de "Pago liquidación" → "Cobro liquidación sucursal"

### 2. `src/pages/ecommerce/Settlements.tsx` (~línea 914)
- Cambiar `tipo: 'egreso'` → `tipo: 'ingreso'`
- Cambiar concepto de "Pago liquidación seller" → "Cobro liquidación seller"

**2 archivos, 2 líneas cada uno.**

