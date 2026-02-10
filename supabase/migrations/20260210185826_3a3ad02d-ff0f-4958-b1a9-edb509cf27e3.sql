
-- Update sync_ecommerce_order_status to also set ml_shipping_status
CREATE OR REPLACE FUNCTION public.sync_ecommerce_order_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process if status changed
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    -- Update linked ecommerce order if exists
    UPDATE ecommerce_orders
    SET
      fulfillment_status = CASE NEW.estado::text
        WHEN 'pendiente' THEN 'pending'
        WHEN 'recogido' THEN 'processing'
        WHEN 'en_sucursal' THEN 'processing'
        WHEN 'en_transito' THEN 'shipped'
        WHEN 'en_reparto' THEN 'shipped'
        WHEN 'primera_visita' THEN 'shipped'
        WHEN 'ausente' THEN 'shipped'
        WHEN 'entregado' THEN 'delivered'
        WHEN 'devuelto' THEN 'pending'
        WHEN 'cancelado' THEN 'pending'
        ELSE fulfillment_status
      END,
      order_status = CASE NEW.estado::text
        WHEN 'en_reparto' THEN 'shipped'
        WHEN 'entregado' THEN 'delivered'
        WHEN 'cancelado' THEN 'cancelled'
        ELSE order_status
      END,
      ml_shipping_status = CASE NEW.estado::text
        WHEN 'pendiente' THEN 'ready_to_ship'
        WHEN 'recogido' THEN 'ready_to_ship'
        WHEN 'en_sucursal' THEN 'ready_to_ship'
        WHEN 'en_transito' THEN 'shipped'
        WHEN 'en_reparto' THEN 'shipped'
        WHEN 'primera_visita' THEN 'not_delivered'
        WHEN 'ausente' THEN 'not_delivered'
        WHEN 'entregado' THEN 'delivered'
        WHEN 'devuelto' THEN 'not_delivered'
        WHEN 'cancelado' THEN 'cancelled'
        ELSE ml_shipping_status
      END,
      updated_at = now()
    WHERE envio_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Backfill existing ecommerce orders with current envio status
UPDATE ecommerce_orders eo
SET ml_shipping_status = CASE e.estado::text
  WHEN 'entregado'       THEN 'delivered'
  WHEN 'en_reparto'      THEN 'shipped'
  WHEN 'en_transito'     THEN 'shipped'
  WHEN 'primera_visita'  THEN 'not_delivered'
  WHEN 'ausente'         THEN 'not_delivered'
  WHEN 'devuelto'        THEN 'not_delivered'
  WHEN 'cancelado'       THEN 'cancelled'
  WHEN 'recogido'        THEN 'ready_to_ship'
  WHEN 'en_sucursal'     THEN 'ready_to_ship'
  ELSE 'ready_to_ship'
END,
updated_at = now()
FROM envios e
WHERE eo.envio_id = e.id
  AND eo.plataforma = 'mercadolibre';
