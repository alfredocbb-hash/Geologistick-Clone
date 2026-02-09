

# Historial ML + Corrección de pedidos existentes + Actualización de estados en sync

## Resumen

Se implementarán 3 mejoras:

1. **Botón de historial ML** en el detalle del pedido e-commerce que consulte el historial de estados directamente desde la API de MercadoLibre
2. **Actualización de pedidos existentes** en el sync para que no solo cree nuevos sino que actualice estados y totales de los ya sincronizados
3. **Script de corrección** para los 3 pedidos ML existentes con total $0 y fulfillment_status incorrecto

---

## 1. Nueva Edge Function: `mercadolibre-shipment-history`

Crear `supabase/functions/mercadolibre-shipment-history/index.ts` que:
- Reciba `shipment_id` y `seller_id` como parámetros
- Obtenga el access token válido del seller (reutilizando la lógica de refresh)
- Llame a `GET /shipments/{shipment_id}/history` en la API de ML
- Devuelva el array de eventos con timestamps y estados

---

## 2. UI: Sección de historial ML en OrderDetailsDialog

Agregar en `src/components/ecommerce/OrderDetailsDialog.tsx`:
- Un botón "Ver Historial ML" que aparece cuando el pedido tiene `ml_shipment_id`
- Al hacer click, llama a la Edge Function y muestra un timeline con los eventos de ML
- Formato similar al `ShipmentHistoryDialog` existente (timeline vertical con iconos)

---

## 3. Sync: Actualizar pedidos existentes

En `supabase/functions/mercadolibre-sync/index.ts`, cuando un envío ya existe:
- En lugar de solo hacer `continue`, consultar el estado actual del shipping en ML
- Actualizar `fulfillment_status` y `estado` del envío si cambió
- Actualizar el `total` si está en $0 (recalcular desde items)
- Registrar un contador `updated` en la respuesta

---

## 4. Corrección de datos existentes

Ejecutar una migración SQL para corregir los 3 pedidos con total $0:
- Recalcular el total desde la columna `items` (que tiene `unit_price` y `quantity`)
- Actualizar el `fulfillment_status` basado en el `order_status` actual

---

## Sección técnica

### Edge Function `mercadolibre-shipment-history`

```typescript
// GET ?shipment_id=123&seller_id=abc
// Calls ML API: GET /shipments/{shipment_id}/history
// Returns: { history: [{ date, status, substatus, date_handling }] }
```

### OrderDetailsDialog cambios

- Agregar estado `mlHistory` con `useQuery` que llama a la Edge Function
- Renderizar timeline debajo de la card de "Envio MercadoLibre" cuando hay datos
- Mapear estados ML (ready_to_ship, shipped, delivered) a labels en espanol

### mercadolibre-sync cambios (bloque ~linea 148-158)

Reemplazar el bloque que hace `continue` cuando ya existe:

```typescript
if (existingEnvio) {
  // Update existing: check if status or total changed
  const mlShippingStatus = orderItem.shipping?.status || 'ready_to_ship';
  const newFulfillment = mlShippingStatus === 'shipped' ? 'shipped' : 
                         mlShippingStatus === 'delivered' ? 'delivered' : 'pending';
  const newEnvioEstado = mlShippingStatus === 'shipped' ? 'en_transito' :
                         mlShippingStatus === 'delivered' ? 'entregado' : 'pendiente';
  
  // Update ecommerce_order
  await supabase.from('ecommerce_orders')
    .update({ fulfillment_status: newFulfillment, order_status: mlShippingStatus === 'delivered' ? 'delivered' : 'paid' })
    .eq('ml_shipment_id', shipmentId);
  
  // Update envio estado
  await supabase.from('envios')
    .update({ estado: newEnvioEstado })
    .eq('id', existingEnvio.id);

  existing++;
  continue;
}
```

### Migracion SQL para corregir datos

```sql
-- Fix orders with items data but total = 0
UPDATE ecommerce_orders 
SET total = (
  SELECT COALESCE(SUM((item->>'unit_price')::numeric * (item->>'quantity')::numeric), 0)
  FROM jsonb_array_elements(items::jsonb) AS item
)
WHERE plataforma = 'mercadolibre' AND total = 0 AND items IS NOT NULL AND items::text != '[]';
```

### Archivos afectados

- **Nuevo**: `supabase/functions/mercadolibre-shipment-history/index.ts`
- **Editar**: `src/components/ecommerce/OrderDetailsDialog.tsx`
- **Editar**: `supabase/functions/mercadolibre-sync/index.ts`
- **Migración SQL**: corrección de totales existentes

