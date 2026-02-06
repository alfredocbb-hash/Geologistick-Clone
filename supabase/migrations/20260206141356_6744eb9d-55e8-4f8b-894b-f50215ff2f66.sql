
-- Drop the restrictive ALL policy that blocks chofer from creating routes
DROP POLICY IF EXISTS "Gestionar rutas planificadas" ON rutas_planificadas;

-- New policy: admin/supervisor/operador can do everything
CREATE POLICY "Admin gestionar rutas" ON rutas_planificadas
  FOR ALL TO public
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'operador'))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'operador'));

-- New policy: chofer can create and manage THEIR OWN routes
CREATE POLICY "Chofer gestionar sus rutas" ON rutas_planificadas
  FOR ALL TO public
  USING (chofer_id = auth.uid() AND has_role(auth.uid(), 'chofer'))
  WITH CHECK (chofer_id = auth.uid() AND has_role(auth.uid(), 'chofer'));
