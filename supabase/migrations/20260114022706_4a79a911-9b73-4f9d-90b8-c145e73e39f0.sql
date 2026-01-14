-- Add geolocation columns for delivery location
ALTER TABLE public.envios
ADD COLUMN IF NOT EXISTS entrega_lat NUMERIC,
ADD COLUMN IF NOT EXISTS entrega_lng NUMERIC;

COMMENT ON COLUMN envios.entrega_lat IS 'Latitud donde se confirmó la entrega';
COMMENT ON COLUMN envios.entrega_lng IS 'Longitud donde se confirmó la entrega';