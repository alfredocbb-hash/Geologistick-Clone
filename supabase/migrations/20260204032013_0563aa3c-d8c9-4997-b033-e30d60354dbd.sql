-- Add DELETE policy for envios table
-- Only admins of the same tenant or super_admins can delete shipments
CREATE POLICY "Eliminar envíos de su tenant"
  ON public.envios
  FOR DELETE
  USING (
    (tenant_id = current_user_tenant() AND is_admin(auth.uid()))
    OR is_super_admin(auth.uid())
  );