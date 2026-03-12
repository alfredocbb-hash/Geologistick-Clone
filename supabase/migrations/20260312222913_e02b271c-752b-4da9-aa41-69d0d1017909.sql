
DROP POLICY IF EXISTS "Actualizar envíos de su tenant" ON public.envios;

CREATE POLICY "Actualizar envíos de su tenant" ON public.envios
FOR UPDATE TO public
USING (
  (
    (tenant_id = current_user_tenant()) AND (
      is_admin(auth.uid())
      OR (chofer_id = auth.uid())
      OR (current_user_has_role('sucursal'::app_role) AND (
        sucursal_origen_id = current_user_sucursal()
        OR sucursal_destino_id = current_user_sucursal()
        OR sucursal_entrega_id = current_user_sucursal()
      ))
      OR (current_user_has_role('operador'::app_role) AND (
        sucursal_origen_id = current_user_sucursal()
        OR sucursal_destino_id = current_user_sucursal()
        OR sucursal_entrega_id = current_user_sucursal()
      ))
      OR (current_user_has_role('despachador'::app_role) AND (
        sucursal_origen_id = current_user_sucursal()
        OR sucursal_destino_id = current_user_sucursal()
        OR sucursal_entrega_id = current_user_sucursal()
      ))
      OR EXISTS (
        SELECT 1 FROM hoja_ruta_envios hre
        JOIN hojas_ruta hr ON hr.id = hre.hoja_ruta_id
        WHERE hre.envio_id = envios.id
        AND (hr.sucursal_destino_id = current_user_sucursal()
          OR hr.sucursal_origen_id = current_user_sucursal())
      )
    )
  )
  OR is_super_admin(auth.uid())
);
