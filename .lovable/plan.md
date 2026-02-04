
# Plan: Permitir Entrega en Sucursal al Escanear Envíos de Retiro en Sucursal

## Problema Identificado

Cuando un envío con tipo de servicio "retira en sucursal" (`sucursal_sucursal` o `puerta_sucursal`) llega a la sucursal de destino y pasa a estado `en_bodega`, el usuario de la sucursal no puede entregar el paquete al cliente que viene a retirarlo mediante escaneo.

### Flujo Esperado

```text
1. Envío llega a sucursal destino (estado: en_bodega)
2. Cliente viene a retirar
3. Sucursal escanea el código QR del paquete
4. Se abre el diálogo de "Entrega en Sucursal" (BranchDeliveryDialog)
5. Registra datos de quien retira + firma + pago si aplica
6. Envío pasa a "entregado"
```

### Problema Actual

La lógica de decisión en `MobileScanTab.tsx` para el rol `sucursal`:

```typescript
} else if (hasRole('sucursal') || hasRole('despachador')) {
  if (shipment.estado === 'en_transito' && canReceive) {
    setShowReceiveDialog(true);      // Solo recibe si está en_transito
  } else if (canDeliver) {
    setShowDeliveryDialog(true);     // Abre entrega pero falta condición de en_bodega
  }
}
```

El problema es que **no verifica** que el envío:
- Esté en estado `en_bodega` (ya recibido en sucursal)
- Sea del tipo de servicio que permite retiro en sucursal
- Pertenezca a la sucursal del usuario que escanea

---

## Solución Propuesta

### 1. Agregar campo `tipo_servicio_detalle` a la interfaz ScannedShipment

```typescript
interface ScannedShipment {
  // ... campos existentes ...
  tipo_servicio_detalle?: string | null;  // NUEVO
}
```

### 2. Actualizar la lógica de decisión para rol `sucursal`

```typescript
} else if (hasRole('sucursal') || hasRole('despachador')) {
  // Verificar si es un envío de tipo "retira en sucursal" listo para entregar
  const isPickupAtBranch = 
    shipment.tipo_servicio_detalle === 'sucursal_sucursal' ||
    shipment.tipo_servicio_detalle === 'puerta_sucursal';
  
  const isReadyForBranchDelivery = 
    shipment.estado === 'en_bodega' && 
    isPickupAtBranch;
  
  if (isReadyForBranchDelivery && canDeliver) {
    // Envío listo para entrega al cliente en sucursal
    setShowDeliveryDialog(true);
  } else if (shipment.estado === 'en_transito' && canReceive) {
    // Recepción de envío entrante
    setShowReceiveDialog(true);
  } else if (canDeliver) {
    // Fallback para otros casos de entrega
    setShowDeliveryDialog(true);
  }
}
```

### 3. (Opcional) Verificar que el envío pertenece a la sucursal del usuario

Para mayor seguridad, se puede validar que `sucursal_destino_id` coincida con la sucursal del perfil:

```typescript
const isMySucursalDestino = 
  profile?.sucursal_id && 
  shipment.sucursal_destino_id === profile.sucursal_id;

const isReadyForBranchDelivery = 
  shipment.estado === 'en_bodega' && 
  isPickupAtBranch &&
  isMySucursalDestino;
```

Esto previene que una sucursal pueda entregar envíos destinados a otra sucursal.

---

## Archivo a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/mobile/MobileScanTab.tsx` | Agregar `tipo_servicio_detalle` a interfaz + actualizar lógica de decisión |

---

## Flujo Resultante

```text
Usuario con rol "sucursal" escanea envío
                │
                ▼
    ┌───────────────────────────────────┐
    │   ¿Estado = en_bodega?            │
    │   ¿Tipo = sucursal_sucursal       │
    │         o puerta_sucursal?        │
    │   ¿Es mi sucursal destino?        │
    └───────────────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
       SÍ              NO
        │               │
        ▼               ▼
  BranchDelivery    ¿Estado = en_transito?
    Dialog              │
        │           ┌───┴───┐
        │           ▼       ▼
        │          SÍ      NO
        │           │       │
        │           ▼       ▼
        │     Receive    Delivery
        │      Dialog    Dialog
        │
        ▼
  Cliente retira:
  - Nombre quien retira
  - DNI
  - Firma
  - Pago (si aplica)
        │
        ▼
  Estado → "entregado"
```

---

## Resultado Esperado

1. Al escanear un envío con `tipo_servicio_detalle = 'sucursal_sucursal'` o `'puerta_sucursal'` que esté en estado `en_bodega`:
   - Se abre el diálogo **BranchDeliveryDialog**
   - Permite registrar los datos de quien retira
   - Confirma la entrega y cambia estado a `entregado`

2. Seguridad adicional: solo se permite entregar si el envío está destinado a la sucursal del usuario.

3. El flujo de recepción (`en_transito` → `en_bodega`) sigue funcionando igual para envíos entrantes.
