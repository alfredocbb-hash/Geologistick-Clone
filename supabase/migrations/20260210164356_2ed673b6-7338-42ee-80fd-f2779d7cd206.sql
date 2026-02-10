
-- Add ml_shipping_status column to ecommerce_orders
ALTER TABLE public.ecommerce_orders ADD COLUMN ml_shipping_status TEXT;

-- Backfill existing ML orders based on current statuses
UPDATE public.ecommerce_orders
SET ml_shipping_status = CASE
  WHEN fulfillment_status = 'delivered' THEN 'delivered'
  WHEN fulfillment_status = 'shipped' THEN 'shipped'
  WHEN order_status = 'cancelled' THEN 'cancelled'
  ELSE 'ready_to_ship'
END
WHERE plataforma = 'mercadolibre' AND ml_shipping_status IS NULL;
