

# Corregir Sincronización: Siempre Consultar Estado Real de ML

## Problema Identificado

La sincronización NO actualiza estados porque:

1. Para envíos existentes, usa `orderItem.shipping.status` del search API de ML, que frecuentemente devuelve `ready_to_ship` aunque el envío real ya esté `delivered` o `shipped`
2. Solo consulta `/shipments/{id}` (estado real) cuando el status NO es `ready_to_ship` -- pero la mayoría son `ready_to_ship` en el search
3. Resultado: mapping de `ready_to_ship` = `pendiente`, que es igual al estado actual, entonces no cambia nada

Los logs lo confirman: **86 envíos existentes procesados, 0 actualizaciones de estado**, y ningún log de "Status updated".

## Solución

Para envíos que YA existen en el sistema, **siempre consultar `/shipments/{id}`** para obtener el status y substatus reales de ML, sin confiar en lo que dice el search API.

## Cambios

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/mercadolibre-sync/index.ts` | Para envíos existentes: siempre llamar a `/shipments/{id}` para obtener el status/substatus real, en lugar de usar `orderItem.shipping.status` del search. Usar el status real para el mapping. |

## Detalle técnico

### Cambio en el bloque de envíos existentes (líneas 207-341)

Reemplazar la lógica actual que solo consulta el substatus condicionalmente, por una que SIEMPRE consulta el shipment real:

```text
if (existingEnvioId) {
  // SIEMPRE consultar el shipment real de ML para envíos existentes
  let realStatus = orderItem.shipping?.status || 'ready_to_ship';
  let realSubstatus = orderItem.shipping?.substatus || null;

  try {
    const shipResp = await fetch(ML_API_BASE + '/shipments/' + shipmentId, {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (shipResp.ok) {
      const shipData = await shipResp.json();
      realStatus = shipData.status || realStatus;
      realSubstatus = shipData.substatus || null;
      console.log('[ML Sync] Real shipment', shipmentId, ':', realStatus, realSubstatus);
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  } catch (e) {
    console.error('[ML Sync] Error fetching real status:', shipmentId, e);
  }

  // Buscar mapping con status/substatus REALES
  // ... (misma lógica de mapping pero usando realStatus y realSubstatus)

  // Protección anti-downgrade
  // ... (misma lógica de prioridades)

  // Actualizar ecommerce_order con el status REAL de ML
  await supabase.from('ecommerce_orders').update({
    ml_shipping_status: realStatus,
    fulfillment_status: newEnvioEstado === 'entregado' ? 'fulfilled' : 'pending',
  }).eq('ml_shipment_id', shipmentId);
}
```

### Optimización de rate limiting

Como ahora se consulta `/shipments/{id}` para cada envío existente, agregar un delay de 150ms entre llamadas para no exceder el rate limit de ML.

## Resultado esperado

- Los 97 envíos pendientes que en ML ya están entregados/en tránsito se actualizarán correctamente
- Los pedidos e-commerce pasarán de "Listo para enviar / Sin Preparar" al estado real
- Cada cambio quedará registrado en el historial

