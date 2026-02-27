
-- Update RLS SELECT policy on tarifa_conceptos to include global concepts (tenant_id IS NULL)
DROP POLICY IF EXISTS "Users can view own tenant conceptos" ON tarifa_conceptos;
CREATE POLICY "Users can view own tenant conceptos" ON tarifa_conceptos
  FOR SELECT TO authenticated
  USING (
    (tenant_id = current_user_tenant()) 
    OR tenant_id IS NULL 
    OR is_super_admin(auth.uid())
  );
