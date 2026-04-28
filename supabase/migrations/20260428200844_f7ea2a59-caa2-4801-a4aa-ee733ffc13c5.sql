ALTER TABLE public.facturas
ADD COLUMN IF NOT EXISTS line_items jsonb;