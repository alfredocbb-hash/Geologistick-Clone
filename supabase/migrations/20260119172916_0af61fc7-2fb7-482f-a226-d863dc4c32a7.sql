-- =============================================
-- CORREGIR AISLAMIENTO MULTI-TENANT
-- Eliminar políticas que permiten acceso global
-- =============================================

-- 1. Sucursales - Eliminar política global
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver sucursales" ON public.sucursales;

-- 2. Tarifas - Eliminar política global
DROP POLICY IF EXISTS "Usuarios autenticados ven tarifas" ON public.tarifas;

-- 3. Vehículos - Eliminar política global
DROP POLICY IF EXISTS "Usuarios autenticados ven vehiculos" ON public.vehiculos;

-- 4. Facturas - Eliminar política global y crear una correcta
DROP POLICY IF EXISTS "Allow authenticated users to view facturas" ON public.facturas;
CREATE POLICY "Ver facturas de su tenant"
ON public.facturas FOR SELECT
USING (
  tenant_id = current_user_tenant()
  OR is_super_admin(auth.uid())
);

-- 5. Tarifa Conceptos - Eliminar política global y crear una correcta
DROP POLICY IF EXISTS "Usuarios autenticados ven conceptos" ON public.tarifa_conceptos;
CREATE POLICY "Ver conceptos de tarifa de su tenant"
ON public.tarifa_conceptos FOR SELECT
USING (
  tenant_id = current_user_tenant()
  OR is_super_admin(auth.uid())
);

-- 6. Tarifa Concepto Precios - Eliminar política global y crear con join
DROP POLICY IF EXISTS "Usuarios autenticados ven precios" ON public.tarifa_concepto_precios;
CREATE POLICY "Ver precios de tarifa de su tenant"
ON public.tarifa_concepto_precios FOR SELECT
USING (
  concepto_id IN (
    SELECT id FROM public.tarifa_conceptos 
    WHERE tenant_id = current_user_tenant()
  )
  OR is_super_admin(auth.uid())
);

-- 7. Sucursal Zonas - Eliminar política global y crear con join
DROP POLICY IF EXISTS "Usuarios ven zonas" ON public.sucursal_zonas;
CREATE POLICY "Ver zonas de sucursales de su tenant"
ON public.sucursal_zonas FOR SELECT
USING (
  sucursal_id IN (
    SELECT id FROM public.sucursales 
    WHERE tenant_id = current_user_tenant()
  )
  OR is_super_admin(auth.uid())
);

-- 8. Limpiar políticas duplicadas de vehículos
DROP POLICY IF EXISTS "Gestionar vehículos admin" ON public.vehiculos;

-- 9. Limpiar políticas duplicadas de tarifas  
DROP POLICY IF EXISTS "Solo admin puede gestionar tarifas" ON public.tarifas;

-- 10. Limpiar políticas duplicadas de sucursales
DROP POLICY IF EXISTS "Solo admin puede actualizar sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "Solo admin puede eliminar sucursales" ON public.sucursales;
DROP POLICY IF EXISTS "Solo admin puede insertar sucursales" ON public.sucursales;