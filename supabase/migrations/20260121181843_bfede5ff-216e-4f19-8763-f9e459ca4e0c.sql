-- 1. Add pickup commission columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS comision_retiro_tipo text DEFAULT 'ninguna',
ADD COLUMN IF NOT EXISTS comision_retiro_porcentaje numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS comision_retiro_fija numeric DEFAULT 0;

COMMENT ON COLUMN public.profiles.comision_retiro_tipo IS 'Tipo de comisión por retiro: ninguna, porcentaje, fija, mixta';
COMMENT ON COLUMN public.profiles.comision_retiro_porcentaje IS 'Porcentaje de comisión por retiro';
COMMENT ON COLUMN public.profiles.comision_retiro_fija IS 'Monto fijo de comisión por retiro';

-- 2. Add tipo column to comisiones table to differentiate delivery vs pickup
ALTER TABLE public.comisiones
ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'entrega';

COMMENT ON COLUMN public.comisiones.tipo IS 'Tipo de comisión: entrega o retiro';

-- 3. Fix existing shipments: set pago_contra_entrega = true where tipo_pago = 'destino'
UPDATE public.envios 
SET pago_contra_entrega = true 
WHERE tipo_pago = 'destino' AND (pago_contra_entrega = false OR pago_contra_entrega IS NULL);