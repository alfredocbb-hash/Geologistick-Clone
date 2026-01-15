-- Create subscription_plans table with Stripe product/price IDs
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  stripe_product_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL UNIQUE,
  max_users INTEGER NOT NULL,
  max_branches INTEGER NOT NULL,
  max_shipments_month INTEGER NOT NULL,
  price_monthly NUMERIC NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone can read active plans
CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans
FOR SELECT
USING (is_active = true);

-- Only super admins can manage plans
CREATE POLICY "Super admins can manage plans"
ON public.subscription_plans
FOR ALL
USING (is_super_admin(auth.uid()));

-- Insert the 3 plans
INSERT INTO public.subscription_plans (name, description, stripe_product_id, stripe_price_id, max_users, max_branches, max_shipments_month, price_monthly, features, display_order)
VALUES 
  ('LogiTrack Básico', 'Plan básico: 5 usuarios, 2 sucursales, 500 envíos/mes', 'prod_TnZwYdoJdLrIy1', 'price_1SpymPCPBiZ94mLRcP5DHbsb', 5, 2, 500, 49, '["5 usuarios", "2 sucursales", "500 envíos/mes", "Soporte por email"]'::jsonb, 1),
  ('LogiTrack Profesional', 'Plan profesional: 15 usuarios, 10 sucursales, 2000 envíos/mes', 'prod_TnZwzJAkLSiMRK', 'price_1SpymgCPBiZ94mLRE4D6vtZ8', 15, 10, 2000, 149, '["15 usuarios", "10 sucursales", "2000 envíos/mes", "Soporte prioritario", "Reportes avanzados"]'::jsonb, 2),
  ('LogiTrack Enterprise', 'Plan enterprise: usuarios ilimitados, sucursales ilimitadas, envíos ilimitados', 'prod_TnZw7nHbkjVvYg', 'price_1SpymsCPBiZ94mLRNyKxvul0', -1, -1, -1, 399, '["Usuarios ilimitados", "Sucursales ilimitadas", "Envíos ilimitados", "Soporte 24/7", "API completa", "Gestor de cuenta dedicado"]'::jsonb, 3);

-- Create tenant_subscriptions table
CREATE TABLE public.tenant_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Admins of tenant can view their subscription
CREATE POLICY "Tenant admins can view subscription"
ON public.tenant_subscriptions
FOR SELECT
USING (tenant_id = current_user_tenant() AND (is_admin(auth.uid()) OR is_super_admin(auth.uid())));

-- Only super admins can manage subscriptions directly
CREATE POLICY "Super admins can manage subscriptions"
ON public.tenant_subscriptions
FOR ALL
USING (is_super_admin(auth.uid()));

-- Service role can manage (for edge functions)
CREATE POLICY "Service role can manage subscriptions"
ON public.tenant_subscriptions
FOR ALL
USING (auth.role() = 'service_role');

-- Create tenant_usage table for tracking monthly usage
CREATE TABLE public.tenant_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: YYYY-MM
  shipments_count INTEGER DEFAULT 0,
  users_count INTEGER DEFAULT 0,
  branches_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, month_year)
);

-- Enable RLS
ALTER TABLE public.tenant_usage ENABLE ROW LEVEL SECURITY;

-- Tenant admins can view their usage
CREATE POLICY "Tenant admins can view usage"
ON public.tenant_usage
FOR SELECT
USING (tenant_id = current_user_tenant() AND (is_admin(auth.uid()) OR is_super_admin(auth.uid())));

-- Service role can manage usage
CREATE POLICY "Service role can manage usage"
ON public.tenant_usage
FOR ALL
USING (auth.role() = 'service_role');

-- Function to get or create current month usage record
CREATE OR REPLACE FUNCTION public.get_or_create_tenant_usage(p_tenant_id UUID)
RETURNS public.tenant_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_year TEXT;
  v_usage public.tenant_usage;
BEGIN
  v_month_year := to_char(now(), 'YYYY-MM');
  
  SELECT * INTO v_usage
  FROM public.tenant_usage
  WHERE tenant_id = p_tenant_id AND month_year = v_month_year;
  
  IF NOT FOUND THEN
    INSERT INTO public.tenant_usage (tenant_id, month_year, shipments_count, users_count, branches_count)
    VALUES (p_tenant_id, v_month_year, 0, 0, 0)
    RETURNING * INTO v_usage;
  END IF;
  
  RETURN v_usage;
END;
$$;

-- Function to increment shipment count
CREATE OR REPLACE FUNCTION public.increment_shipment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_year TEXT;
BEGIN
  v_month_year := to_char(now(), 'YYYY-MM');
  
  INSERT INTO public.tenant_usage (tenant_id, month_year, shipments_count)
  VALUES (NEW.tenant_id, v_month_year, 1)
  ON CONFLICT (tenant_id, month_year)
  DO UPDATE SET shipments_count = tenant_usage.shipments_count + 1, updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Trigger to increment shipment count on new envio
CREATE TRIGGER increment_shipment_count_trigger
AFTER INSERT ON public.envios
FOR EACH ROW
EXECUTE FUNCTION public.increment_shipment_count();

-- Function to get tenant subscription with plan details
CREATE OR REPLACE FUNCTION public.get_tenant_subscription_details(p_tenant_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  plan_name TEXT,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  status TEXT,
  max_users INTEGER,
  max_branches INTEGER,
  max_shipments_month INTEGER,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.id,
    sp.name,
    sp.stripe_product_id,
    sp.stripe_price_id,
    ts.status,
    sp.max_users,
    sp.max_branches,
    sp.max_shipments_month,
    ts.current_period_end,
    ts.cancel_at_period_end
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON ts.plan_id = sp.id
  WHERE ts.tenant_id = p_tenant_id;
END;
$$;