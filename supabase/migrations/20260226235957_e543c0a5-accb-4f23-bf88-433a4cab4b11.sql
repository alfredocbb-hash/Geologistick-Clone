
-- 1. Create tenant_partners table
CREATE TABLE public.tenant_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_a_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_b_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'activa', 'suspendida', 'cancelada')),
  permisos JSONB NOT NULL DEFAULT '{"puede_derivar": true, "puede_ver_precio": false, "puede_ver_cliente": true, "puede_cambiar_estado": false}'::jsonb,
  tarifa_acordada_id UUID REFERENCES public.tarifas(id) ON DELETE SET NULL,
  notas TEXT,
  solicitado_por UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_partners_different_tenants CHECK (tenant_a_id != tenant_b_id),
  CONSTRAINT tenant_partners_unique_pair UNIQUE (tenant_a_id, tenant_b_id)
);

-- 2. Create partner_shipments table
CREATE TABLE public.partner_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES public.tenant_partners(id) ON DELETE CASCADE,
  envio_origen_id UUID NOT NULL REFERENCES public.envios(id) ON DELETE CASCADE,
  tenant_origen_id UUID NOT NULL REFERENCES public.tenants(id),
  envio_destino_id UUID REFERENCES public.envios(id) ON DELETE SET NULL,
  tenant_destino_id UUID NOT NULL REFERENCES public.tenants(id),
  estado_sync TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_sync IN ('pendiente', 'aceptado', 'rechazado', 'en_curso', 'completado')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create partner_events table
CREATE TABLE public.partner_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_shipment_id UUID REFERENCES public.partner_shipments(id) ON DELETE CASCADE,
  partnership_id UUID NOT NULL REFERENCES public.tenant_partners(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  datos JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.tenant_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS for tenant_partners
CREATE POLICY "Users can view partnerships of their tenant"
  ON public.tenant_partners FOR SELECT TO authenticated
  USING (
    public.current_user_tenant() IN (tenant_a_id, tenant_b_id)
    OR public.current_user_is_super_admin()
  );

CREATE POLICY "Admins can insert partnerships"
  ON public.tenant_partners FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_is_admin()
    AND public.current_user_tenant() IN (tenant_a_id, tenant_b_id)
  );

CREATE POLICY "Admins can update partnerships of their tenant"
  ON public.tenant_partners FOR UPDATE TO authenticated
  USING (
    public.current_user_is_admin()
    AND public.current_user_tenant() IN (tenant_a_id, tenant_b_id)
  );

-- 6. RLS for partner_shipments
CREATE POLICY "Users can view partner shipments of their tenant"
  ON public.partner_shipments FOR SELECT TO authenticated
  USING (
    public.current_user_tenant() IN (tenant_origen_id, tenant_destino_id)
    OR public.current_user_is_super_admin()
  );

CREATE POLICY "Admins can insert partner shipments"
  ON public.partner_shipments FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_is_admin()
    AND public.current_user_tenant() = tenant_origen_id
  );

CREATE POLICY "Admins can update partner shipments"
  ON public.partner_shipments FOR UPDATE TO authenticated
  USING (
    public.current_user_is_admin()
    AND public.current_user_tenant() IN (tenant_origen_id, tenant_destino_id)
  );

-- 7. RLS for partner_events
CREATE POLICY "Users can view partner events of their tenant"
  ON public.partner_events FOR SELECT TO authenticated
  USING (
    public.current_user_tenant() = tenant_id
    OR public.current_user_is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tenant_partners tp
      WHERE tp.id = partnership_id
      AND public.current_user_tenant() IN (tp.tenant_a_id, tp.tenant_b_id)
    )
  );

CREATE POLICY "System can insert partner events"
  ON public.partner_events FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_is_admin()
    AND (
      tenant_id = public.current_user_tenant()
      OR EXISTS (
        SELECT 1 FROM public.tenant_partners tp
        WHERE tp.id = partnership_id
        AND public.current_user_tenant() IN (tp.tenant_a_id, tp.tenant_b_id)
      )
    )
  );

-- 8. Indexes for performance
CREATE INDEX idx_tenant_partners_tenant_a ON public.tenant_partners(tenant_a_id);
CREATE INDEX idx_tenant_partners_tenant_b ON public.tenant_partners(tenant_b_id);
CREATE INDEX idx_tenant_partners_estado ON public.tenant_partners(estado);
CREATE INDEX idx_partner_shipments_partnership ON public.partner_shipments(partnership_id);
CREATE INDEX idx_partner_shipments_origen ON public.partner_shipments(tenant_origen_id);
CREATE INDEX idx_partner_shipments_destino ON public.partner_shipments(tenant_destino_id);
CREATE INDEX idx_partner_shipments_estado ON public.partner_shipments(estado_sync);
CREATE INDEX idx_partner_events_partnership ON public.partner_events(partnership_id);
CREATE INDEX idx_partner_events_shipment ON public.partner_events(partner_shipment_id);

-- 9. Updated_at trigger
CREATE TRIGGER update_tenant_partners_updated_at
  BEFORE UPDATE ON public.tenant_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_shipments_updated_at
  BEFORE UPDATE ON public.partner_shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
