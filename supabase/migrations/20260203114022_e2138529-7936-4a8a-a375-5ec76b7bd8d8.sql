-- Create trial_requests table for managing trial requests
CREATE TABLE public.trial_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_empresa VARCHAR(255) NOT NULL,
  nombre_contacto VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefono VARCHAR(50),
  mensaje TEXT,
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  notas_revision TEXT
);

-- Enable RLS
ALTER TABLE public.trial_requests ENABLE ROW LEVEL SECURITY;

-- Public insert policy (anyone can submit a trial request)
CREATE POLICY "Anyone can submit trial request"
ON public.trial_requests
FOR INSERT
WITH CHECK (true);

-- Super admins can view all trial requests
CREATE POLICY "Super admins can view trial requests"
ON public.trial_requests
FOR SELECT
USING (public.current_user_is_super_admin());

-- Super admins can update trial requests
CREATE POLICY "Super admins can update trial requests"
ON public.trial_requests
FOR UPDATE
USING (public.current_user_is_super_admin());

-- Add Mercado Pago columns to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS mercadopago_plan_id VARCHAR(255);

-- Add Mercado Pago columns to tenant_subscriptions
ALTER TABLE public.tenant_subscriptions 
ADD COLUMN IF NOT EXISTS mercadopago_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS mercadopago_payer_id VARCHAR(255);