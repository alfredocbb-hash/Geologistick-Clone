

## Plan: Bloquear acciones sobre envíos ya entregados

### Problema
Cuando un chofer escanea un envío con estado `entregado`, el sistema no lo detecta y abre el diálogo de entrega como si fuera un envío activo. Debería mostrar una alerta y no permitir ninguna acción.

### Cambios

**`src/components/mobile/MobileScanTab.tsx`** (línea ~248, después de setScannedShipment):
- Agregar chequeo temprano: si `shipment.estado === 'entregado'` o `'cancelado'`, mostrar toast de advertencia con sonido de warning, NO abrir ningún diálogo, y hacer return.

**`src/pages/ScanQR.tsx`** (en `handleShipmentAction`, línea ~340):
- Agregar chequeo al inicio de la función: si el estado es `entregado` o `cancelado`, reproducir sonido de warning, mostrar toast de error con el estado, setear `duplicateShipment` para mostrar info, y hacer return.

### Detalle técnico
En ambos archivos, antes de la lógica de decisión de diálogos:
```
if (['entregado', 'cancelado'].includes(shipment.estado)) {
  playWarningSound();
  toast.error('Este envío ya fue entregado/cancelado', {
    description: `Estado: ${statusLabel}`
  });
  return;
}
```

| Archivo | Cambio |
|---------|--------|
| `src/components/mobile/MobileScanTab.tsx` | Guard contra estados finales antes de abrir diálogos |
| `src/pages/ScanQR.tsx` | Guard en `handleShipmentAction` contra estados finales |

No se requiere migración de base de datos.

