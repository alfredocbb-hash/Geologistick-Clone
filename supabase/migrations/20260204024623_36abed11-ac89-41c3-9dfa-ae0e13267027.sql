-- Add column to store MercadoLibre's shipping rate for Flex shipments
ALTER TABLE envios 
ADD COLUMN IF NOT EXISTS precio_flete_ml numeric(10,2) DEFAULT 0;

COMMENT ON COLUMN envios.precio_flete_ml IS 
  'Costo de envío definido por MercadoLibre para envíos Flex';