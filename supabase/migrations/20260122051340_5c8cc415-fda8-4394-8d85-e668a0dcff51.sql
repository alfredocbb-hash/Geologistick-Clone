-- Add percentage support to tarifa_concepto_precios
ALTER TABLE tarifa_concepto_precios 
ADD COLUMN IF NOT EXISTS es_porcentaje BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS porcentaje DECIMAL(5,2) DEFAULT NULL;

COMMENT ON COLUMN tarifa_concepto_precios.es_porcentaje IS 'Si true, usa porcentaje del valor declarado en lugar de monto fijo';
COMMENT ON COLUMN tarifa_concepto_precios.porcentaje IS 'Porcentaje a aplicar sobre valor declarado (ej: 2.5 = 2.5%)';

-- Deactivate the 'flete' concept since it's now the base price
UPDATE tarifa_conceptos 
SET activo = false 
WHERE LOWER(nombre) LIKE '%flete%' OR LOWER(codigo) LIKE '%flete%';