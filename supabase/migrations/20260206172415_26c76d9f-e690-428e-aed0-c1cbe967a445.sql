
-- 1. Recrear la función start_ruta_planificada con asignación de chofer_id
CREATE OR REPLACE FUNCTION public.start_ruta_planificada(p_ruta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ruta RECORD;
  v_updated_count INTEGER := 0;
BEGIN
  -- Verificar que la ruta existe y pertenece al chofer actual
  SELECT * INTO v_ruta
  FROM public.rutas_planificadas
  WHERE id = p_ruta_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruta no encontrada');
  END IF;
  
  -- Verificar que el chofer es el asignado
  IF v_ruta.chofer_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para iniciar esta ruta');
  END IF;
  
  -- Si ya está en curso o completada, no hacer nada
  IF v_ruta.estado = 'en_curso' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Ruta ya está en curso', 'already_started', true);
  END IF;
  
  IF v_ruta.estado IN ('completada', 'cancelada') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se puede iniciar una ruta ' || v_ruta.estado);
  END IF;
  
  -- Actualizar estado de la ruta
  UPDATE public.rutas_planificadas
  SET estado = 'en_curso',
      updated_at = now()
  WHERE id = p_ruta_id;
  
  -- Actualizar envíos de las paradas de ENTREGA: asignar chofer_id + cambiar estado
  UPDATE public.envios e
  SET estado = 'en_reparto',
      chofer_id = v_ruta.chofer_id,
      chofer_ultima_milla_id = v_ruta.chofer_id,
      fecha_asignacion_ultima_milla = now(),
      updated_at = now()
  FROM public.ruta_paradas rp
  WHERE rp.ruta_id = p_ruta_id
    AND rp.envio_id = e.id
    AND rp.tipo = 'entrega'
    AND e.estado NOT IN ('entregado', 'devuelto', 'cancelado');
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Actualizar envíos de las paradas de RETIRO: asignar chofer_id + cambiar estado_retiro
  UPDATE public.envios e
  SET estado_retiro = 'en_camino',
      chofer_id = v_ruta.chofer_id,
      chofer_ultima_milla_id = v_ruta.chofer_id,
      fecha_asignacion_ultima_milla = now(),
      updated_at = now()
  FROM public.ruta_paradas rp
  WHERE rp.ruta_id = p_ruta_id
    AND rp.envio_id = e.id
    AND rp.tipo = 'retiro'
    AND (e.estado_retiro IS NULL OR e.estado_retiro NOT IN ('retirado', 'fallido'));
  
  -- Actualizar estado de las paradas a 'pendiente' si no están completadas
  UPDATE public.ruta_paradas
  SET estado = 'pendiente'
  WHERE ruta_id = p_ruta_id
    AND (estado IS NULL OR estado NOT IN ('completada', 'fallida'));
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Ruta iniciada correctamente',
    'envios_updated', v_updated_count
  );
END;
$function$;

-- 2. Fix datos existentes: asignar chofer_id a envíos de rutas en curso que tienen chofer_id NULL
UPDATE public.envios e
SET chofer_id = rp2.chofer_id,
    chofer_ultima_milla_id = rp2.chofer_id,
    fecha_asignacion_ultima_milla = now()
FROM public.ruta_paradas rp
JOIN public.rutas_planificadas rp2 ON rp2.id = rp.ruta_id
WHERE rp.envio_id = e.id
  AND e.chofer_id IS NULL
  AND rp2.estado = 'en_curso';
