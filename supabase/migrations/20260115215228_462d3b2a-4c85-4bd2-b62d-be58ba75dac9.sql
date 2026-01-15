-- =============================================
-- FASE 2: WHITE-LABELING
-- =============================================

-- 1. Crear tabla de branding por tenant
CREATE TABLE public.tenant_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  nombre_app VARCHAR(100) DEFAULT 'LogiTrack',
  logo_light TEXT,
  logo_dark TEXT,
  favicon TEXT,
  color_primario VARCHAR(7) DEFAULT '#3B82F6',
  color_primario_foreground VARCHAR(7) DEFAULT '#FFFFFF',
  color_secundario VARCHAR(7) DEFAULT '#1E40AF',
  color_acento VARCHAR(7) DEFAULT '#10B981',
  color_fondo VARCHAR(7) DEFAULT '#FFFFFF',
  color_fondo_dark VARCHAR(7) DEFAULT '#09090B',
  color_sidebar VARCHAR(7) DEFAULT '#F8FAFC',
  color_sidebar_dark VARCHAR(7) DEFAULT '#1A1A2E',
  custom_css TEXT,
  footer_text TEXT,
  support_email VARCHAR(255),
  support_phone VARCHAR(50),
  custom_domain VARCHAR(255),
  meta_title VARCHAR(100),
  meta_description VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Índice para tenant_id
CREATE INDEX idx_tenant_branding_tenant ON public.tenant_branding(tenant_id);

-- 3. Habilitar RLS
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
CREATE POLICY "Ver branding de su tenant"
ON public.tenant_branding FOR SELECT
USING (
  tenant_id = current_user_tenant()
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Gestionar branding de su tenant"
ON public.tenant_branding FOR ALL
USING (
  (tenant_id = current_user_tenant() AND is_admin(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- 5. Crear branding default para el tenant existente
INSERT INTO public.tenant_branding (
  tenant_id,
  nombre_app,
  color_primario,
  color_primario_foreground,
  color_secundario,
  color_acento,
  support_email,
  footer_text
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'LogiTrack',
  '#3B82F6',
  '#FFFFFF',
  '#1E40AF',
  '#10B981',
  'soporte@logitrack.app',
  '© 2025 LogiTrack. Todos los derechos reservados.'
);

-- 6. Trigger para updated_at
CREATE TRIGGER update_tenant_branding_updated_at
BEFORE UPDATE ON public.tenant_branding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();