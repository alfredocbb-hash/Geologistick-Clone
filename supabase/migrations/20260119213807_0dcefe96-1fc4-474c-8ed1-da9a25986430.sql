-- Create trigger function to auto-set tenant_id on sucursales insert
CREATE OR REPLACE FUNCTION public.set_sucursal_tenant_id()
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
    RAISE EXCEPTION 'tenant_id is required for sucursales';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS set_sucursal_tenant_id_trigger ON public.sucursales;
CREATE TRIGGER set_sucursal_tenant_id_trigger
  BEFORE INSERT ON public.sucursales
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sucursal_tenant_id();

-- Drop existing INSERT policy if exists and create a new one that allows admins
DROP POLICY IF EXISTS "Admins can insert branches" ON public.sucursales;
DROP POLICY IF EXISTS "Users can insert branches in their tenant" ON public.sucursales;

-- New INSERT policy: admins can insert (trigger handles tenant_id)
CREATE POLICY "Admins can insert branches"
  ON public.sucursales
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_is_admin() OR public.current_user_is_super_admin()
  );