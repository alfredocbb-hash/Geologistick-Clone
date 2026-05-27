-- Add column for storing raw ML substatus
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS ml_substatus_actual TEXT;

-- Add missing mapping rows for new ML rescheduled substatuses
INSERT INTO public.ml_status_mapping (ml_status, ml_substatus, estado_interno)
VALUES
  ('shipped', 'rescheduled_by_meli', 'reprogramado'),
  ('shipped', 'rescheduled_by_buyer', 'reprogramado')
ON CONFLICT DO NOTHING;