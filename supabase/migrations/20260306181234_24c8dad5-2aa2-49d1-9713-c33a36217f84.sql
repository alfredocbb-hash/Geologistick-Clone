ALTER TABLE public.tarifa_conceptos DROP CONSTRAINT IF EXISTS tarifa_conceptos_codigo_key;
CREATE UNIQUE INDEX tarifa_conceptos_tenant_codigo_key ON public.tarifa_conceptos (codigo, tenant_id);