
-- Add precio_tarifa_vigente column to envios
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS precio_tarifa_vigente NUMERIC DEFAULT NULL;

-- Backfill: copy precio_total to precio_tarifa_vigente for all existing envios
-- that don't have a liquidacion_seller_id yet (not settled)
UPDATE public.envios
SET precio_tarifa_vigente = precio_total
WHERE precio_tarifa_vigente IS NULL;
