## Objetivo

Asegurar que **todos** los selectores de método de cobro incluyan las tres opciones: **Efectivo**, **Transferencia** y **Mercado Pago**, y unificar el valor `mercado_pago` (evitar variantes como `mercadopago`) para que la conciliación de Caja cuadre.

## Análisis — dónde faltan opciones

Revisé todos los componentes/páginas que muestran un selector de método de pago:

| Ubicación | Estado actual | Acción |
|---|---|---|
| `src/pages/Cash.tsx` | efectivo, transferencia, mercado_pago | OK |
| `src/pages/Payments.tsx` | efectivo, transferencia, mercado_pago | OK |
| `src/pages/DriverSettlements.tsx` | efectivo, transferencia, mercado_pago | OK |
| `src/pages/ClientSettlements.tsx` | efectivo, transferencia, mercado_pago | OK |
| `src/pages/BranchSettlements.tsx` | efectivo, transferencia, mercado_pago | OK |
| `src/components/finanzas/RegistrarMovimientoDialog.tsx` | efectivo, transferencia, mercado_pago | OK |
| `src/components/shipments/PaymentMethodDialog.tsx` | efectivo, transferencia, mercado_pago, tarjeta | OK |
| `src/components/delivery/DeliveryConfirmation.tsx` | efectivo, transferencia, mercado_pago | OK |
| **`src/components/renditions/ReceiveRenditionDialog.tsx`** | **falta `mercado_pago`** (solo efectivo + transferencia) | **Agregar Mercado Pago** |
| **`src/components/ecommerce/SellerSettlementDialog.tsx`** | usa valor `"mercadopago"` (sin guion bajo) | **Cambiar a `mercado_pago`** para unificar |
| **`src/components/subscriptions/SuperAdminSubscriptionManager.tsx`** | usa valor `"mercadopago"` | **Cambiar a `mercado_pago`** |
| **`src/components/seller/RequestWithdrawalDialog.tsx`** | usa valor `"mercadopago"` | **Cambiar a `mercado_pago`** |

## Cambios a realizar

### 1. `ReceiveRenditionDialog.tsx`
Agregar `<SelectItem value="mercado_pago">Mercado Pago</SelectItem>` en el selector de método de pago de la rendición (línea ~324), junto a Efectivo y Transferencia.

### 2. Unificación del valor `mercado_pago`
En los 3 archivos que usan `"mercadopago"`, reemplazar el `value` del `SelectItem` por `"mercado_pago"` para que:
- Coincida con el enum usado por `pagos.metodo` y `movimientos_caja.metodo_pago`.
- La conciliación de Caja (`ReconciliacionCard`) sume correctamente los MP de todos los orígenes.

Archivos:
- `src/components/ecommerce/SellerSettlementDialog.tsx` (línea 134)
- `src/components/subscriptions/SuperAdminSubscriptionManager.tsx` (línea 703)
- `src/components/seller/RequestWithdrawalDialog.tsx` (línea 157)

Se ajustará también cualquier `useState` inicial, comparación o `switch` que use el literal `"mercadopago"` en esos mismos archivos para evitar romper la lógica existente.

### Notas
- No se tocan esquemas de BD ni migraciones.
- No se agrega "tarjeta" a los selectores que no la tenían (solo se pidieron efectivo/transferencia/MP).
- `EditSellerDialog` / `CreateSellerDialog` usan `"mercadolibre"` como plataforma del seller (no es un método de cobro) — se dejan como están.
