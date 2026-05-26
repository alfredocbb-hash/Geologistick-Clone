
-- 1) delivery-photos storage: drop duplicate permissive policies
DROP POLICY IF EXISTS "Choferes pueden subir fotos de entrega" ON storage.objects;
DROP POLICY IF EXISTS "Choferes pueden actualizar sus fotos" ON storage.objects;

-- 2) marketing-assets storage: restrict insert/delete to admin/super_admin
DROP POLICY IF EXISTS "Authenticated users can upload marketing assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete marketing assets" ON storage.objects;

CREATE POLICY "Admins can upload marketing assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketing-assets'
    AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  );

CREATE POLICY "Admins can delete marketing assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'marketing-assets'
    AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  );

CREATE POLICY "Admins can update marketing assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'marketing-assets'
    AND (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  );

-- 3) facturas_compra: add role check (admin or supervisor)
DROP POLICY IF EXISTS "Users can create purchase invoices for their tenant" ON public.facturas_compra;
DROP POLICY IF EXISTS "Users can update their tenant purchase invoices" ON public.facturas_compra;
DROP POLICY IF EXISTS "Users can delete their tenant purchase invoices" ON public.facturas_compra;

CREATE POLICY "Admins/supervisors can create purchase invoices"
  ON public.facturas_compra FOR INSERT TO authenticated
  WITH CHECK (
    public.user_belongs_to_tenant(tenant_id)
    AND (public.current_user_is_admin() OR public.current_user_has_role('supervisor'::app_role))
  );

CREATE POLICY "Admins/supervisors can update purchase invoices"
  ON public.facturas_compra FOR UPDATE TO authenticated
  USING (
    public.user_belongs_to_tenant(tenant_id)
    AND (public.current_user_is_admin() OR public.current_user_has_role('supervisor'::app_role))
  );

CREATE POLICY "Admins/supervisors can delete purchase invoices"
  ON public.facturas_compra FOR DELETE TO authenticated
  USING (
    public.user_belongs_to_tenant(tenant_id)
    AND (public.current_user_is_admin() OR public.current_user_has_role('supervisor'::app_role))
  );

-- 4) gastos: add role check (admin or supervisor)
DROP POLICY IF EXISTS "Users can create gastos in their tenant" ON public.gastos;
DROP POLICY IF EXISTS "Users can update gastos of their tenant" ON public.gastos;
DROP POLICY IF EXISTS "Users can delete gastos of their tenant" ON public.gastos;

CREATE POLICY "Admins/supervisors can create gastos"
  ON public.gastos FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_user_tenant()
    AND (public.current_user_is_admin() OR public.current_user_has_role('supervisor'::app_role))
  );

CREATE POLICY "Admins/supervisors can update gastos"
  ON public.gastos FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_user_tenant()
    AND (public.current_user_is_admin() OR public.current_user_has_role('supervisor'::app_role))
  );

CREATE POLICY "Admins/supervisors can delete gastos"
  ON public.gastos FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_user_tenant()
    AND (public.current_user_is_admin() OR public.current_user_has_role('supervisor'::app_role))
  );

-- 5) trial requests: per-email rate limit (replaces the global 20/hour counter)
CREATE OR REPLACE FUNCTION public.check_trial_request_rate_limit_for_email(_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_for_email integer;
  recent_total integer;
BEGIN
  -- Block more than 5 requests in the last hour from the same email
  SELECT COUNT(*) INTO recent_for_email
  FROM trial_requests
  WHERE created_at > NOW() - INTERVAL '1 hour'
    AND lower(email) = lower(_email);

  IF recent_for_email >= 5 THEN
    RETURN false;
  END IF;

  -- Sanity global cap to prevent total flood (raised from 20 to 200/hour)
  SELECT COUNT(*) INTO recent_total
  FROM trial_requests
  WHERE created_at > NOW() - INTERVAL '1 hour';

  RETURN recent_total < 200;
END;
$$;

DROP POLICY IF EXISTS "Rate limited trial request insert" ON public.trial_requests;

CREATE POLICY "Per-email rate limited trial request insert"
  ON public.trial_requests FOR INSERT
  WITH CHECK (public.check_trial_request_rate_limit_for_email(email));
