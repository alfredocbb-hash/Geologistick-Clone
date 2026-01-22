-- Add column to track if a concept should be multiplied by quantity of packages
ALTER TABLE public.tarifa_concepto_precios
ADD COLUMN multiplicar_por_bultos BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.tarifa_concepto_precios.multiplicar_por_bultos IS 'If true, this concept price is multiplied by the number of packages (cantidad_bultos)';