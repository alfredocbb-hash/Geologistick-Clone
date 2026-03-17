
# Plan: Corregir flujo de envíos derivados entre partners

## Problemas encontrados

Analicé el envío ENV-5MH6ML derivado de BlackBox (tenant origen) a Beraexpress (tenant destino). Estos son los problemas:

### 1. No se transfiere información de cobro
- El envío origen tiene `pago_contra_entrega: true`, `tipo_pago: destino`, `precio_total: 15000`
- El envío destino se creó con `pago_contra_entrega: false`, `tipo_pago: contado`, `precio_total: 0`
- Resultado: se entregó sin cobrar los $15.000

### 2. El estado del envío origen no se actualiza
- ENV-5MH6ML sigue en `en_sucursal` a pesar de que ya fue derivado, aceptado y entregado por el partner
- No tiene ningún registro en `envio_historial`

### 3. El `estado_sync` del partner_shipment no progresa
- Quedó en `aceptado` incluso después de que el envío destino fue entregado
- Nunca pasa a `en_curso` ni `completado`

### 4. Tracking number del envío destino no sigue el formato estándar
- Se genera como `PRT-1773769075283-VILQ7E` en vez de usar `generate_tracking_number()` (`ENV-XXXXXX`)

### 5. Faltan datos en el envío destino
- `nombre_remitente` queda null (aunque el metadata lo tiene)
- `sucursal_origen_id` queda null (debería asignarse la sucursal del tenant destino)
- `dni_destinatario`, `email_destinatario` no se copian

---

## Cambios a implementar

### A. Edge Function `partner-sync/index.ts` — `derive_shipment`
- Al derivar, actualizar el envío origen: `estado → 'en_transito'` (o dejarlo y solo registrar historial)
- Insertar un registro en `envio_historial` del envío origen indicando que fue derivado

### B. Edge Function `partner-sync/index.ts` — `accept_shipment`
- Transferir campos de cobro: `pago_contra_entrega`, `tipo_pago`, `precio_total` (si `puede_ver_precio`)
- Incluir `nombre_remitente` (si `puede_ver_cliente`), `dni_destinatario`, `email_destinatario`
- Usar `generate_tracking_number()` via RPC en vez del formato `PRT-...`
- Asignar `sucursal_origen_id` a la misma sucursal default del tenant destino
- Agregar al metadata los campos de cobro para que se puedan ver en la tabla de envíos recibidos

### C. Edge Function `partner-sync/index.ts` — nuevo: sync de estado
- Crear un mecanismo para que cuando el envío destino cambie de estado, se actualice:
  - `partner_shipments.estado_sync` (pendiente → aceptado → en_curso → completado)
  - El envío origen reciba una notificación o actualización de estado

### D. Migración SQL — Trigger para sincronizar estado del partner shipment
- Crear un trigger en `envios` que, al cambiar de estado un envío con `tracking_externo` que empiece con `ENV-`, actualice el `partner_shipments.estado_sync` correspondiente
- Cuando el destino se entrega → marcar `estado_sync = 'completado'` y actualizar el envío origen a `ent<lov-plan>
# Plan: Corregir flujo de envíos derivados entre partners

## Problemas encontrados

Analicé el envío ENV-5MH6ML derivado de BlackBox (tenant origen) a Beraexpress (tenant destino). Estos son los problemas:

### 1. No se transfiere información de cobro
- El envío origen tiene `pago_contra_entrega: true`, `tipo_pago: destino`, `precio_total: 15000`
- El envío destino se creó con `pago_contra_entrega: false`, `tipo_pago: contado`, `precio_total: 0`
- Resultado: se entregó sin cobrar los $15.000

### 2. El estado del envío origen no se actualiza
- ENV-5MH6ML sigue en `en_sucursal` a pesar de que ya fue derivado, aceptado y entregado por el partner
- No tiene ningún registro en `envio_historial`

### 3. El `estado_sync` del partner_shipment no progresa
- Quedó en `aceptado` incluso después de que el envío destino fue entregado
- Nunca pasa a `en_curso` ni `completado`

### 4. Tracking number del envío destino no sigue el formato estándar
- Se genera como `PRT-1773769075283-VILQ7E` en vez de usar `generate_tracking_number()` (`ENV-XXXXXX`)

### 5. Faltan datos en el envío destino
- `nombre_remitente` queda null (aunque el permiso `puede_ver_cliente` está activo)
- `sucursal_origen_id` queda null (debería asignarse la sucursal default del tenant destino)
- `dni_destinatario`, `email_destinatario` no se copian

---

## Cambios a implementar

### A. Edge Function `partner-sync/index.ts` — `derive_shipment` (líneas ~200-265)
- Agregar al metadata: `pago_contra_entrega`, `tipo_pago`, `dni_destinatario`, `email_destinatario`
- Insertar registro en `envio_historial` del envío origen indicando la derivación
- Actualizar estado del envío origen a `en_transito` (ya fue despachado a otro operador)

### B. Edge Function `partner-sync/index.ts` — `accept_shipment` (líneas ~268-352)
- Usar `serviceClient.rpc('generate_tracking_number')` para generar tracking en formato `ENV-XXXXXX`
- Transferir campos de cobro desde metadata: `pago_contra_entrega`, `tipo_pago`, `precio_total`
- Incluir `nombre_remitente`, `dni_destinatario`, `email_destinatario` en el insert del envío
- Asignar `sucursal_origen_id` = `branchId` (sucursal default del tenant destino)

### C. Migración SQL — Trigger para sincronizar estado del partner shipment
Crear un trigger en `envios` que detecte cambios de estado en envíos con `envio_destino_id` en `partner_shipments`:

```sql
CREATE OR REPLACE FUNCTION sync_partner_shipment_status()
RETURNS trigger AS $$
DECLARE
  v_ps RECORD;
BEGIN
  IF OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NEW;
  END IF;

  -- Find partner_shipment linked to this envio
  SELECT * INTO v_ps
  FROM partner_shipments
  WHERE envio_destino_id = NEW.id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Update estado_sync based on new status
  IF NEW.estado IN ('en_reparto', 'en_transito') THEN
    UPDATE partner_shipments SET estado_sync = 'en_curso' WHERE id = v_ps.id;
  ELSIF NEW.estado = 'entregado' THEN
    UPDATE partner_shipments SET estado_sync = 'completado' WHERE id = v_ps.id;
    -- Update origin shipment to entregado
    UPDATE envios SET estado = 'entregado' WHERE id = v_ps.envio_origen_id
      AND estado NOT IN ('entregado', 'cancelado', 'devuelto');
  ELSIF NEW.estado IN ('devuelto', 'cancelado') THEN
    UPDATE partner_shipments SET estado_sync = 'rechazado' WHERE id = v_ps.id;
    UPDATE envios SET estado = NEW.estado WHERE id = v_ps.envio_origen_id
      AND estado NOT IN ('entregado', 'cancelado', 'devuelto');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_partner_shipment
AFTER UPDATE ON envios
FOR EACH ROW EXECUTE FUNCTION sync_partner_shipment_status();
```

---

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/partner-sync/index.ts` | Transferir datos de cobro y remitente en derive/accept, usar `generate_tracking_number()`, registrar historial, actualizar estado origen |
| Nueva migración SQL | Trigger para sincronizar `partner_shipments.estado_sync` y estado del envío origen automáticamente |

## Datos de prueba a corregir manualmente
El envío de prueba ENV-5MH6ML podría necesitar corrección manual en la base de datos para reflejar el estado correcto, pero no incluyo eso en la migración ya que es un caso puntual.
