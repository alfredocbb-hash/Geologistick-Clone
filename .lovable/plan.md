

# Fix: Cancelación de envíos — limpiar pagos y movimientos de caja

## Problema

Cuando se cancela un envío desde `Shipments.tsx`, solo se actualiza el `estado` a `cancelado` y se inserta historial. **No se limpian**:
1. Los **pagos** (`pagos`) asociados al envío — si ya fue cobrado por chofer o en sucursal, esos registros quedan activos
2. Los **movimientos de caja** (`movimientos_caja`) — si hubo un cobro en sucursal que generó un ingreso en caja, ese importe queda sumando en la sesión

El mismo problema existe en `ChangeStatusDialog.tsx` cuando se cambia manualmente a `cancelado`.

## Solución

### 1. `src/pages/Shipments.tsx` — `cancelMutation`

Después de actualizar `estado: 'cancelado'`, agregar:
- **Anular pagos**: buscar pagos del envío y marcarlos como `estado: 'anulado'`
- **Compensar caja**: si hay movimientos de caja con `envio_id`, insertar un movimiento de egreso compensatorio con `monto` igual y concepto "Anulación por cancelación de envío"

### 2. `src/components/shipments/ChangeStatusDialog.tsx` — `changeStatusMutation`

Cuando `newStatus === 'cancelado'`, aplicar la misma lógica de anulación de pagos y compensación de caja.

### 3. `src/components/routes/CancelRouteDialog.tsx` — `cancelMutation`

Revisar si al cancelar ruta también debe anularse pagos de los envíos. Actualmente los envíos vuelven a `en_sucursal` o `pendiente`, no a `cancelado`, así que no aplica anulación — es correcto.

### Flujo de anulación (compartido)

```typescript
// 1. Anular pagos existentes del envío
const { data: pagos } = await supabase
  .from('pagos')
  .select('id')
  .eq('envio_id', envioId)
  .in('estado', ['cobrado_chofer', 'rendido', 'pagado']);

if (pagos?.length) {
  await supabase
    .from('pagos')
    .update({ estado: 'anulado' })
    .in('id', pagos.map(p => p.id));
}

// 2. Compensar movimientos de caja
const { data: movimientos } = await supabase
  .from('movimientos_caja')
  .select('id, sesion_caja_id, monto, concepto')
  .eq('envio_id', envioId)
  .eq('tipo', 'ingreso');

if (movimientos?.length) {
  for (const mov of movimientos) {
    await supabase.from('movimientos_caja').insert({
      sesion_caja_id: mov.sesion_caja_id,
      envio_id: envioId,
      tipo: 'egreso',
      monto: mov.monto,
      concepto: `Anulación: ${mov.concepto}`,
      created_by: user?.id,
    });
  }
}
```

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Shipments.tsx` | Agregar anulación de pagos + compensación caja en `cancelMutation` |
| `src/components/shipments/ChangeStatusDialog.tsx` | Agregar misma lógica cuando `newStatus === 'cancelado'` |

