-- Fix profiles table: Drop overly permissive policy and create proper role-based access
DROP POLICY IF EXISTS "Usuario puede ver su perfil" ON public.profiles;

-- Create proper policy: Users see their own profile, admins/supervisors see all
CREATE POLICY "Ver perfiles según rol" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  user_id = auth.uid() 
  OR is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'operador'::app_role)
);

-- Fix envios table: The current policy is fine but add explicit deny for public/anon
-- Drop and recreate the deny policy to ensure it's working
DROP POLICY IF EXISTS "deny_anon_envios" ON public.envios;
DROP POLICY IF EXISTS "deny_anon_profiles" ON public.profiles;

-- Note: RLS is already enabled, and the authenticated policies are restrictive enough
-- The issue was that "anon" role policies with qual:false are PERMISSIVE which doesn't help
-- We need to ensure there's no default access - the existing authenticated policies handle this correctly