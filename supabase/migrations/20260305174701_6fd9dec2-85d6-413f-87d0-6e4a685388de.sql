
-- 1. Fix SELECT policy: allow operational roles to see ALL clients in their tenant
DROP POLICY IF EXISTS "Ver clientes de su tenant" ON public.clientes;
CREATE POLICY "Ver clientes de su tenant" ON public.clientes
FOR SELECT TO authenticated
USING (
  (
    tenant_id = current_user_tenant()
    AND (
      is_admin(auth.uid())
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'atencion_cliente'::app_role)
      OR has_role(auth.uid(), 'sucursal'::app_role)
      OR has_role(auth.uid(), 'despachador'::app_role)
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR has_role(auth.uid(), 'chofer'::app_role)
      OR (sucursal_id = get_user_sucursal(auth.uid()))
      OR (user_id = auth.uid())
    )
  )
  OR is_super_admin(auth.uid())
);

-- 2. Fix INSERT policy: add chofer role
DROP POLICY IF EXISTS "Crear clientes en su tenant" ON public.clientes;
CREATE POLICY "Crear clientes en su tenant" ON public.clientes
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = current_user_tenant()
  AND (
    is_admin(auth.uid())
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'atencion_cliente'::app_role)
    OR has_role(auth.uid(), 'sucursal'::app_role)
    OR has_role(auth.uid(), 'despachador'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'chofer'::app_role)
    OR (sucursal_id = get_user_sucursal(auth.uid()))
  )
);

-- 3. Fix UPDATE policy: add operational roles
DROP POLICY IF EXISTS "Actualizar clientes de su tenant" ON public.clientes;
CREATE POLICY "Actualizar clientes de su tenant" ON public.clientes
FOR UPDATE TO authenticated
USING (
  (
    tenant_id = current_user_tenant()
    AND (
      is_admin(auth.uid())
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'atencion_cliente'::app_role)
      OR has_role(auth.uid(), 'sucursal'::app_role)
      OR has_role(auth.uid(), 'despachador'::app_role)
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR has_role(auth.uid(), 'chofer'::app_role)
      OR (sucursal_id = get_user_sucursal(auth.uid()))
    )
  )
  OR is_super_admin(auth.uid())
);
