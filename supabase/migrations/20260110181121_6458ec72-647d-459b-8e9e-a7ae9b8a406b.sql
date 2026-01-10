-- ============================================
-- FASE 1: Denegar acceso anónimo a datos sensibles
-- ============================================

-- Profiles (empleados)
CREATE POLICY "deny_anon_profiles" ON public.profiles 
  FOR SELECT TO anon USING (false);

-- Clientes
CREATE POLICY "deny_anon_clientes" ON public.clientes 
  FOR SELECT TO anon USING (false);

-- Envíos
CREATE POLICY "deny_anon_envios" ON public.envios 
  FOR SELECT TO anon USING (false);

-- Driver Locations (GPS)
CREATE POLICY "deny_anon_driver_locations" ON public.driver_locations 
  FOR SELECT TO anon USING (false);

-- Pagos
CREATE POLICY "deny_anon_pagos" ON public.pagos 
  FOR SELECT TO anon USING (false);

-- Cliente Cuenta Corriente
CREATE POLICY "deny_anon_cliente_cuenta_corriente" ON public.cliente_cuenta_corriente 
  FOR SELECT TO anon USING (false);

-- Liquidaciones
CREATE POLICY "deny_anon_liquidaciones" ON public.liquidaciones 
  FOR SELECT TO anon USING (false);

-- Comisiones
CREATE POLICY "deny_anon_comisiones" ON public.comisiones 
  FOR SELECT TO anon USING (false);

-- Movimientos Caja
CREATE POLICY "deny_anon_movimientos_caja" ON public.movimientos_caja 
  FOR SELECT TO anon USING (false);

-- Sesiones Caja
CREATE POLICY "deny_anon_sesiones_caja" ON public.sesiones_caja 
  FOR SELECT TO anon USING (false);

-- Incidentes
CREATE POLICY "deny_anon_incidentes" ON public.incidentes 
  FOR SELECT TO anon USING (false);

-- ============================================
-- FASE 2: Restringir datos de negocio a autenticados
-- ============================================

-- Tarifas: Eliminar política pública y crear nueva
DROP POLICY IF EXISTS "Todos pueden ver tarifas activas" ON public.tarifas;
CREATE POLICY "Usuarios autenticados ven tarifas" ON public.tarifas 
  FOR SELECT TO authenticated USING (true);

-- Tarifa Conceptos
DROP POLICY IF EXISTS "Todos pueden ver conceptos activos" ON public.tarifa_conceptos;
CREATE POLICY "Usuarios autenticados ven conceptos" ON public.tarifa_conceptos 
  FOR SELECT TO authenticated USING (true);

-- Tarifa Concepto Precios
DROP POLICY IF EXISTS "Todos pueden ver precios de conceptos" ON public.tarifa_concepto_precios;
CREATE POLICY "Usuarios autenticados ven precios" ON public.tarifa_concepto_precios 
  FOR SELECT TO authenticated USING (true);

-- Vehículos
DROP POLICY IF EXISTS "Ver vehículos" ON public.vehiculos;
CREATE POLICY "Usuarios autenticados ven vehiculos" ON public.vehiculos 
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- FASE 3: Corregir políticas INSERT permisivas
-- ============================================

-- Clientes: Restringir creación a roles autorizados
DROP POLICY IF EXISTS "Crear clientes" ON public.clientes;
CREATE POLICY "Crear clientes" ON public.clientes 
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'atencion_cliente')
    OR public.has_role(auth.uid(), 'sucursal')
    OR sucursal_id = public.get_user_sucursal(auth.uid())
  );

-- Envíos: Restringir creación a roles autorizados
DROP POLICY IF EXISTS "Crear envíos" ON public.envios;
CREATE POLICY "Crear envíos" ON public.envios 
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'despachador')
    OR public.has_role(auth.uid(), 'atencion_cliente')
    OR public.has_role(auth.uid(), 'sucursal')
    OR sucursal_origen_id = public.get_user_sucursal(auth.uid())
  );

-- Envío Historial: Verificar acceso al envío relacionado
DROP POLICY IF EXISTS "Insertar historial" ON public.envio_historial;
CREATE POLICY "Insertar historial" ON public.envio_historial 
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'chofer')
    OR public.has_role(auth.uid(), 'despachador')
    OR public.has_role(auth.uid(), 'bodega')
    OR EXISTS (
      SELECT 1 FROM public.envios e 
      WHERE e.id = envio_id 
      AND (e.chofer_id = auth.uid() OR e.sucursal_origen_id = public.get_user_sucursal(auth.uid()))
    )
  );

-- Movimientos Caja: Verificar rol y sucursal
DROP POLICY IF EXISTS "Crear movimientos de caja" ON public.movimientos_caja;
CREATE POLICY "Crear movimientos de caja" ON public.movimientos_caja 
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'sucursal')
    OR EXISTS (
      SELECT 1 FROM public.sesiones_caja sc 
      WHERE sc.id = sesion_caja_id 
      AND sc.sucursal_id = public.get_user_sucursal(auth.uid())
    )
  );

-- ============================================
-- FASE 4: Hacer privado el bucket de storage
-- ============================================

-- Hacer el bucket privado
UPDATE storage.buckets SET public = false WHERE id = 'delivery-photos';

-- Política para ver fotos de entregas (usuarios autenticados con acceso)
CREATE POLICY "Usuarios autenticados ven fotos de entregas"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-photos' 
  AND (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'chofer')
    OR public.has_role(auth.uid(), 'bodega')
  )
);

-- Política para subir fotos (choferes y roles autorizados)
CREATE POLICY "Usuarios autorizados suben fotos de entregas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'delivery-photos' 
  AND (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'chofer')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'bodega')
  )
);

-- Política para actualizar fotos
CREATE POLICY "Usuarios autorizados actualizan fotos de entregas"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'delivery-photos' 
  AND (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'chofer')
    OR public.has_role(auth.uid(), 'operador')
  )
);