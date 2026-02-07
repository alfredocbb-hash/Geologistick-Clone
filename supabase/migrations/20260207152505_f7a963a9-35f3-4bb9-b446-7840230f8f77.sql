-- Allow all authenticated users to read integration configs for their tenant
-- This is needed so drivers can check if Mercado Pago is configured
CREATE POLICY "Users can view their tenant integrations"
  ON public.system_integrations
  FOR SELECT
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));