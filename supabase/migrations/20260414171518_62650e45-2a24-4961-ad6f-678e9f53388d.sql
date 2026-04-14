-- Drop the existing admin-only policy
DROP POLICY IF EXISTS "Tenant admins can view subscription" ON public.tenant_subscriptions;

-- Create a new policy that allows ALL authenticated users to view their own tenant's subscription
CREATE POLICY "All users can view own tenant subscription"
ON public.tenant_subscriptions
FOR SELECT
TO authenticated
USING (tenant_id = public.current_user_tenant());