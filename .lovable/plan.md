

# Corregir Sincronización ML: No Retroceder Estados

## Problema

La sincronización está **empeorando** los estados en vez de mejorarlos:
- Un envío que ya estaba "entregado" fue cambiado a "pendiente" porque MercadoLibre lo devolvió como `ready_to_ship`
- Esto pasa porque la función actualiza el estado sin verificar si es un "retroceso"

## Solución

### 1. Agregar protección contra retroceso de estados

Definir un orden de prioridad de estados. Nunca cambiar un estado "más avanzado" por uno "menos avanzado":

```text
Prioridad (menor a mayor):
pendiente (0) -> recogido (1) -> en_bodega (2) -> en_transito (3) -> en_reparto (4) -> entregado (5) / no_entregado (5) / devuelto (5) / cancelado (5)
```

Si el envío ya está en "entregado" y ML dice "pendiente", NO se cambia.

### 2. Obtener siempre el estado real del shipment de ML

En vez de confiar solo en `orderItem.shipping.status` (que viene del search de órdenes), consultar también `/shipments/{id}` para obtener el status y substatus más actualizado -- pero SOLO cuando el estado de la orden sea "menor" que el estado actual del envío.

## Cambios por archivo

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/mercadolibre-sync/index.ts` | Agregar mapa de prioridad de estados. Antes de actualizar, verificar que el nuevo estado no sea un retroceso. Si ML dice "ready_to_ship" pero el envío ya está "entregado", ignorar el cambio. |

## Detalle técnico

### Mapa de prioridad

```text
const ESTADO_PRIORITY: Record<string, number> = {
  pendiente: 0,
  recogido: 1,
  en_bodega: 2,
  en_transito: 3,
  en_reparto: 4,
  entregado: 10,
  no_entregado: 10,
  devuelto: 10,
  cancelado: 10,
};
```

### Lógica de protección (líneas 234-257)

Antes de actualizar, comparar prioridades:

```text
const newEnvioEstado = mapping?.estado_interno || 'pendiente';
const currentEstado = envioActual?.estado || 'pendiente';
const newPriority = ESTADO_PRIORITY[newEnvioEstado] ?? 0;
const currentPriority = ESTADO_PRIORITY[currentEstado] ?? 0;

// Solo actualizar si el nuevo estado tiene igual o mayor prioridad
if (newPriority >= currentPriority) {
  // Actualizar envío y registrar en historial...
} else {
  console.log('[ML Sync] Skipping downgrade:', currentEstado, '->', newEnvioEstado);
}
```

### Siempre consultar el shipment real de ML

Para envíos existentes, cuando `orderItem.shipping.status` sea un estado "menor" que el actual, consultar `/shipments/{id}` para verificar el estado real en ML antes de decidir no actualizar.

```text
// Siempre consultar shipment real si el estado de la orden parece desactualizado
let realStatus = mlShippingStatus;
let realSubstatus = finalSubstatus;

if (ESTADO_PRIORITY[newEnvioEstado] < currentPriority) {
  // Consultar ML para verificar el estado real
  const shipResp = await fetch(ML_API_BASE + '/shipments/' + shipmentId, ...);
  if (shipResp.ok) {
    const shipData = await shipResp.json();
    realStatus = shipData.status;
    realSubstatus = shipData.substatus;
    // Re-buscar mapping con el estado real
  }
}
```

## Resultado esperado

- Envíos que ya están "entregado" NO serán cambiados a "pendiente"
- Envíos que están en "pendiente" SI serán actualizados a "entregado" si ML así lo indica
- Los estados solo avanzan, nunca retroceden
- Los cambios quedan registrados en el historial
