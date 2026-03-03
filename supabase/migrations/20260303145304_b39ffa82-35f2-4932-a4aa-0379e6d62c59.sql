
-- Drop existing UPDATE policy on envios
DROP POLICY IF EXISTS "Actualizar envíos de su tenant" ON public.envios;

-- Create expanded UPDATE policy that includes sucursal, operador, despachador roles
CREATE POLICY "Actualizar envíos de su tenant" ON public.envios
FOR UPDATE TO authenticated
USING (
  tenant_id = public.current_user_tenant()
  AND (
    -- Admin/super_admin can update any shipment in their tenant
    public.is_admin(auth.uid())
    -- Assigned driver can update their shipments
    OR chofer_id = auth.uid()
    -- Branch users can update shipments in their branch (origin or destination)
    OR (
      public.current_user_has_role('sucursal'::app_role)
      AND (
        sucursal_origen_id = public.current_user_sucursal()
        OR sucursal_destino_id = public.current_user_sucursal()
      )
    )
    OR (
      public.current_user_has_role('operador'::app_role)
      AND (
        sucursal_origen_id = public.current_user_sucursal()
        OR sucursal_destino_id = public.current_user_sucursal()
      )
    )
    OR (
      public.current_user_has_role('despachador'::app_role)
      AND (
        sucursal_origen_id = public.current_user_sucursal()
        OR sucursal_destino_id = public.current_user_sucursal()
      )
    )
  )
  OR public.is_super_admin(auth.uid())
);
