-- Actualizar política RLS para envios (SELECT)
-- Agregar roles chofer, operador y bodega para permitir ver todos los envíos del tenant

DROP POLICY IF EXISTS "Ver envíos de su tenant" ON envios;

CREATE POLICY "Ver envíos de su tenant" ON envios
FOR SELECT
USING (
  (
    (tenant_id = current_user_tenant())
    AND (
      is_admin(auth.uid())
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR has_role(auth.uid(), 'chofer'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'bodega'::app_role)
      OR (sucursal_origen_id = get_user_sucursal(auth.uid()))
      OR (sucursal_destino_id = get_user_sucursal(auth.uid()))
      OR (chofer_id = auth.uid())
      OR (created_by = auth.uid())
    )
  )
  OR is_super_admin(auth.uid())
);