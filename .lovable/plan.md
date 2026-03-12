

# Bug: ENV-UT6YE2 no cambia de estado al ser recibido en sucursal

## Diagnóstico

El envío viajó de **BAHIA BLANCA** → **LINIERS**. EZEQUIEL VOSA (sucursal LINIERS) intentó recibirlo **5 veces** y el estado nunca cambió: siempre quedó `en_transito → en_transito`.

**Causa raíz en `ReceiveShipmentDialog.tsx`, línea 52:**

```typescript
const newStatus = isCenter ? 'en_sucursal' : 'en_transito';
```

La lógica está invertida: cuando una sucursal NO es centro logístico (`type === 'branch'`), el nuevo estado se setea como `en_transito` — pero el paquete **ya está** en `en_transito`. No hay cambio real de estado, solo se insertan entradas de historial duplicadas que dicen "Paquete recibido en sucursal" sin que el estado del envío cambie.

LINIERS no es centro logístico (`es_centro_logistico = false`), así que el sistema lo trata como `branch` y le asigna `en_transito` nuevamente.

## Fix

### `src/components/scan/ReceiveShipmentDialog.tsx`

Cambiar la lógica para que **ambos tipos de recepción** (centro y sucursal) cambien el estado a `en_sucursal`:

```typescript
// Línea 52: Siempre que se recibe un paquete, el estado es "en_sucursal"
const newStatus = 'en_sucursal';
const statusLabel = isCenter ? 'en centro logístico' : 'en sucursal';
```

Esto es correcto semánticamente: recibir un paquete en cualquier sucursal significa que está **en sucursal**. El estado `en_transito` solo aplica cuando el paquete está viajando entre sucursales.

