
-- ============================================================
-- 1) tenant_features (feature flags por tenant)
-- ============================================================
CREATE TABLE public.tenant_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  enabled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_key)
);

GRANT SELECT ON public.tenant_features TO authenticated;
GRANT ALL ON public.tenant_features TO service_role;

ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_features_select_own_tenant"
  ON public.tenant_features FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_super_admin()
    OR tenant_id = public.current_user_tenant()
  );

CREATE POLICY "tenant_features_super_admin_all"
  ON public.tenant_features FOR ALL
  TO authenticated
  USING (public.current_user_is_super_admin())
  WITH CHECK (public.current_user_is_super_admin());

CREATE TRIGGER trg_tenant_features_updated_at
  BEFORE UPDATE ON public.tenant_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: check if a tenant has a feature enabled
CREATE OR REPLACE FUNCTION public.tenant_has_feature(_tenant_id UUID, _feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_features
    WHERE tenant_id = _tenant_id
      AND feature_key = _feature_key
      AND enabled = true
  );
$$;

-- ============================================================
-- 2) liquidaciones_manuales
-- ============================================================
CREATE TABLE public.liquidaciones_manuales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'terciarizado' CHECK (tipo IN ('terciarizado','proveedor','partner','otro')),
  empresa_id UUID REFERENCES public.empresas_terciarizadas(id) ON DELETE SET NULL,
  descripcion TEXT,
  periodo_desde DATE NOT NULL,
  periodo_hasta DATE NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'ARS',
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada','cobrada','anulada')),
  factura_id UUID REFERENCES public.facturas(id) ON DELETE SET NULL,
  fecha_movimiento TIMESTAMPTZ,
  metodo_pago payment_method,
  referencia_pago TEXT,
  sesion_caja_id UUID REFERENCES public.sesiones_caja(id) ON DELETE SET NULL,
  movimiento_caja_id UUID REFERENCES public.movimientos_caja(id) ON DELETE SET NULL,
  notas TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT liq_manual_monto_no_cero CHECK (monto <> 0),
  CONSTRAINT liq_manual_periodo_valido CHECK (periodo_hasta >= periodo_desde)
);

CREATE INDEX idx_liq_manuales_tenant ON public.liquidaciones_manuales(tenant_id);
CREATE INDEX idx_liq_manuales_estado ON public.liquidaciones_manuales(estado);
CREATE INDEX idx_liq_manuales_empresa ON public.liquidaciones_manuales(empresa_id);
CREATE INDEX idx_liq_manuales_factura ON public.liquidaciones_manuales(factura_id);
CREATE INDEX idx_liq_manuales_periodo ON public.liquidaciones_manuales(periodo_desde, periodo_hasta);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.liquidaciones_manuales TO authenticated;
GRANT ALL ON public.liquidaciones_manuales TO service_role;

ALTER TABLE public.liquidaciones_manuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "liq_manuales_select_tenant"
  ON public.liquidaciones_manuales FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_super_admin()
    OR tenant_id = public.current_user_tenant()
  );

CREATE POLICY "liq_manuales_insert_admin"
  ON public.liquidaciones_manuales FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.current_user_is_super_admin() OR (
      public.current_user_is_admin()
      AND tenant_id = public.current_user_tenant()
      AND public.tenant_has_feature(tenant_id, 'finanzas')
    ))
  );

CREATE POLICY "liq_manuales_update_admin"
  ON public.liquidaciones_manuales FOR UPDATE
  TO authenticated
  USING (
    public.current_user_is_super_admin()
    OR (public.current_user_is_admin() AND tenant_id = public.current_user_tenant())
  )
  WITH CHECK (
    public.current_user_is_super_admin()
    OR (public.current_user_is_admin() AND tenant_id = public.current_user_tenant())
  );

CREATE POLICY "liq_manuales_delete_admin"
  ON public.liquidaciones_manuales FOR DELETE
  TO authenticated
  USING (
    public.current_user_is_super_admin()
    OR (public.current_user_is_admin() AND tenant_id = public.current_user_tenant())
  );

