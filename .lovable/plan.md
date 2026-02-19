
# Integración de pagos de liquidaciones sellers con cuenta corriente y caja

## Diagnóstico del problema

El `payMutation` en `src/pages/ecommerce/Settlements.tsx` actualmente **solo actualiza el estado** de la liquidación:

```typescript
// Lo que hace hoy (incompleto):
await supabase
  .from('liquidaciones_seller')
  .update({ estado: 'pagada', metodo_pago: ..., referencia_pago: ..., fecha_pago: ... })
  .eq('id', payingLiquidacion.id);
// ← Nada más. El saldo del seller no cambia. La caja no se afecta.
```

### Comparación con el circuito de choferes y sucursales

Las liquidaciones de choferes (`src/pages/DriverSettlements.tsx`) y sucursales (`src/pages/BranchSettlements.tsx`) ya tienen este circuito completo al marcar como pagado:
1. Actualizar estado de la liquidación
2. Si método = efectivo → insertar egreso en `movimientos_caja` de la sesión activa

Para sellers falta además el paso de cuenta corriente.

## Solución

### Cambio en `payMutation` (src/pages/ecommerce/Settlements.tsx)

Al confirmar el pago de una liquidación de seller, se ejecutan **tres acciones en secuencia**:

**Acción 1: Actualizar estado de la liquidación** (ya existe)
```typescript
await supabase.from('liquidaciones_seller')
  .update({ estado: 'pagada', metodo_pago, referencia_pago, fecha_pago })
  .eq('id', payingLiquidacion.id);
```

**Acción 2: Registrar movimiento de pago en cuenta corriente del seller**

Se inserta un registro en `seller_cuenta_corriente` de tipo `pago`:
```typescript
// Obtener saldo actual del seller
const { data: sellerData } = await supabase
  .from('ecommerce_sellers')
  .select('saldo_cuenta_corriente')
  .eq('id', payingLiquidacion.seller_id)
  .single();

const saldoAnterior = sellerData.saldo_cuenta_corriente || 0;
const montoPago = Math.abs(payingLiquidacion.saldo_periodo || 0);
const saldoNuevo = saldoAnterior - montoPago;

await supabase.from('seller_cuenta_corriente').insert({
  seller_id: payingLiquidacion.seller_id,
  tipo: 'pago',
  monto: -montoPago,          // negativo = reduce la deuda
  saldo_anterior: saldoAnterior,
  saldo_nuevo: saldoNuevo,
  descripcion: `Pago liquidación período ${periodoFormateado}`,
  referencia: payReferencia || null,
  metodo_pago: payMetodo,
  liquidacion_id: payingLiquidacion.id,
  created_by: user.id,
});

// Actualizar saldo en ecommerce_sellers
await supabase.from('ecommerce_sellers')
  .update({ saldo_cuenta_corriente: saldoNuevo })
  .eq('id', payingLiquidacion.seller_id);
```

**Acción 3: Si método = efectivo → registrar egreso en caja activa**

Igual al circuito de choferes/sucursales:
```typescript
if (payMetodo === 'efectivo') {
  // Buscar sesión de caja activa del usuario
  const { data: sesion } = await supabase
    .from('sesiones_caja')
    .select('id')
    .eq('estado', 'abierta')
    .maybeSingle();

  if (sesion) {
    await supabase.from('movimientos_caja').insert({
      sesion_caja_id: sesion.id,
      tipo: 'egreso',
      concepto: 'liquidacion_seller',
      monto: montoPago,
      descripcion: `Pago liquidación seller: ${payingLiquidacion.seller?.nombre}`,
      referencia: payReferencia || payingLiquidacion.id,
      created_by: user.id,
    });
  }
}
```

### Invalidaciones de caché al completar el pago

Tras el pago exitoso, se invalidan adicionalmente:
- `['seller-liquidaciones']` — ya existía
- `['ecommerce-sellers-cta-cte']` — para refrescar saldos en la pestaña "Saldos por Seller"
- `['seller-movements', payingLiquidacion.seller_id]` — para refrescar el historial de la cuenta corriente
- `['ecommerce-sellers']` — para refrescar el saldo_cuenta_corriente en la lista

## Estructura de datos a verificar

Se necesita confirmar que la tabla `seller_cuenta_corriente` tiene el campo `liquidacion_id` para vincular el pago a su liquidación. Esto se verifica en el código existente del `generateMutation` que ya usa ese campo, confirmando que existe.

También se verifica si `movimientos_caja` tiene un campo `concepto` con valor `liquidacion_seller`. Si no existe como enum/valor permitido, se usa `egreso_operativo` como concepto genérico con la descripción detallando el tipo.

## Archivo a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/ecommerce/Settlements.tsx` | `payMutation`: agregar inserción en `seller_cuenta_corriente` + egreso en caja si método es efectivo |

## Flujo completo resultante

```
ANTES DEL CAMBIO:
[Pagar] → estado: 'pagada' ← fin

DESPUÉS DEL CAMBIO:
[Pagar] → estado: 'pagada'
        → seller_cuenta_corriente: tipo='pago', monto=-X, saldo actualizado
        → ecommerce_sellers: saldo_cuenta_corriente actualizado
        → (si efectivo) movimientos_caja: tipo='egreso', concepto='liquidacion_seller'
```

## Resultado esperado

- Al pagar una liquidación de seller, el saldo de la cuenta corriente del seller se actualiza automáticamente (la deuda se reduce)
- Si el método de pago es efectivo, aparece como egreso en el cierre de la sesión de caja activa
- La pestaña "Saldos por Seller" muestra el saldo actualizado inmediatamente
- El historial de movimientos del seller en `SellerAccount` muestra el pago registrado
- El comportamiento es consistente con las liquidaciones de choferes y sucursales
