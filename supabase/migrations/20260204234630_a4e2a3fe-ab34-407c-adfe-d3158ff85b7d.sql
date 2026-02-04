-- Add column to store concept breakdown in branch settlement details
ALTER TABLE liquidacion_sucursal_detalles 
ADD COLUMN IF NOT EXISTS desglose_conceptos JSONB DEFAULT '{}';

-- Add comment explaining the structure
COMMENT ON COLUMN liquidacion_sucursal_detalles.desglose_conceptos IS 'Stores per-concept breakdown: {"flete": {"venta": 5000, "porcentaje": 25, "comision": 1250}, "seguro": {...}}';

-- Also add a resumen_conceptos column to the main settlement table for aggregated data
ALTER TABLE liquidaciones_sucursal 
ADD COLUMN IF NOT EXISTS resumen_conceptos JSONB DEFAULT NULL;

COMMENT ON COLUMN liquidaciones_sucursal.resumen_conceptos IS 'Aggregated concept summary by payment type: {"contado": [...], "destino": [...], "cta_cte": [...]}';