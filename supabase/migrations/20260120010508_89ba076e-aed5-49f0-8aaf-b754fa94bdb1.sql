-- Create trigger function to auto-set tenant_id on system_integrations insert
CREATE OR REPLACE FUNCTION public.set_integration_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If user is super_admin, allow them to set any tenant_id (for support purposes)
  -- Otherwise, always force tenant_id to be the current user's tenant
  IF NOT public.current_user_is_super_admin() THEN
    NEW.tenant_id := public.current_user_tenant();
  END IF;
  
  -- If tenant_id is still null, reject the insert
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required for system_integrations';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS set_integration_tenant_id_trigger ON public.system_integrations;
CREATE TRIGGER set_integration_tenant_id_trigger
  BEFORE INSERT ON public.system_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_integration_tenant_id();

-- Add unique constraint to prevent duplicate configs per tenant
-- First check if any duplicates exist and clean them up
DELETE FROM public.system_integrations a
USING public.system_integrations b
WHERE a.id > b.id
  AND a.tenant_id IS NOT DISTINCT FROM b.tenant_id
  AND a.integration_type = b.integration_type
  AND a.config_key = b.config_key
  AND a.environment IS NOT DISTINCT FROM b.environment;

-- Add unique constraint (using COALESCE for nullable tenant_id during transition)
DROP INDEX IF EXISTS idx_system_integrations_unique_config;
CREATE UNIQUE INDEX idx_system_integrations_unique_config 
  ON public.system_integrations (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), integration_type, config_key, COALESCE(environment, 'production'));

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can manage integrations" ON public.system_integrations;
DROP POLICY IF EXISTS "Admins can view their tenant integrations" ON public.system_integrations;
DROP POLICY IF EXISTS "Admins can insert their tenant integrations" ON public.system_integrations;
DROP POLICY IF EXISTS "Admins can update their tenant integrations" ON public.system_integrations;
DROP POLICY IF EXISTS "Admins can delete their tenant integrations" ON public.system_integrations;

-- SELECT policy: Admins see their tenant's integrations, super admins see all
CREATE POLICY "Admins can view their tenant integrations"
  ON public.system_integrations
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_super_admin()
    OR (
      public.current_user_is_admin()
      AND tenant_id = public.current_user_tenant()
    )
  );

-- INSERT policy: Admins can insert (trigger handles tenant_id)
CREATE POLICY "Admins can insert their tenant integrations"
  ON public.system_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_is_admin() OR public.current_user_is_super_admin()
  );

-- UPDATE policy: Admins can update their tenant's integrations
CREATE POLICY "Admins can update their tenant integrations"
  ON public.system_integrations
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_is_super_admin()
    OR (
      public.current_user_is_admin()
      AND tenant_id = public.current_user_tenant()
    )
  )
  WITH CHECK (
    public.current_user_is_super_admin()
    OR (
      public.current_user_is_admin()
      AND tenant_id = public.current_user_tenant()
    )
  );

-- DELETE policy: Admins can delete their tenant's integrations
CREATE POLICY "Admins can delete their tenant integrations"
  ON public.system_integrations
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_is_super_admin()
    OR (
      public.current_user_is_admin()
      AND tenant_id = public.current_user_tenant()
    )
  );