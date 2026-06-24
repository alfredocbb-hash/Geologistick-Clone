CREATE OR REPLACE FUNCTION public.reconcile_seller_liquidacion_payments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_liq RECORD;
  v_saldo_anterior numeric;
  v_saldo_nuevo numeric;
  v_monto numeric;
  v_created int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden reconciliar';
  END IF;

  FOR v_liq IN
    SELECT l.id, l.seller_id, l.saldo_periodo, l.metodo_pago, l.referencia_pago,
           l.fecha_pago, l.periodo_inicio, l.generado_por, l.created_at
    FROM public.liquidaciones_seller l
    WHERE l.estado = 'pagada'
      AND NOT EXISTS (
        SELECT 1 FROM public.seller_cuenta_corriente m
        WHERE m.liquidacion_id = l.id AND m.tipo = 'pago'
      )
    ORDER BY l.fecha_pago NULLS LAST, l.created_at
  LOOP
    v_monto := ABS(COALESCE(v_liq.saldo_periodo, 0));
    IF v_monto = 0 THEN CONTINUE; END IF;

    SELECT COALESCE(saldo_cuenta_corriente, 0) INTO v_saldo_anterior
    FROM public.ecommerce_sellers WHERE id = v_liq.seller_id;

    v_saldo_nuevo := v_saldo_anterior - v_monto;

    INSERT INTO public.seller_cuenta_corriente (
      seller_id, tipo, monto, saldo_anterior, saldo_nuevo,
      descripcion, referencia, metodo_pago, liquidacion_id, created_by
    ) VALUES (
      v_liq.seller_id, 'pago', -v_monto, v_saldo_anterior, v_saldo_nuevo,
      'Reconciliación: pago liquidación ' || COALESCE(to_char(v_liq.periodo_inicio, 'MM/YYYY'), ''),
      v_liq.referencia_pago, v_liq.metodo_pago, v_liq.id, v_liq.generado_por
    );

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'movimientos_creados', v_created);
END;
$$;

SELECT public.reconcile_seller_liquidacion_payments();