-- Actualizar política RLS de profiles para permitir que super_admin modifique tenant_id
DROP POLICY IF EXISTS "Usuario puede actualizar su perfil" ON profiles;

CREATE POLICY "Usuario puede actualizar su perfil" ON profiles
FOR UPDATE
USING (
  (user_id = auth.uid()) 
  OR is_admin(auth.uid()) 
  OR is_super_admin(auth.uid())
);