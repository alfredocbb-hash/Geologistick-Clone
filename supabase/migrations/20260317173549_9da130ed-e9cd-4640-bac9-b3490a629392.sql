DROP POLICY IF EXISTS "Users can view partner tenants" ON public.tenants;

CREATE POLICY "Users can view partner tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_partners tp
    WHERE
      (
        tp.tenant_a_id = tenants.id
        OR tp.tenant_b_id = tenants.id
      )
      AND public.current_user_tenant() IN (tp.tenant_a_id, tp.tenant_b_id)
  )
);