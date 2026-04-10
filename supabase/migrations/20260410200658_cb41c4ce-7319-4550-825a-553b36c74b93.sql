CREATE POLICY "Public can view landing plans"
ON public.subscription_plans
FOR SELECT
TO anon
USING (is_active = true AND visible_in_landing = true);