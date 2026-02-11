DROP POLICY IF EXISTS "Ver sellers de su tenant" ON ecommerce_sellers;

CREATE POLICY "Ver sellers de su tenant" ON ecommerce_sellers
FOR SELECT USING (
  (
    (tenant_id = current_user_tenant()) 
    AND (
      is_admin(auth.uid()) 
      OR has_role(auth.uid(), 'supervisor'::app_role) 
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'chofer'::app_role)
    )
  ) 
  OR (user_id = auth.uid()) 
  OR is_super_admin(auth.uid())
);