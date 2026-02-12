

# Sincronizar Estados de MercadoLibre hacia tu Sistema

## Problema actual

Cuando el chofer entrega un paquete usando la app de MercadoLibre, ML envia una notificacion (webhook) a tu sistema. Pero actualmente el webhook **solo crea envios nuevos** cuando el estado es "ready_to_ship". Para cualquier otro cambio de estado (entregado, ausente, cancelado, reprogramado), el webhook **no actualiza el estado del envio en tu sistema**.

## Solucion

Modificar el webhook `mercadolibre-webhook` para que al recibir una notificacion de cambio de estado:

1. Busque el envio existente por `ml_shipment_id`
2. Consulte la tabla `ml_status_mapping` para traducir el estado de ML al estado interno
3. Actualice el `estado` del envio en tu sistema
4. Registre el cambio en el historial (`envio_historial`)

### Mapeo de estados (ya existente en la base de datos)

| Estado en MercadoLibre | Estado en tu sistema |
|------------------------|---------------------|
| delivered | entregado |
| not_delivered + receiver_absent | no_entregado |
| cancelled | cancelado |
| returned | devuelto |
| shipped + out_for_delivery | en_reparto |
| shipped + picked_up | recogido |
| shipped + in_transit | en_transito |

### Agregar mappings faltantes

Agregar a `ml_status_mapping` el substatus `returning_to_sender` para cuando el comprador reprograma o rechaza y el paquete vuelve.

## Cambios por archivo

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Agregar mappings faltantes para substatuses de ML (returning_to_sender, etc.) |
| `supabase/functions/mercadolibre-webhook/index.ts` | En el bloque de "otros estados" (linea 321-336): consultar `ml_status_mapping`, actualizar `estado` del envio, insertar registro en `envio_historial`, actualizar `ecommerce_orders.ml_shipping_status` |

## Detalle tecnico

### Cambio en mercadolibre-webhook/index.ts

El bloque actual (lineas 321-336) solo hace esto:

```text
// Para otros estados, solo actualiza timestamp
if (existingEnvio) {
  await supabase.from('envios').update({
    ml_sync_status: 'synced',
    ml_last_sync_at: now,
  }).eq('id', existingEnvio.id);
}
```

Se reemplazara por:

```text
if (existingEnvio) {
  // 1. Buscar mapping ML status -> estado interno
  let query = supabase.from('ml_status_mapping')
    .select('estado_interno, descripcion')
    .eq('ml_status', shipment.status);
  
  if (shipment.substatus) {
    query = query.eq('ml_substatus', shipment.substatus);
  } else {
    query = query.is('ml_substatus', null);
  }
  
  const { data: mapping } = await query.maybeSingle();
  
  // Si no hay mapping con substatus, buscar sin substatus
  if (!mapping && shipment.substatus) {
    const { data: fallbackMapping } = await supabase
      .from('ml_status_mapping')
      .select('estado_interno, descripcion')
      .eq('ml_status', shipment.status)
      .is('ml_substatus', null)
      .maybeSingle();
    mapping = fallbackMapping;
  }

  // 2. Obtener estado actual del envio
  const { data: envioActual } = await supabase
    .from('envios')
    .select('estado')
    .eq('id', existingEnvio.id)
    .single();

  // 3. Actualizar estado si hay mapping y es diferente
  if (mapping && envioActual && mapping.estado_interno !== envioActual.estado) {
    await supabase.from('envios').update({
      estado: mapping.estado_interno,
      ml_sync_status: 'synced',
      ml_last_sync_at: now,
    }).eq('id', existingEnvio.id);

    // 4. Registrar en historial
    await supabase.from('envio_historial').insert({
      envio_id: existingEnvio.id,
      estado_anterior: envioActual.estado,
      estado_nuevo: mapping.estado_interno,
      notas: 'Actualizado automaticamente via webhook MercadoLibre: ' 
             + mapping.descripcion,
      ubicacion: 'ML Webhook',
    });

    // 5. Actualizar ecommerce_orders
    await supabase.from('ecommerce_orders')
      .update({
        ml_shipping_status: shipment.status,
        fulfillment_status: mapping.estado_interno === 'entregado' 
          ? 'fulfilled' : 'pending',
      })
      .eq('ml_shipment_id', shipment.id);
  }
}
```

### Migracion SQL

```text
-- Agregar mappings adicionales de ML
INSERT INTO ml_status_mapping (ml_status, ml_substatus, estado_interno, descripcion)
VALUES 
  ('not_delivered', 'returning_to_sender', 'devuelto', 
   'No entregado - devolviendo al remitente'),
  ('not_delivered', NULL, 'no_entregado', 
   'No entregado - motivo generico')
ON CONFLICT DO NOTHING;
```

## Resultado esperado

- Chofer entrega via app ML -> tu sistema marca "Entregado" automaticamente
- Destinatario ausente en ML -> tu sistema marca "No entregado"
- Comprador cancela en ML -> tu sistema marca "Cancelado"
- Paquete devuelto en ML -> tu sistema marca "Devuelto"
- Todos los cambios quedan registrados en el historial con nota "via webhook MercadoLibre"

