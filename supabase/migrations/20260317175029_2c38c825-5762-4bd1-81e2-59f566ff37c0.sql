
-- Trigger to auto-sync partner_shipments.estado_sync and origin shipment status
CREATE OR REPLACE FUNCTION public.sync_partner_shipment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ps RECORD;
BEGIN
  -- Only act if estado actually changed
  IF OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NEW;
  END IF;

  -- Find partner_shipment linked to this envio as destination
  SELECT id, envio_origen_id, partnership_id, estado_sync
  INTO v_ps
  FROM partner_shipments
  WHERE envio_destino_id = NEW.id;

  -- If this envio is not a partner destination, skip
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Update estado_sync based on the destination shipment's new status
  IF NEW.estado IN ('en_reparto', 'en_transito', 'en_sucursal', 'recogido') THEN
    UPDATE partner_shipments SET estado_sync = 'en_curso' WHERE id = v_ps.id AND estado_sync != 'completado';

  ELSIF NEW.estado = 'entregado' THEN
    UPDATE partner_shipments SET estado_sync = 'completado' WHERE id = v_ps.id;
    -- Propagate entregado to origin shipment
    UPDATE envios SET estado = 'entregado', updated_at = now()
    WHERE id = v_ps.envio_origen_id
      AND estado NOT IN ('entregado', 'cancelado', 'devuelto');
    -- Log history on origin
    INSERT INTO envio_historial (envio_id, estado_anterior, estado_nuevo, notas)
    SELECT v_ps.envio_origen_id, e.estado, 'entregado',
           'Entregado por partner. Tracking destino: ' || NEW.tracking_number
    FROM envios e WHERE e.id = v_ps.envio_origen_id
      AND e.estado NOT IN ('entregado', 'cancelado', 'devuelto');

  ELSIF NEW.estado IN ('devuelto', 'cancelado') THEN
    UPDATE partner_shipments SET estado_sync = 'rechazado' WHERE id = v_ps.id AND estado_sync != 'completado';
    -- Propagate status to origin
    UPDATE envios SET estado = NEW.estado, updated_at = now()
    WHERE id = v_ps.envio_origen_id
      AND estado NOT IN ('entregado', 'cancelado', 'devuelto');
    INSERT INTO envio_historial (envio_id, estado_anterior, estado_nuevo, notas)
    SELECT v_ps.envio_origen_id, e.estado, NEW.estado::text,
           CASE NEW.estado WHEN 'devuelto' THEN 'Devuelto por partner' ELSE 'Cancelado por partner' END
    FROM envios e WHERE e.id = v_ps.envio_origen_id
      AND e.estado NOT IN ('entregado', 'cancelado', 'devuelto');
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS trg_sync_partner_shipment ON public.envios;

CREATE TRIGGER trg_sync_partner_shipment
AFTER UPDATE ON public.envios
FOR EACH ROW EXECUTE FUNCTION public.sync_partner_shipment_status();
