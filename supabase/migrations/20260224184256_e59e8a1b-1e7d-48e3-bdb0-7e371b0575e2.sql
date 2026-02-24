
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
      OR has_role(auth.uid(), 'sucursal')
      OR has_role(auth.uid(), 'despachador')
      OR has_role(auth.uid(), 'atencion_cliente')
      OR (sucursal_origen_id = get_user_sucursal(auth.uid()))
      OR (sucursal_destino_id = get_user_sucursal(auth.uid()))
      OR (chofer_id = auth.uid())
      OR (created_by = auth.uid())
    )
  )
  OR is_super_admin(auth.uid())
);
