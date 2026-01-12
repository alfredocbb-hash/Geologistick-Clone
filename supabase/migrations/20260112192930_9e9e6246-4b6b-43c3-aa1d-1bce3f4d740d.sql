-- Add columns to track rescheduled shipments
ALTER TABLE public.envios 
ADD COLUMN IF NOT EXISTS reprogramado_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ultima_reprogramacion timestamp with time zone;

-- Create index for efficient querying of rescheduled shipments
CREATE INDEX IF NOT EXISTS idx_envios_reprogramados 
ON public.envios (reprogramado_count, estado) 
WHERE reprogramado_count > 0;