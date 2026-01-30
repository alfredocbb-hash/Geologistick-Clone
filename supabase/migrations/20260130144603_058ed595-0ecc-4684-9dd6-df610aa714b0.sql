-- Tabla para asociar tarifas a sucursales
CREATE TABLE public.sucursal_tarifas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  tarifa_id UUID NOT NULL REFERENCES tarifas(id) ON DELETE CASCADE,
  habilitada BOOLEAN DEFAULT true,
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sucursal_id, tarifa_id)
);

-- RLS
ALTER TABLE public.sucursal_tarifas ENABLE ROW LEVEL SECURITY;

-- Policy para ver
CREATE POLICY "Ver sucursal_tarifas de su tenant"
  ON public.sucursal_tarifas
  FOR SELECT
  TO authenticated
  USING (tenant_id = current_user_tenant() OR current_user_is_super_admin());

-- Policy para gestionar (admin)
CREATE POLICY "Gestionar sucursal_tarifas"
  ON public.sucursal_tarifas
  FOR ALL
  TO authenticated
  USING ((tenant_id = current_user_tenant() AND is_admin(auth.uid())) OR is_super_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_sucursal_tarifas_updated_at
  BEFORE UPDATE ON public.sucursal_tarifas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();