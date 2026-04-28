-- Add fields to track driver advances in cash movements
ALTER TABLE public.movimientos_caja
  ADD COLUMN IF NOT EXISTS chofer_id UUID,
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS descontado_en_liquidacion_id UUID;

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_chofer_pendiente
  ON public.movimientos_caja (chofer_id, descontado_en_liquidacion_id)
  WHERE categoria = 'adelanto_chofer';

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_categoria
  ON public.movimientos_caja (categoria);