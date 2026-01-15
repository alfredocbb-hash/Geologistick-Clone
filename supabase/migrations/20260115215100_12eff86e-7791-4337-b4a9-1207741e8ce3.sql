-- =============================================
-- FASE 1: MODELO DE DATOS MULTI-TENANT
-- =============================================

-- 1. Crear tabla de tenants (empresas clientes)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  color_primario VARCHAR(7) DEFAULT '#3B82F6',
  color_secundario VARCHAR(7) DEFAULT '#1E40AF',
  color_acento VARCHAR(7) DEFAULT '#10B981',
  plan VARCHAR(50) DEFAULT 'basico',
  activo BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  max_usuarios INTEGER DEFAULT 5,
  max_sucursales INTEGER DEFAULT 3,
  max_envios_mes INTEGER DEFAULT 500,
  configuracion JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Agregar tenant_id a tablas principales
ALTER TABLE public.sucursales ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.envios ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.clientes ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.vehiculos ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.tarifas ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.system_integrations ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.arca_config ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.hojas_ruta ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.rutas_planificadas ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.liquidaciones ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.liquidaciones_sucursal ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.liquidaciones_cliente ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.pagos ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.facturas ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.incidentes ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.comisiones ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.tarifa_conceptos ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- 3. Crear índices para tenant_id (performance)
CREATE INDEX idx_sucursales_tenant ON public.sucursales(tenant_id);
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_envios_tenant ON public.envios(tenant_id);
CREATE INDEX idx_clientes_tenant ON public.clientes(tenant_id);
CREATE INDEX idx_vehiculos_tenant ON public.vehiculos(tenant_id);
CREATE INDEX idx_tarifas_tenant ON public.tarifas(tenant_id);
CREATE INDEX idx_hojas_ruta_tenant ON public.hojas_ruta(tenant_id);
CREATE INDEX idx_rutas_planificadas_tenant ON public.rutas_planificadas(tenant_id);

-- 4. Función para obtener el tenant del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_tenant(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- 5. Función para obtener el tenant del usuario autenticado
CREATE OR REPLACE FUNCTION public.current_user_tenant()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 6. Función para verificar si el usuario pertenece a un tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND tenant_id = p_tenant_id
  );
$$;

-- 7. Crear tenant default para datos existentes
INSERT INTO public.tenants (id, nombre, slug, plan, activo, max_usuarios, max_sucursales, max_envios_mes)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Empresa Principal',
  'principal',
  'enterprise',
  true,
  999,
  999,
  999999
);

-- 8. Migrar datos existentes al tenant default
UPDATE public.sucursales SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.profiles SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.envios SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.clientes SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.vehiculos SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.tarifas SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.system_integrations SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.arca_config SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.hojas_ruta SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.rutas_planificadas SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.liquidaciones SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.liquidaciones_sucursal SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.liquidaciones_cliente SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.pagos SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.facturas SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.incidentes SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.comisiones SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.tarifa_conceptos SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- 9. Habilitar RLS en tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 10. Políticas RLS para tenants
CREATE POLICY "Super admins pueden ver todos los tenants"
ON public.tenants FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins pueden gestionar tenants"
ON public.tenants FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Usuarios pueden ver su propio tenant"
ON public.tenants FOR SELECT
USING (id = current_user_tenant());

