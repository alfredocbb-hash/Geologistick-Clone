
# Actualizar Estados ML de Envios Existentes

## Problema

Hay ~26 envios de ayer que siguen mostrando "pendiente" en tu sistema aunque en MercadoLibre probablemente ya fueron entregados o tienen otro estado. El webhook solo funciona hacia adelante (para notificaciones nuevas), pero no corrige lo que ya paso.

Ademas, la funcion de sincronizacion (`mercadolibre-sync`) ya actualiza envios existentes, pero usa un **mapeo hardcodeado** en lugar de la tabla `ml_status_mapping`, por lo que no reconoce todos los estados posibles (ausente, devuelto, etc.).

## Solucion

### 1. Corregir la sincronizacion existente para usar `ml_status_mapping`

Modificar `mercadolibre-sync` (lineas 190-214) para que en vez de usar un mapeo hardcodeado:

```text
// Actual (hardcodeado, solo 3 estados):
const newEnvioEstado = mlShippingStatus === 'shipped' ? 'en_transito' :
                       mlShippingStatus === 'delivered' ? 'entregado' : 'pendiente';
```

Use la tabla `ml_status_mapping` con el status y substatus del shipment real de ML, registre en historial, y cubra todos los estados.

### 2. Consultar el detalle del shipment en ML para obtener substatus

Actualmente para envios existentes solo lee `orderItem.shipping.status` (sin substatus). Se agregara una llamada a la API de ML `/shipments/{id}` para obtener el `substatus` real y poder mapear correctamente (ej: `shipped` + `out_for_delivery` = `en_reparto`).

### 3. Agregar boton "Actualizar Estados" en la pantalla de Sellers

Agregar un boton en `src/pages/ecommerce/Sellers.tsx` que ejecute la sincronizacion (ya existente) para que puedas actualizar estados cuando quieras.

## Cambios por archivo

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/mercadolibre-sync/index.ts` | Reemplazar mapeo hardcodeado por consulta a `ml_status_mapping` con status+substatus. Obtener substatus de la API de ML. Registrar cambios en `envio_historial`. |
| `src/pages/ecommerce/Sellers.tsx` | Ya tiene boton "Sincronizar" que hace lo mismo, no requiere cambios adicionales |

## Detalle tecnico

### Cambio en mercadolibre-sync (lineas 190-214)

```text
if (existingEnvioId) {
  const mlShippingStatus = orderItem.shipping?.status || 'ready_to_ship';
  const mlSubstatus = orderItem.shipping?.substatus || null;

  // Si no hay substatus en la orden, consultar la API de ML
  let finalSubstatus = mlSubstatus;
  if (!finalSubstatus && mlShippingStatus !== 'ready_to_ship') {
    const shipResp = await fetch(ML_API_BASE + '/shipments/' + shipmentId, {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (shipResp.ok) {
      const shipData = await shipResp.json();
      finalSubstatus = shipData.substatus || null;
    }
  }

  // Buscar mapping en ml_status_mapping
  let mappingQuery = supabase.from('ml_status_mapping')
    .select('estado_interno, descripcion')
    .eq('ml_status', mlShippingStatus);

  if (finalSubstatus) {
    mappingQuery = mappingQuery.eq('ml_substatus', finalSubstatus);
  } else {
    mappingQuery = mappingQuery.is('ml_substatus', null);
  }

  let { data: mapping } = await mappingQuery.maybeSingle();

  // Fallback sin substatus
  if (!mapping && finalSubstatus) {
    const { data: fb } = await supabase.from('ml_status_mapping')
      .select('estado_interno, descripcion')
      .eq('ml_status', mlShippingStatus)
      .is('ml_substatus', null)
      .maybeSingle();
    mapping = fb;
  }

  const newEnvioEstado = mapping?.estado_interno || 'pendiente';

  // Obtener estado actual para comparar
  const { data: envioActual } = await supabase.from('envios')
    .select('estado').eq('id', existingEnvioId).single();

  // Actualizar envio
  await supabase.from('envios').update({
    estado: newEnvioEstado,
    ml_sync_status: 'synced',
    ml_last_sync_at: new Date().toISOString(),
  }).eq('id', existingEnvioId);

  // Registrar en historial si cambio
  if (envioActual && envioActual.estado !== newEnvioEstado) {
    await supabase.from('envio_historial').insert({
      envio_id: existingEnvioId,
      estado_anterior: envioActual.estado,
      estado_nuevo: newEnvioEstado,
      notas: 'Sincronizacion ML: ' + (mapping?.descripcion || mlShippingStatus),
      ubicacion: 'ML Sync',
    });
  }

  // Actualizar ecommerce_order
  await supabase.from('ecommerce_orders').update({
    ml_shipping_status: mlShippingStatus,
    fulfillment_status: newEnvioEstado === 'entregado' ? 'fulfilled' : 'pending',
    updated_at: new Date().toISOString(),
  }).eq('ml_shipment_id', shipmentId);

  existing++;
  continue;
}
```

## Resultado esperado

- Al presionar "Sincronizar" en cualquier seller de ML, se actualizaran los estados de TODOS sus envios existentes usando el mapeo correcto
- Los envios de ayer que estan en "pendiente" pasaran a "entregado", "no_entregado", etc. segun su estado real en ML
- Cada cambio quedara registrado en el historial
