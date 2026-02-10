-- Fix movimientos_caja check constraint to allow 'ingreso'/'egreso' 
-- which are the values used by the receive_rendition RPC and Cash UI
ALTER TABLE public.movimientos_caja DROP CONSTRAINT movimientos_caja_tipo_check;
ALTER TABLE public.movimientos_caja ADD CONSTRAINT movimientos_caja_tipo_check 
  CHECK (tipo = ANY (ARRAY['ingreso'::text, 'egreso'::text, 'entrada'::text, 'salida'::text]));
