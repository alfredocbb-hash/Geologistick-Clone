ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS planificador_enabled BOOLEAN NOT NULL DEFAULT true;