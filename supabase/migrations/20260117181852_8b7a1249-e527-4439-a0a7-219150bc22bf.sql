-- Corregir política RLS de hojas_ruta para que choferes vean sus hojas asignadas
DROP POLICY IF EXISTS "Ver hojas de ruta" ON hojas_ruta;

CREATE POLICY "Ver hojas de ruta" ON hojas_ruta
FOR SELECT
USING (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'supervisor') OR 
  has_role(auth.uid(), 'operador') OR 
  has_role(auth.uid(), 'despachador') OR 
  (chofer_id = auth.uid()) OR
  (sucursal_origen_id = get_user_sucursal(auth.uid())) OR 
  (sucursal_destino_id = get_user_sucursal(auth.uid()))
);

-- Corregir tenant_id NULL en la ruta pendiente
UPDATE rutas_planificadas 
SET tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = chofer_id LIMIT 1)
WHERE tenant_id IS NULL AND chofer_id IS NOT NULL;