-- Add columns for tracking who picks up the package and invoicing
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS nombre_retira TEXT;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS dni_retira TEXT;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS parentesco_retira TEXT;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS retira_firma TEXT;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS retira_foto TEXT;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS entregado_en_sucursal BOOLEAN DEFAULT false;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS entregado_por UUID;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS requiere_factura BOOLEAN DEFAULT false;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS factura_tipo TEXT;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS factura_cae TEXT;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS factura_numero TEXT;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS factura_fecha TIMESTAMPTZ;

-- Add index for branch deliveries
CREATE INDEX IF NOT EXISTS idx_envios_entregado_en_sucursal ON public.envios(entregado_en_sucursal) WHERE entregado_en_sucursal = true;