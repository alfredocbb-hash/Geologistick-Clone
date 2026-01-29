-- Add DELETE policy for profiles table for super_admin
CREATE POLICY "Super admin can delete profiles"
ON public.profiles
FOR DELETE
USING (is_super_admin(auth.uid()));

-- Add DELETE policy for user_roles table for super_admin
CREATE POLICY "Super admin can delete user roles"
ON public.user_roles
FOR DELETE
USING (is_super_admin(auth.uid()));

-- Note: tarifas already has an ALL policy that includes super_admin
-- But let's add an explicit DELETE policy for clarity
DROP POLICY IF EXISTS "Super admin can delete tarifas" ON public.tarifas;
CREATE POLICY "Super admin can delete tarifas"
ON public.tarifas
FOR DELETE
USING (is_super_admin(auth.uid()));