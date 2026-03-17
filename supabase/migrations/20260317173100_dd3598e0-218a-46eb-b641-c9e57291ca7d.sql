CREATE POLICY "Users can view partner tenants"
ON public.tenants FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tenant_partners tp
    WHERE (tp.tenant_a_id = id OR tp.tenant_b_id = id)
    AND public.current_user_tenant() IN (tp.tenant_a_id, tp.tenant_b_id)
  )
);