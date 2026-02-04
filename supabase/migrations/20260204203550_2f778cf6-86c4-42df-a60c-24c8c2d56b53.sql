-- Paso 2: Actualizar envíos existentes
UPDATE envios SET estado = 'en_sucursal' WHERE estado = 'en_bodega';

-- Actualizar historial (estado_anterior y estado_nuevo)
UPDATE envio_historial SET estado_anterior = 'en_sucursal' WHERE estado_anterior = 'en_bodega';
UPDATE envio_historial SET estado_nuevo = 'en_sucursal' WHERE estado_nuevo = 'en_bodega';

-- Actualizar también el trigger sync_ecommerce_order_status
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
      updated_at = now()
    WHERE envio_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;