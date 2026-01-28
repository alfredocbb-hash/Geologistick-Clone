-- Create function to sync ecommerce order status when envio status changes
CREATE OR REPLACE FUNCTION sync_ecommerce_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status changed
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    -- Update linked ecommerce order if exists
    UPDATE ecommerce_orders
    SET
      fulfillment_status = CASE NEW.estado::text
        WHEN 'pendiente' THEN 'pending'
        WHEN 'recogido' THEN 'processing'
        WHEN 'en_bodega' THEN 'processing'
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on envios table
DROP TRIGGER IF EXISTS on_envio_estado_change_sync_ecommerce ON envios;
CREATE TRIGGER on_envio_estado_change_sync_ecommerce
AFTER UPDATE ON envios
FOR EACH ROW
EXECUTE FUNCTION sync_ecommerce_order_status();

-- One-time fix: Update existing orders based on current shipment status
UPDATE ecommerce_orders eo
SET
  fulfillment_status = CASE e.estado::text
    WHEN 'pendiente' THEN 'pending'
    WHEN 'recogido' THEN 'processing'
    WHEN 'en_bodega' THEN 'processing'
    WHEN 'en_transito' THEN 'shipped'
    WHEN 'en_reparto' THEN 'shipped'
    WHEN 'entregado' THEN 'delivered'
    ELSE eo.fulfillment_status
  END,
  order_status = CASE e.estado::text
    WHEN 'en_reparto' THEN 'shipped'
    WHEN 'entregado' THEN 'delivered'
    WHEN 'cancelado' THEN 'cancelled'
    ELSE eo.order_status
  END,
  updated_at = now()
FROM envios e
WHERE eo.envio_id = e.id
AND eo.envio_id IS NOT NULL;