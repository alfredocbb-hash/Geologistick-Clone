-- Create tenant_api_keys table for external integrations
CREATE TABLE public.tenant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL, -- First 8 chars for identification
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;

-- Only admins of the tenant can manage API keys
CREATE POLICY "Admins can manage their tenant API keys"
ON public.tenant_api_keys
FOR ALL
USING (
  tenant_id = current_user_tenant()
  AND is_admin(auth.uid())
);

-- Super admins can manage all API keys
CREATE POLICY "Super admins can manage all API keys"
ON public.tenant_api_keys
FOR ALL
USING (current_user_is_super_admin());

-- Add updated_at trigger
CREATE TRIGGER update_tenant_api_keys_updated_at
BEFORE UPDATE ON public.tenant_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_tenant_api_keys_prefix ON public.tenant_api_keys(api_key_prefix);
CREATE INDEX idx_tenant_api_keys_tenant ON public.tenant_api_keys(tenant_id);

-- Function to validate API key and return tenant_id
CREATE OR REPLACE FUNCTION public.validate_api_key(p_api_key TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_key_id UUID;
BEGIN
  -- Get tenant_id from the API key
  SELECT tenant_id, id INTO v_tenant_id, v_key_id
  FROM public.tenant_api_keys
  WHERE api_key_prefix = LEFT(p_api_key, 8)
    AND api_key_hash = encode(sha256(p_api_key::bytea), 'hex')
    AND is_active = true;
  
  IF v_tenant_id IS NOT NULL THEN
    -- Update last_used_at
    UPDATE public.tenant_api_keys
    SET last_used_at = now()
    WHERE id = v_key_id;
  END IF;
  
  RETURN v_tenant_id;
END;
$$;