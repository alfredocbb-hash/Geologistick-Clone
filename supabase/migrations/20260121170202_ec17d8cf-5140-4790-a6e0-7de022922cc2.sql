-- Add columns to store recipient and sender names directly on shipment
ALTER TABLE public.envios 
ADD COLUMN IF NOT EXISTS nombre_destinatario text,
ADD COLUMN IF NOT EXISTS nombre_remitente text;

-- Update existing shipments with names from linked clients
UPDATE public.envios e
SET 
  nombre_destinatario = COALESCE(
    (SELECT TRIM(CONCAT(c.nombre, ' ', COALESCE(c.apellido, ''))) 
     FROM public.clientes c WHERE c.id = e.destinatario_id),
    e.nombre_destinatario
  ),
  nombre_remitente = COALESCE(
    (SELECT TRIM(CONCAT(c.nombre, ' ', COALESCE(c.apellido, ''))) 
     FROM public.clientes c WHERE c.id = e.remitente_id),
    e.nombre_remitente
  )
WHERE e.nombre_destinatario IS NULL OR e.nombre_remitente IS NULL;