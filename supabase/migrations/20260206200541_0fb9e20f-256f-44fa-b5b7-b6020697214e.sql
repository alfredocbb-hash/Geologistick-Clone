
-- 1. Extend payment_status enum with new values
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cobrado_chofer';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'rendido';

-- 2. Create rendiciones table
CREATE TABLE public.rendiciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chofer_id UUID NOT NULL,
  recibido_por UUID NOT NULL,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id),
  monto_total NUMERIC NOT NULL,
  cantidad_cobros INTEGER NOT NULL DEFAULT 0,
  metodo_recepcion public.payment_method NOT NULL DEFAULT 'efectivo',
  referencia TEXT,
  notas TEXT,
  sesion_caja_id UUID REFERENCES public.sesiones_caja(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Add rendicion_id to pagos
ALTER TABLE public.pagos ADD COLUMN rendicion_id UUID REFERENCES public.rendiciones(id);

-- 4. Enable RLS on rendiciones
ALTER TABLE public.rendiciones ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for rendiciones
CREATE POLICY "Admin/operador can manage rendiciones"
  ON public.rendiciones
  FOR ALL
  USING (
    public.is_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'sucursal'::app_role)
  );

CREATE POLICY "Chofer can view own rendiciones"
  ON public.rendiciones
  FOR SELECT
  USING (chofer_id = auth.uid());

-- 6. RPC: register_cod_payment (called by driver on delivery confirmation)
CREATE OR REPLACE FUNCTION public.register_cod_payment(
  p_envio_id UUID,
  p_monto NUMERIC,
  p_metodo public.payment_method DEFAULT 'efectivo'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_envio RECORD;
  v_existing_pago_id UUID;
  v_new_pago_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  -- Get tenant from driver profile
  SELECT tenant_id INTO v_tenant_id
  FROM profiles WHERE user_id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin tenant asignado');
  END IF;

  -- Verify shipment exists
  SELECT id, estado, pago_contra_entrega, tipo_pago
  INTO v_envio
  FROM envios
  WHERE id = p_envio_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Envío no encontrado');
  END IF;

  -- Check no existing payment for this shipment with cobrado_chofer or rendido status
  SELECT id INTO v_existing_pago_id
  FROM pagos
  WHERE envio_id = p_envio_id
    AND estado IN ('cobrado_chofer', 'rendido', 'pagado')
  LIMIT 1;

  IF v_existing_pago_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Pago ya registrado', 'pago_id', v_existing_pago_id);
  END IF;

  -- Insert payment
  INSERT INTO pagos (envio_id, monto, metodo, estado, created_by, tenant_id)
  VALUES (p_envio_id, p_monto, p_metodo, 'cobrado_chofer', v_user_id, v_tenant_id)
  RETURNING id INTO v_new_pago_id;

  RETURN jsonb_build_object('success', true, 'pago_id', v_new_pago_id);
END;
$$;

-- 7. RPC: receive_rendition (called by admin/branch to receive driver's COD money)
CREATE OR REPLACE FUNCTION public.receive_rendition(
  p_chofer_id UUID,
  p_pago_ids UUID[],
  p_metodo_recepcion public.payment_method,
  p_referencia TEXT DEFAULT NULL,
  p_notas TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_sucursal_id UUID;
  v_monto_total NUMERIC;
  v_cantidad INTEGER;
  v_rendicion_id UUID;
  v_sesion_caja_id UUID;
  v_invalid_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  -- Get receiver's profile
  SELECT tenant_id, sucursal_id 
  INTO v_tenant_id, v_sucursal_id
  FROM profiles WHERE user_id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin tenant asignado');
  END IF;

  IF v_sucursal_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin sucursal asignada');
  END IF;

  -- Validate all payments belong to the driver and are in cobrado_chofer status
  SELECT COUNT(*) INTO v_invalid_count
  FROM unnest(p_pago_ids) AS pid
  LEFT JOIN pagos p ON p.id = pid
  WHERE p.id IS NULL 
    OR p.estado != 'cobrado_chofer'
    OR p.created_by != p_chofer_id
    OR p.tenant_id != v_tenant_id;

  IF v_invalid_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Algunos pagos no son válidos o no pertenecen al chofer');
  END IF;

  -- Calculate total
  SELECT COALESCE(SUM(monto), 0), COUNT(*)
  INTO v_monto_total, v_cantidad
  FROM pagos
  WHERE id = ANY(p_pago_ids);

  IF v_cantidad = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se encontraron pagos');
  END IF;

  -- Find open cash session for this branch
  SELECT id INTO v_sesion_caja_id
  FROM sesiones_caja
  WHERE sucursal_id = v_sucursal_id
    AND estado = 'abierta'
  LIMIT 1;

  -- Create rendicion
  INSERT INTO rendiciones (
    chofer_id, recibido_por, sucursal_id, monto_total,
    cantidad_cobros, metodo_recepcion, referencia, notas,
    sesion_caja_id, tenant_id
  ) VALUES (
    p_chofer_id, v_user_id, v_sucursal_id, v_monto_total,
    v_cantidad, p_metodo_recepcion, p_referencia, p_notas,
    v_sesion_caja_id, v_tenant_id
  )
  RETURNING id INTO v_rendicion_id;

  -- Update payments to rendido
  UPDATE pagos
  SET estado = 'rendido',
      rendicion_id = v_rendicion_id,
      updated_at = now()
  WHERE id = ANY(p_pago_ids);

  -- If there's an open cash session, create a cash movement
  IF v_sesion_caja_id IS NOT NULL THEN
    INSERT INTO movimientos_caja (
      sesion_caja_id, tipo, concepto, monto,
      metodo_pago, referencia, created_by
    ) VALUES (
      v_sesion_caja_id, 'ingreso',
      'Rendición COD - ' || v_cantidad || ' cobro(s)',
      v_monto_total, p_metodo_recepcion,
      COALESCE(p_referencia, 'Rendición #' || LEFT(v_rendicion_id::text, 8)),
      v_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'rendicion_id', v_rendicion_id,
    'monto_total', v_monto_total,
    'cantidad_cobros', v_cantidad,
    'caja_impactada', v_sesion_caja_id IS NOT NULL
  );
END;
$$;
