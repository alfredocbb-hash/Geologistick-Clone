
-- system_integrations: tenant-scoped INSERT
DROP POLICY IF EXISTS "Admins can insert their tenant integrations" ON public.system_integrations;
CREATE POLICY "Admins can insert their tenant integrations"
ON public.system_integrations FOR INSERT TO authenticated
WITH CHECK (
  current_user_is_super_admin()
  OR (current_user_is_admin() AND tenant_id = current_user_tenant())
);

-- sucursal_comisiones: tenant scope via sucursales
DROP POLICY IF EXISTS "Solo admin puede gestionar comisiones" ON public.sucursal_comisiones;
CREATE POLICY "Solo admin puede gestionar comisiones"
ON public.sucursal_comisiones FOR ALL TO authenticated
USING (
  current_user_is_super_admin()
  OR (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.sucursales s
    WHERE s.id = sucursal_comisiones.sucursal_id
      AND s.tenant_id = current_user_tenant()
  ))
)
WITH CHECK (
  current_user_is_super_admin()
  OR (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.sucursales s
    WHERE s.id = sucursal_comisiones.sucursal_id
      AND s.tenant_id = current_user_tenant()
  ))
);

-- tarifa_conceptos: tenant scope (allow NULL/global rows to super_admin only for writes)
DROP POLICY IF EXISTS "Solo admin puede gestionar conceptos" ON public.tarifa_conceptos;
CREATE POLICY "Solo admin puede gestionar conceptos"
ON public.tarifa_conceptos FOR ALL TO authenticated
USING (
  current_user_is_super_admin()
  OR (is_admin(auth.uid()) AND tenant_id = current_user_tenant())
)
WITH CHECK (
  current_user_is_super_admin()
  OR (is_admin(auth.uid()) AND tenant_id = current_user_tenant())
);

-- tarifa_concepto_precios: tenant scope via tarifa_conceptos
DROP POLICY IF EXISTS "Solo admin puede gestionar precios" ON public.tarifa_concepto_precios;
CREATE POLICY "Solo admin puede gestionar precios"
ON public.tarifa_concepto_precios FOR ALL TO authenticated
USING (
  current_user_is_super_admin()
  OR (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.tarifa_conceptos tc
    WHERE tc.id = tarifa_concepto_precios.concepto_id
      AND tc.tenant_id = current_user_tenant()
  ))
)
WITH CHECK (
  current_user_is_super_admin()
  OR (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.tarifa_conceptos tc
    WHERE tc.id = tarifa_concepto_precios.concepto_id
      AND tc.tenant_id = current_user_tenant()
  ))
);

-- terciarizado_cuenta_corriente: tenant scope via empresas_terciarizadas
DROP POLICY IF EXISTS "Gestionar cuenta corriente terciarizados" ON public.terciarizado_cuenta_corriente;
CREATE POLICY "Gestionar cuenta corriente terciarizados"
ON public.terciarizado_cuenta_corriente FOR INSERT TO authenticated
WITH CHECK (
  current_user_is_super_admin()
  OR (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.empresas_terciarizadas e
      WHERE e.id = terciarizado_cuenta_corriente.empresa_id
        AND e.tenant_id = current_user_tenant()
    )
  )
);

-- delivery-photos storage: enforce tenant ownership via envio_id (2nd path segment)
DROP POLICY IF EXISTS "Usuarios autenticados ven fotos de entregas" ON storage.objects;
CREATE POLICY "Usuarios autenticados ven fotos de entregas"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-photos'
  AND (
    current_user_is_super_admin()
    OR (
      (is_admin(auth.uid()) OR has_role(auth.uid(),'supervisor'::app_role)
       OR has_role(auth.uid(),'operador'::app_role) OR has_role(auth.uid(),'chofer'::app_role)
       OR has_role(auth.uid(),'bodega'::app_role))
      AND EXISTS (
        SELECT 1 FROM public.envios e
        WHERE e.id::text = (storage.foldername(name))[2]
          AND e.tenant_id = current_user_tenant()
      )
    )
  )
);

DROP POLICY IF EXISTS "Usuarios autorizados suben fotos de entregas" ON storage.objects;
CREATE POLICY "Usuarios autorizados suben fotos de entregas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'delivery-photos'
  AND (
    current_user_is_super_admin()
    OR (
      (is_admin(auth.uid()) OR has_role(auth.uid(),'chofer'::app_role)
       OR has_role(auth.uid(),'operador'::app_role) OR has_role(auth.uid(),'bodega'::app_role))
      AND EXISTS (
        SELECT 1 FROM public.envios e
        WHERE e.id::text = (storage.foldername(name))[2]
          AND e.tenant_id = current_user_tenant()
      )
    )
  )
);

DROP POLICY IF EXISTS "Usuarios autorizados actualizan fotos de entregas" ON storage.objects;
CREATE POLICY "Usuarios autorizados actualizan fotos de entregas"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'delivery-photos'
  AND (
    current_user_is_super_admin()
    OR (
      (is_admin(auth.uid()) OR has_role(auth.uid(),'chofer'::app_role)
       OR has_role(auth.uid(),'operador'::app_role))
      AND EXISTS (
        SELECT 1 FROM public.envios e
        WHERE e.id::text = (storage.foldername(name))[2]
          AND e.tenant_id = current_user_tenant()
      )
    )
  )
);
