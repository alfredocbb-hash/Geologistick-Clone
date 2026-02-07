
-- Make ciudad nullable to support province-only or CP-only zones
ALTER TABLE public.sucursal_zonas ALTER COLUMN ciudad DROP NOT NULL;

-- Drop the old overly-permissive admin policy
DROP POLICY IF EXISTS "Admins gestionan zonas" ON public.sucursal_zonas;

-- Create tenant-scoped admin policy for all operations
CREATE POLICY "Admins manage coverage zones for their tenant"
  ON public.sucursal_zonas FOR ALL TO authenticated
  USING (
    sucursal_id IN (
      SELECT id FROM public.sucursales 
      WHERE tenant_id = current_user_tenant()
    )
    AND is_admin(auth.uid())
  )
  WITH CHECK (
    sucursal_id IN (
      SELECT id FROM public.sucursales 
      WHERE tenant_id = current_user_tenant()
    )
    AND is_admin(auth.uid())
  );
