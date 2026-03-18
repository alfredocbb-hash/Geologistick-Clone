
CREATE TABLE public.partner_comisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES public.tenant_partners(id) ON DELETE CASCADE,
  concepto_id UUID NOT NULL REFERENCES public.tarifa_conceptos(id) ON DELETE CASCADE,
  porcentaje_contado NUMERIC DEFAULT 0,
  porcentaje_destino NUMERIC DEFAULT 0,
  porcentaje_cta_cte NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partnership_id, concepto_id)
);

ALTER TABLE public.partner_comisiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver comisiones de partnership"
ON public.partner_comisiones FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_partners tp
    WHERE tp.id = partnership_id
    AND public.current_user_tenant() IN (tp.tenant_a_id, tp.tenant_b_id)
  )
);

CREATE POLICY "Admin gestiona comisiones de partnership"
ON public.partner_comisiones FOR ALL TO authenticated
USING (public.current_user_is_admin());

CREATE TRIGGER update_partner_comisiones_updated_at
  BEFORE UPDATE ON public.partner_comisiones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
