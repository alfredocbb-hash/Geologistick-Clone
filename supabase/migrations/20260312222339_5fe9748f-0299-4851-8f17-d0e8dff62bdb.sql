DROP POLICY IF EXISTS "Ver envíos de su tenant" ON public.envios;

CREATE POLICY "Ver envíos de su tenant" ON public.envios
FOR SELECT TO public
USING (
  (
    (tenant_id = current_user_tenant()) AND (
      is_admin(auth.uid())
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR has_role(auth.uid(), 'chofer'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'bodega'::app_role)
      OR (sucursal_origen_id = get_user_sucursal(auth.uid()))
      OR (sucursal_destino_id = get_user_sucursal(auth.uid()))
      OR (sucursal_entrega_id = get_user_sucursal(auth.uid()))
      OR (chofer_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM hoja_ruta_envios hre
        JOIN hojas_ruta hr ON hr.id = hre.hoja_ruta_id
        WHERE hre.envio_id = envios.id
        AND (hr.sucursal_destino_id = get_user_sucursal(auth.uid())
          OR hr.sucursal_origen_id = get_user_sucursal(auth.uid()))
      )
    )
  )
  OR is_super_admin(auth.uid())
);