
-- 1. Update SELECT policy to include sucursal_entrega_id
DROP POLICY IF EXISTS "Ver envíos de su tenant" ON envios;

CREATE POLICY "Ver envíos de su tenant" ON envios
FOR SELECT
USING (
  (
    (tenant_id = current_user_tenant())
    AND (
      is_admin(auth.uid())
      OR has_role(auth.uid(), 'supervisor')
      OR has_role(auth.uid(), 'chofer')
      OR has_role(auth.uid(), 'operador')
      OR has_role(auth.uid(), 'bodega')
      OR (sucursal_origen_id = get_user_sucursal(auth.uid()))
      OR (sucursal_destino_id = get_user_sucursal(auth.uid()))
      OR (sucursal_entrega_id = get_user_sucursal(auth.uid()))
      OR (chofer_id = auth.uid())
    )
  )
  OR is_super_admin(auth.uid())
);

-- 2. Update UPDATE policy to include sucursal_entrega_id
DROP POLICY IF EXISTS "Actualizar envíos de su tenant" ON public.envios;

CREATE POLICY "Actualizar envíos de su tenant" ON public.envios
FOR UPDATE TO authenticated
USING (
  (
    tenant_id = public.current_user_tenant()
    AND (
      public.is_admin(auth.uid())
      OR chofer_id = auth.uid()
      OR (
        public.current_user_has_role('sucursal'::app_role)
        AND (
          sucursal_origen_id = public.current_user_sucursal()
          OR sucursal_destino_id = public.current_user_sucursal()
          OR sucursal_entrega_id = public.current_user_sucursal()
        )
      )
      OR (
        public.current_user_has_role('operador'::app_role)
        AND (
          sucursal_origen_id = public.current_user_sucursal()
          OR sucursal_destino_id = public.current_user_sucursal()
          OR sucursal_entrega_id = public.current_user_sucursal()
        )
      )
      OR (
        public.current_user_has_role('despachador'::app_role)
        AND (
          sucursal_origen_id = public.current_user_sucursal()
          OR sucursal_destino_id = public.current_user_sucursal()
          OR sucursal_entrega_id = public.current_user_sucursal()
        )
      )
    )
  )
  OR public.is_super_admin(auth.uid())
);
