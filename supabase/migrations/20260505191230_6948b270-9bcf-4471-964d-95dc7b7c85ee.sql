CREATE TABLE public.tarifas_terciarizadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas_terciarizadas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo_tarifa TEXT NOT NULL DEFAULT 'fija' CHECK (tipo_tarifa IN ('fija','por_zona','por_kg')),
  precio_fijo NUMERIC DEFAULT 0,
  zonas JSONB DEFAULT '[]'::jsonb,
  precio_por_kg NUMERIC DEFAULT 0,
  precio_minimo NUMERIC DEFAULT 0,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_tarifas_terciarizadas_empresa ON public.tarifas_terciarizadas(empresa_id);
CREATE INDEX idx_tarifas_terciarizadas_tenant ON public.tarifas_terciarizadas(tenant_id);

ALTER TABLE public.tarifas_terciarizadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view tenant tarifas terciarizadas"
ON public.tarifas_terciarizadas FOR SELECT
USING (
  public.current_user_is_super_admin()
  OR (public.current_user_is_admin() AND tenant_id = public.current_user_tenant())
);

CREATE POLICY "Admins can insert tenant tarifas terciarizadas"
ON public.tarifas_terciarizadas FOR INSERT
WITH CHECK (
  public.current_user_is_super_admin()
  OR (public.current_user_is_admin() AND tenant_id = public.current_user_tenant())
);

CREATE POLICY "Admins can update tenant tarifas terciarizadas"
ON public.tarifas_terciarizadas FOR UPDATE
USING (
  public.current_user_is_super_admin()
  OR (public.current_user_is_admin() AND tenant_id = public.current_user_tenant())
);

CREATE POLICY "Admins can delete tenant tarifas terciarizadas"
ON public.tarifas_terciarizadas FOR DELETE
USING (
  public.current_user_is_super_admin()
  OR (public.current_user_is_admin() AND tenant_id = public.current_user_tenant())
);

CREATE TRIGGER update_tarifas_terciarizadas_updated_at
BEFORE UPDATE ON public.tarifas_terciarizadas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();