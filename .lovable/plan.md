

# Plan: Cerrar la logica integral de Caja

## Estado actual del sistema

El sistema ya tiene implementados estos componentes de forma **independiente**:

1. **Caja** (`Cash.tsx`): Apertura/cierre de sesion, movimientos manuales (ingreso/egreso), calculo de saldo esperado
2. **Rendiciones COD** (`ReceiveRenditionDialog.tsx` + funcion `receive_rendition`): El chofer cobra en la calle, luego la sucursal recibe el dinero. Si hay caja abierta, se registra automaticamente como ingreso
3. **Pagos** (`Payments.tsx`): Tabla de pagos con estados: pendiente, cobrado_chofer, rendido, pagado
4. **Liquidacion Choferes** (`DriverSettlements.tsx`): Calcula comisiones del chofer sobre envios entregados
5. **Liquidacion Sucursales** (`BranchSettlements.tsx`): Calcula comisiones de sucursal sobre envios procesados

## Lo que falta conectar

### 1. Vincular cobros de envios automaticamente a la caja

**Situacion actual**: Cuando se entrega un envio con pago contado/destino, se crea un registro en `pagos` con estado `cobrado_chofer`, pero la caja no se entera hasta que se hace la rendicion manual.

**Cambio propuesto**: Cuando un envio se entrega **en sucursal** (no por chofer), registrar automaticamente un movimiento de ingreso en la caja abierta.

| Archivo | Cambio |
|---------|--------|
| `src/components/scan/BranchDeliveryDialog.tsx` | Al confirmar entrega con pago, si hay caja abierta, crear movimiento_caja automaticamente |
| `src/components/delivery/DeliveryConfirmation.tsx` | Idem para entregas confirmadas desde la app movil en sucursal |

### 2. Vincular rendiciones de choferes (ya funciona)

La funcion `receive_rendition` ya crea un `movimiento_caja` cuando hay sesion abierta. Este circuito esta **completo**.

### 3. Cruzar con liquidaciones

**Situacion actual**: Las liquidaciones se calculan y guardan pero no impactan la caja.

**Cambio propuesto**: Al marcar una liquidacion como "pagada", registrar un egreso en caja (si hay caja abierta).

| Archivo | Cambio |
|---------|--------|
| `src/pages/DriverSettlements.tsx` | Al pagar liquidacion de chofer, crear egreso en caja |
| `src/pages/BranchSettlements.tsx` | Al pagar liquidacion de sucursal, crear egreso en caja |

### 4. Reporte de cierre consolidado

**Situacion actual**: El cierre de caja muestra solo ingresos/egresos generales sin desglose por concepto.

**Cambio propuesto**: Agregar un resumen categorizado al cierre de caja.

| Archivo | Cambio |
|---------|--------|
| `src/pages/Cash.tsx` | Agrupar movimientos por concepto (Rendiciones COD, Cobros directos, Liquidaciones pagadas, Otros) y mostrar subtotales en el panel de cierre |

## Detalle tecnico

### Fix 1: Cobros directos en sucursal impactan caja

En `BranchDeliveryDialog.tsx`, despues de insertar el pago:

```typescript
// Si hay caja abierta en la sucursal, registrar ingreso
const { data: cajaAbierta } = await supabase
  .from('sesiones_caja')
  .select('id')
  .eq('sucursal_id', profile.sucursal_id)
  .eq('estado', 'abierta')
  .limit(1);

if (cajaAbierta?.length) {
  await supabase.from('movimientos_caja').insert({
    sesion_caja_id: cajaAbierta[0].id,
    tipo: 'ingreso',
    concepto: `Cobro envio ${shipment.tracking_number}`,
    monto: shipment.precio_total,
    metodo_pago: paymentMethod,
    envio_id: shipment.id,
    created_by: user.id,
  });
}
```

### Fix 2: Liquidaciones pagadas generan egreso en caja

En `DriverSettlements.tsx` y `BranchSettlements.tsx`, en la mutacion de pago:

```typescript
// Al marcar como pagada, registrar egreso en caja si hay sesion abierta
if (metodoPago === 'efectivo') {
  const { data: cajaAbierta } = await supabase
    .from('sesiones_caja')
    .select('id')
    .eq('sucursal_id', profile.sucursal_id)
    .eq('estado', 'abierta')
    .limit(1);

  if (cajaAbierta?.length) {
    await supabase.from('movimientos_caja').insert({
      sesion_caja_id: cajaAbierta[0].id,
      tipo: 'egreso',
      concepto: `Pago liquidacion chofer/sucursal - Periodo ...`,
      monto: montoTotal,
      metodo_pago: 'efectivo',
      created_by: user.id,
    });
  }
}
```

### Fix 3: Resumen categorizado en cierre de caja

En `Cash.tsx`, agrupar los movimientos existentes por patrones de concepto:

```typescript
const categorias = {
  rendiciones: movements.filter(m => m.concepto.startsWith('Rendicion COD')),
  cobrosDirectos: movements.filter(m => m.concepto.startsWith('Cobro envio')),
  liquidaciones: movements.filter(m => m.concepto.startsWith('Pago liquidacion')),
  otros: movements.filter(m => /* los que no matchean arriba */),
};
```

Mostrar estas categorias como cards resumen dentro del panel de cierre de caja, con subtotales por categoria y metodo de pago.

## Flujo completo resultante

```
Envio entregado en sucursal (contado/destino)
  -> Pago registrado (estado: pagado)
  -> Movimiento caja: INGRESO automatico

Envio entregado por chofer (contado/destino)  
  -> Pago registrado (estado: cobrado_chofer)
  -> Chofer rinde en sucursal
  -> Rendicion registrada
  -> Movimiento caja: INGRESO automatico (ya funciona)

Liquidacion chofer pagada en efectivo
  -> Movimiento caja: EGRESO automatico

Liquidacion sucursal pagada en efectivo
  -> Movimiento caja: EGRESO automatico

Cierre de caja
  -> Resumen: Rendiciones + Cobros directos - Liquidaciones pagadas = Saldo
  -> Comparacion con efectivo real contado
```

## Archivos afectados

| Archivo | Tipo de cambio |
|---------|---------------|
| `src/components/scan/BranchDeliveryDialog.tsx` | Agregar ingreso automatico a caja |
| `src/pages/DriverSettlements.tsx` | Agregar egreso a caja al pagar liquidacion |
| `src/pages/BranchSettlements.tsx` | Agregar egreso a caja al pagar liquidacion |
| `src/pages/Cash.tsx` | Agregar resumen categorizado en cierre |

