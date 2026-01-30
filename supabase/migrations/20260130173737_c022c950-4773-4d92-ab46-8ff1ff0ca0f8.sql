-- Add column to multiply freight by package count
ALTER TABLE tarifas 
ADD COLUMN IF NOT EXISTS multiplicar_flete_por_bultos boolean DEFAULT false;

COMMENT ON COLUMN tarifas.multiplicar_flete_por_bultos IS 
  'Si es true, el flete base se multiplica por la cantidad de bultos del envío';