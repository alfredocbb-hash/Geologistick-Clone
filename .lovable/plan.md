

# Fix: Setear `sucursal_entrega_id` al confirmar entrega

## Problema
Cuando se entrega un envío, ninguno de los dos flujos de entrega establece `sucursal_entrega_id`:
- **BranchDeliveryDialog** (entrega en sucursal): marca `entregado_en_sucursal: true` pero no setea `sucursal_entrega_id`
- **DeliveryConfirmation** (entrega por chofer): no setea `sucursal_entrega_id` en absoluto

Esto provoca que envíos entregados no aparezcan en la liquidación de la sucursal correspondiente, porque el motor de liquidación filtra por `sucursal_destino_id` o `sucursal_entrega_id`.

## Cambios

### `src/components/scan/BranchDeliveryDialog.tsx`
- En `handleConfirmDelivery`, agregar `sucursal_entrega_id: profile?.sucursal_id` al update del envío (la sucursal del usuario que entrega)

### `src/components/delivery/DeliveryConfirmation.tsx`
- En la mutación de confirmación, agregar `sucursal_entrega_id: profile?.sucursal_id` al `updateData` cuando el chofer tiene sucursal asignada

### Data fix para ENV-AH24NW
- Actualizar el envío existente para que `sucursal_entrega_id` apunte a la sucursal de Mar del Plata, corrigiendo el dato histórico

| Archivo | Cambio |
|---------|--------|
| `BranchDeliveryDialog.tsx` | Agregar `sucursal_entrega_id` en el update de entrega |
| `DeliveryConfirmation.tsx` | Agregar `sucursal_entrega_id` en el update de entrega |
| Data fix | UPDATE envío ENV-AH24NW con `sucursal_entrega_id` correcto |