-- 11. Actualizar políticas RLS existentes para incluir aislamiento por tenant
-- Sucursales
DROP POLICY IF EXISTS "Ver sucursales según rol" ON public.sucursales;
CREATE POLICY "Ver sucursales de su tenant"
ON public.sucursales FOR SELECT
USING (
  tenant_id = current_user_tenant() 
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Gestionar sucursales" ON public.sucursales;
CREATE POLICY "Gestionar sucursales de su tenant"
ON public.sucursales FOR ALL
USING (
  (tenant_id = current_user_tenant() AND is_admin(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- Profiles - actualizar política de lectura
DROP POLICY IF EXISTS "Ver perfiles según rol" ON public.profiles;
CREATE POLICY "Ver perfiles de su tenant"
ON public.profiles FOR SELECT
USING (
  (user_id = auth.uid())
  OR (tenant_id = current_user_tenant() AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'operador'::app_role)))
  OR is_super_admin(auth.uid())
);

-- Envios
DROP POLICY IF EXISTS "Ver envíos según rol" ON public.envios;
CREATE POLICY "Ver envíos de su tenant"
ON public.envios FOR SELECT
USING (
  tenant_id = current_user_tenant()
  AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'supervisor'::app_role) 
    OR sucursal_origen_id = get_user_sucursal(auth.uid()) 
    OR sucursal_destino_id = get_user_sucursal(auth.uid()) 
    OR chofer_id = auth.uid() 
    OR created_by = auth.uid()
  )
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Crear envíos" ON public.envios;
CREATE POLICY "Crear envíos en su tenant"
ON public.envios FOR INSERT
WITH CHECK (
  tenant_id = current_user_tenant()
  AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'operador'::app_role) 
    OR has_role(auth.uid(), 'despachador'::app_role) 
    OR has_role(auth.uid(), 'atencion_cliente'::app_role) 
    OR has_role(auth.uid(), 'sucursal'::app_role) 
    OR sucursal_origen_id = get_user_sucursal(auth.uid())
  )
);

DROP POLICY IF EXISTS "Actualizar envíos según rol" ON public.envios;
CREATE POLICY "Actualizar envíos de su tenant"
ON public.envios FOR UPDATE
USING (
  tenant_id = current_user_tenant()
  AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'supervisor'::app_role) 
    OR has_role(auth.uid(), 'operador'::app_role) 
    OR has_role(auth.uid(), 'despachador'::app_role) 
    OR chofer_id = auth.uid() 
    OR sucursal_origen_id = get_user_sucursal(auth.uid())
  )
  OR is_super_admin(auth.uid())
);

-- Clientes
DROP POLICY IF EXISTS "Ver clientes de su sucursal o admin" ON public.clientes;
CREATE POLICY "Ver clientes de su tenant"
ON public.clientes FOR SELECT
USING (
  tenant_id = current_user_tenant()
  AND (
    is_admin(auth.uid()) 
    OR sucursal_id = get_user_sucursal(auth.uid()) 
    OR user_id = auth.uid()
  )
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Crear clientes" ON public.clientes;
CREATE POLICY "Crear clientes en su tenant"
ON public.clientes FOR INSERT
WITH CHECK (
  tenant_id = current_user_tenant()
  AND (
    is_admin(auth.uid()) 
    OR has_role(auth.uid(), 'operador'::app_role) 
    OR has_role(auth.uid(), 'atencion_cliente'::app_role) 
    OR has_role(auth.uid(), 'sucursal'::app_role) 
    OR sucursal_id = get_user_sucursal(auth.uid())
  )
);

DROP POLICY IF EXISTS "Actualizar clientes de su sucursal" ON public.clientes;
CREATE POLICY "Actualizar clientes de su tenant"
ON public.clientes FOR UPDATE
USING (
  tenant_id = current_user_tenant()
  AND (is_admin(auth.uid()) OR sucursal_id = get_user_sucursal(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- Vehículos
DROP POLICY IF EXISTS "Ver vehículos" ON public.vehiculos;
CREATE POLICY "Ver vehículos de su tenant"
ON public.vehiculos FOR SELECT
USING (
  tenant_id = current_user_tenant()
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Gestionar vehículos" ON public.vehiculos;
CREATE POLICY "Gestionar vehículos de su tenant"
ON public.vehiculos FOR ALL
USING (
  (tenant_id = current_user_tenant() AND is_admin(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- Tarifas
DROP POLICY IF EXISTS "Ver tarifas" ON public.tarifas;
CREATE POLICY "Ver tarifas de su tenant"
ON public.tarifas FOR SELECT
USING (
  tenant_id = current_user_tenant()
  OR is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Gestionar tarifas" ON public.tarifas;
CREATE POLICY "Gestionar tarifas de su tenant"
ON public.tarifas FOR ALL
USING (
  (tenant_id = current_user_tenant() AND is_admin(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- 12. Trigger para actualizar updated_at en tenants
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();