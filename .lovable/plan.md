

# Fix: Sucursal con envío ya recepcionado muestra diálogo de recepción en vez de entrega

## Problema

En `ScanQR.tsx` línea 383, la lógica de auto-detección para roles de sucursal (`isBranchOperator`) es:

```typescript
} else if (isBranchOperator && ['en_sucursal', 'en_transito'].includes(shipment.estado)) {
  setReceiveType('branch');
  setShowReceiveDialog(true);  // ← Siempre muestra "Recibir en Sucursal"
}
```

Cuando el envío ya está `en_sucursal` (ya fue recepcionado), debería ir directo a la entrega al cliente (`BranchDeliveryDialog`) en lugar de mostrar nuevamente el diálogo de recepción.

## Solución

Modificar la lógica de auto-detección en `handleShipmentAction` para que:

1. Si el envío está **`en_sucursal`** → abrir `BranchDeliveryDialog` (entrega al cliente con pago y datos)
2. Si el envío está **`en_transito`** → abrir `ReceiveShipmentDialog` (recepción pendiente)

### `src/pages/ScanQR.tsx`

Cambiar líneas 383-385:

```typescript
// ANTES
} else if (isBranchOperator && ['en_sucursal', 'en_transito'].includes(shipment.estado)) {
  setReceiveType('branch');
  setShowReceiveDialog(true);

// DESPUÉS  
} else if (isBranchOperator && shipment.estado === 'en_sucursal') {
  // Ya recepcionado → ir directo a entrega al cliente
  setShowBranchDeliveryDialog(true);
} else if (isBranchOperator && shipment.estado === 'en_transito') {
  // Todavía en tránsito → recepción
  setReceiveType('branch');
  setShowReceiveDialog(true);
}
```

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/ScanQR.tsx` | Separar lógica `en_sucursal` (entrega) de `en_transito` (recepción) en auto-detect |

