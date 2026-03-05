
CREATE OR REPLACE FUNCTION public.reopen_ruta_planificada(p_ruta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ruta RECORD;
  v_reactivated_count INTEGER := 0;
  v_envio RECORD;
BEGIN
  -- Only admins can reopen routes
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo administradores pueden reabrir rutas');
  END IF;

  -- Verify the route exists
  SELECT * INTO v_ruta
  FROM public.rutas_planificadas
  WHERE id = p_ruta_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruta no encontrada');
  END IF;

  -- Verify the route is completed
  IF v_ruta.estado != 'completada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden reabrir rutas completadas');
  END IF;

  -- Update route status back to en_curso
  UPDATE public.rutas_planificadas
  SET estado = 'en_curso',
      updated_at = now()
  WHERE id = p_ruta_id;

  -- Re-activate pending shipments (not delivered/returned/cancelled)
  FOR v_envio IN
    SELECT rp.envio_id, e.estado as estado_actual
    FROM public.ruta_paradas rp
    JOIN public.envios e ON e.id = rp.envio_id
    WHERE rp.ruta_id = p_ruta_id
      AND rp.tipo = 'entrega'
      AND e.estado NOT IN ('entregado', 'devuelto', 'cancelado')
  LOOP
    -- Update shipment to en_reparto and reassign driver
    UPDATE public.envios
    SET estado = 'en_reparto',
        chofer_id = v_ruta.chofer_id,
        updated_at = now()
    WHERE id = v_envio.envio_id;

    -- Log history entry
    INSERT INTO public.envio_historial (envio_id, estado_anterior, estado_nuevo, notas, created_by)
    VALUES (
      v_envio.envio_id,
      v_envio.estado_actual,
      'en_reparto',
      'Ruta ' || v_ruta.numero || ' reabierta por administrador',
      auth.uid()
    );

    -- Reset parada status
    UPDATE public.ruta_paradas
    SET estado = 'pendiente'
    WHERE ruta_id = p_ruta_id
      AND envio_id = v_envio.envio_id
      AND estado NOT IN ('completada', 'fallida');

    v_reactivated_count := v_reactivated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Ruta reabierta correctamente',
    'envios_reactivados', v_reactivated_count
  );
END;
$function$;
