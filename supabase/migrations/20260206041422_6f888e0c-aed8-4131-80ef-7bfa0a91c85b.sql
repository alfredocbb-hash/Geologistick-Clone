-- Add modo_flex column to tenants table
ALTER TABLE tenants ADD COLUMN modo_flex boolean DEFAULT false;

-- Add comment to document the column
COMMENT ON COLUMN tenants.modo_flex IS 'Habilita interfaz simplificada estilo ML Flex para operación de última milla';