-- Trigger para setear tenant_id automáticamente
CREATE OR REPLACE FUNCTION public.set_liq_manual_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    NEW.tenant_id := public.current_user_tenant();
  END IF;
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id es requerido';
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_liq_manuales_set_tenant
  BEFORE INSERT ON public.liquidaciones_manuales
  FOR EACH ROW EXECUTE FUNCTION public.set_liq_manual_tenant_id();

CREATE TRIGGER trg_liq_manuales_updated_at
  BEFORE UPDATE ON public.liquidaciones_manuales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) RPC: registrar_movimiento_liquidacion_manual
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_movimiento_liquidacion_manual(
  p_id UUID,
  p_metodo payment_method,
  p_referencia TEXT DEFAULT NULL,
  p_fecha TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_sucursal_id UUID;
  v_liq RECORD;
  v_sesion_id UUID;
  v_mov_id UUID;
  v_tipo TEXT;
  v_estado_nuevo TEXT;
  v_monto_abs NUMERIC;
  v_concepto TEXT;
  v_empresa_nombre TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  SELECT tenant_id, sucursal_id
  INTO v_tenant_id, v_sucursal_id
  FROM profiles WHERE user_id = v_user_id;

  IF NOT (public.current_user_is_admin() OR public.current_user_is_super_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin permisos');
  END IF;

  SELECT * INTO v_liq FROM liquidaciones_manuales WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Liquidación no encontrada');
  END IF;

  IF NOT public.current_user_is_super_admin() AND v_liq.tenant_id <> v_tenant_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Liquidación de otro tenant');
  END IF;

  IF v_liq.estado <> 'pendiente' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La liquidación no está pendiente');
  END IF;

  IF v_sucursal_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin sucursal asignada al usuario');
  END IF;

  SELECT id INTO v_sesion_id
  FROM sesiones_caja
  WHERE sucursal_id = v_sucursal_id AND estado = 'abierta'
  ORDER BY fecha_apertura DESC
  LIMIT 1;

  IF v_sesion_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No hay sesión de caja abierta en tu sucursal');
  END IF;

  v_monto_abs := ABS(v_liq.monto);

  IF v_liq.monto > 0 THEN
    v_tipo := 'egreso';
    v_estado_nuevo := 'pagada';
  ELSE
    v_tipo := 'ingreso';
    v_estado_nuevo := 'cobrada';
  END IF;

  IF v_liq.empresa_id IS NOT NULL THEN
    SELECT nombre INTO v_empresa_nombre FROM empresas_terciarizadas WHERE id = v_liq.empresa_id;
  END IF;

  v_concepto := 'Liq. manual #' || v_liq.numero
    || COALESCE(' — ' || v_empresa_nombre, '')
    || COALESCE(' — ' || v_liq.descripcion, '');

  INSERT INTO movimientos_caja (
    sesion_caja_id, tipo, monto, metodo_pago, concepto, referencia, created_by, categoria
  ) VALUES (
    v_sesion_id, v_tipo, v_monto_abs, p_metodo, v_concepto, p_referencia, v_user_id, 'liquidacion_manual'
  )
  RETURNING id INTO v_mov_id;

  UPDATE liquidaciones_manuales
  SET estado = v_estado_nuevo,
      fecha_movimiento = COALESCE(p_fecha, now()),
      metodo_pago = p_metodo,
      referencia_pago = p_referencia,
      sesion_caja_id = v_sesion_id,
      movimiento_caja_id = v_mov_id,
      updated_at = now()
  WHERE id = p_id;

  RETURN jsonb_build_object(
    'success', true,
    'liquidacion_id', p_id,
    'estado', v_estado_nuevo,
    'movimiento_caja_id', v_mov_id,
    'sesion_caja_id', v_sesion_id
  );
END;
$$;
