
-- 1. Delivery photos: remove public SELECT
DROP POLICY IF EXISTS "Fotos de entrega son públicas" ON storage.objects;

-- 2. ecommerce_sellers: restrict SELECT (remove chofer/operador access to OAuth tokens)
DROP POLICY IF EXISTS "Ver sellers de su tenant" ON public.ecommerce_sellers;
CREATE POLICY "Ver sellers de su tenant"
ON public.ecommerce_sellers
FOR SELECT
TO authenticated
USING (
  (
    tenant_id = current_user_tenant()
    AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
  )
  OR user_id = auth.uid()
  OR is_super_admin(auth.uid())
);

-- 3. Branding bucket: restrict writes to admins, scoped by tenant folder
DROP POLICY IF EXISTS "Authenticated users can upload branding files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update branding files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete branding files" ON storage.objects;

CREATE POLICY "Admins can upload branding files for their tenant"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND current_user_is_admin()
  AND (storage.foldername(name))[1] = current_user_tenant()::text
);

CREATE POLICY "Admins can update branding files for their tenant"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding'
  AND current_user_is_admin()
  AND (storage.foldername(name))[1] = current_user_tenant()::text
);

CREATE POLICY "Admins can delete branding files for their tenant"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding'
  AND current_user_is_admin()
  AND (storage.foldername(name))[1] = current_user_tenant()::text
);

-- 4. system_integrations: drop permissive SELECT that allows any tenant member
DROP POLICY IF EXISTS "Users can view their tenant integrations" ON public.system_integrations;

-- 5. user_roles: enforce same-tenant on INSERT
DROP POLICY IF EXISTS "Solo admin puede asignar roles" ON public.user_roles;
CREATE POLICY "Solo admin puede asignar roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.tenant_id = current_user_tenant()
    )
  )
);

-- Also tighten DELETE/UPDATE on user_roles similarly
DROP POLICY IF EXISTS "Solo admin puede eliminar roles" ON public.user_roles;
CREATE POLICY "Solo admin puede eliminar roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_roles.user_id
        AND p.tenant_id = current_user_tenant()
    )
  )
);

-- 6. colectas: restrict SELECT to driver/admin/supervisor
DROP POLICY IF EXISTS "Drivers can view own colectas" ON public.colectas;
CREATE POLICY "Drivers can view own colectas"
ON public.colectas
FOR SELECT
TO authenticated
USING (
  chofer_id = auth.uid()
  OR (
    tenant_id = current_user_tenant()
    AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
  )
  OR is_super_admin(auth.uid())
);

-- 7. driver_location_history: restrict to admin/supervisor/own driver
DROP POLICY IF EXISTS "Ver historial de ubicaciones de su tenant" ON public.driver_location_history;
CREATE POLICY "Ver historial de ubicaciones de su tenant"
ON public.driver_location_history
FOR SELECT
TO authenticated
USING (
  chofer_id = auth.uid()
  OR (
    tenant_id = current_user_tenant()
    AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
  )
  OR is_super_admin(auth.uid())
);

-- 8. facturas: explicit deny for anon (defense in depth)
DROP POLICY IF EXISTS "deny_anon_facturas" ON public.facturas;
CREATE POLICY "deny_anon_facturas"
ON public.facturas
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
