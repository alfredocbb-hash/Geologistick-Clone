-- Add shipping carrier configuration fields to ecommerce_sellers
ALTER TABLE public.ecommerce_sellers
ADD COLUMN IF NOT EXISTS shipping_carrier_id TEXT,
ADD COLUMN IF NOT EXISTS min_delivery_days INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS max_delivery_days INTEGER DEFAULT 5;

-- Add comment for documentation
COMMENT ON COLUMN public.ecommerce_sellers.shipping_carrier_id IS 'Tiendanube shipping carrier ID';
COMMENT ON COLUMN public.ecommerce_sellers.min_delivery_days IS 'Minimum delivery days for shipping quotes';
COMMENT ON COLUMN public.ecommerce_sellers.max_delivery_days IS 'Maximum delivery days for shipping quotes';