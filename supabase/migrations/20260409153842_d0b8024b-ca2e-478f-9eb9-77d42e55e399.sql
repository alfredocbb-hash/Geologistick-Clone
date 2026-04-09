ALTER TABLE public.envios 
  ADD COLUMN IF NOT EXISTS horario_entrega_desde text,
  ADD COLUMN IF NOT EXISTS horario_entrega_hasta text;