
-- Fix 1: RLS sucursal_zonas - agregar soporte super admin
DROP POLICY IF EXISTS "Admins manage coverage zones for their tenant" ON public.sucursal_zonas;
CREATE POLICY "Admins manage coverage zones for their tenant"
  ON public.sucursal_zonas FOR ALL TO authenticated
  USING (
    (sucursal_id IN (SELECT id FROM sucursales WHERE tenant_id = current_user_tenant())
     AND is_admin(auth.uid()))
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    (sucursal_id IN (SELECT id FROM sucursales WHERE tenant_id = current_user_tenant())
     AND is_admin(auth.uid()))
    OR is_super_admin(auth.uid())
  );
