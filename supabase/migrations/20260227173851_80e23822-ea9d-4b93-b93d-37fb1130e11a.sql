
-- Add explicit SELECT policy for super admins on tenant_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenant_subscriptions' 
    AND policyname = 'Super admins can select all subscriptions'
  ) THEN
    CREATE POLICY "Super admins can select all subscriptions"
    ON public.tenant_subscriptions
    FOR SELECT
    USING (public.current_user_is_super_admin());
  END IF;
END $$;
