
CREATE TABLE public.chofer_comisiones_zona (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chofer_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  ciudad TEXT,
  provincia TEXT,
  codigo_postal_desde TEXT,
  codigo_postal_hasta TEXT,
  monto_fijo NUMERIC NOT NULL DEFAULT 0,
  porcentaje NUMERIC NOT NULL DEFAULT 0,
  prioridad INTEGER NOT NULL DEFAULT 100,
  activa BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chofer_comisiones_zona_match_check
    CHECK (
      ciudad IS NOT NULL
      OR provincia IS NOT NULL
      OR codigo_postal_desde IS NOT NULL
    )
);

CREATE INDEX idx_chofer_comisiones_zona_chofer ON public.chofer_comisiones_zona(chofer_id, activa);
CREATE INDEX idx_chofer_comisiones_zona_tenant ON public.chofer_comisiones_zona(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chofer_comisiones_zona TO authenticated;
GRANT ALL ON public.chofer_comisiones_zona TO service_role;

ALTER TABLE public.chofer_comisiones_zona ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users view chofer zone commissions"
ON public.chofer_comisiones_zona FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant() OR public.current_user_is_super_admin());

CREATE POLICY "Tenant admins insert chofer zone commissions"
ON public.chofer_comisiones_zona FOR INSERT TO authenticated
WITH CHECK (
  (tenant_id = public.current_user_tenant() AND public.current_user_is_admin())
  OR public.current_user_is_super_admin()
);

CREATE POLICY "Tenant admins update chofer zone commissions"
ON public.chofer_comisiones_zona FOR UPDATE TO authenticated
USING (
  (tenant_id = public.current_user_tenant() AND public.current_user_is_admin())
  OR public.current_user_is_super_admin()
);

CREATE POLICY "Tenant admins delete chofer zone commissions"
ON public.chofer_comisiones_zona FOR DELETE TO authenticated
USING (
  (tenant_id = public.current_user_tenant() AND public.current_user_is_admin())
  OR public.current_user_is_super_admin()
);

CREATE TRIGGER set_chofer_comisiones_zona_updated_at
BEFORE UPDATE ON public.chofer_comisiones_zona
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
