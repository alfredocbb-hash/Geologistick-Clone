-- Enum para tipos de integración
CREATE TYPE integration_type AS ENUM (
  'mercado_pago',
  'google_maps', 
  'whatsapp',
  'email_smtp',
  'sms'
);

CREATE TYPE integration_environment AS ENUM ('sandbox', 'production');

-- Tabla de integraciones del sistema
CREATE TABLE public.system_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type integration_type NOT NULL,
  config_key TEXT NOT NULL,
  config_value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  environment integration_environment DEFAULT 'sandbox',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(integration_type, config_key, environment)
);

-- Solo super_admin puede ver/editar integraciones
ALTER TABLE public.system_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access on system_integrations" 
ON public.system_integrations
FOR ALL 
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_system_integrations_updated_at
BEFORE UPDATE ON public.system_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();