
CREATE TABLE public.liquidaciones_partner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES public.tenant_partners(id) ON DELETE CASCADE,
  partner_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  monto_total NUMERIC DEFAULT 0,
  monto_comision NUMERIC DEFAULT 0,
  cantidad_envios INT DEFAULT 0,
  estado TEXT DEFAULT 'generada',
  notas TEXT,
  metodo_pago TEXT,
  referencia_pago TEXT,
  fecha_pago TIMESTAMPTZ,
  generado_por UUID,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.liquidacion_partner_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id UUID NOT NULL REFERENCES public.liquidaciones_partner(id) ON DELETE CASCADE,
  envio_id UUID REFERENCES public.envios(id),
  concepto_id UUID REFERENCES public.tarifa_conceptos(id),
  nombre_concepto TEXT,
  monto_envio NUMERIC DEFAULT 0,
  porcentaje_comision NUMERIC DEFAULT 0,
  monto_comision NUMERIC DEFAULT 0,
  tipo_pago TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.liquidaciones_partner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidacion_partner_detalles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Select liquidaciones_partner by tenant"
ON public.liquidaciones_partner FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant());

CREATE POLICY "Insert liquidaciones_partner by admin"
ON public.liquidaciones_partner FOR INSERT TO authenticated
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "Update liquidaciones_partner by admin"
ON public.liquidaciones_partner FOR UPDATE TO authenticated
USING (public.current_user_is_admin());

CREATE POLICY "Delete liquidaciones_partner by admin"
ON public.liquidaciones_partner FOR DELETE TO authenticated
USING (public.current_user_is_admin());

CREATE POLICY "Select liquidacion_partner_detalles by tenant"
ON public.liquidacion_partner_detalles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.liquidaciones_partner lp
    WHERE lp.id = liquidacion_id AND lp.tenant_id = public.current_user_tenant()
  )
);

CREATE POLICY "Insert liquidacion_partner_detalles by admin"
ON public.liquidacion_partner_detalles FOR INSERT TO authenticated
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "Delete liquidacion_partner_detalles by admin"
ON public.liquidacion_partner_detalles FOR DELETE TO authenticated
USING (public.current_user_is_admin());
