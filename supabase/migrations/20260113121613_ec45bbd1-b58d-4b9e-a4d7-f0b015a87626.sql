
-- 1) Policy para que usuarios autenticados puedan leer sus propios permisos de rol
CREATE POLICY "Users can read their own role permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (
  enabled = true 
  AND public.has_role(auth.uid(), role)
);

-- 2) Función para iniciar ruta planificada (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.start_ruta_planificada(p_ruta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Actualizar envíos de las paradas SOLO si no están completados
  -- Para entregas: si estado NO está en (entregado, devuelto, cancelado) → en_reparto
  UPDATE public.envios e
  SET estado = 'en_reparto',
      updated_at = now()
  FROM public.ruta_paradas rp
  WHERE rp.ruta_id = p_ruta_id
    AND rp.envio_id = e.id
    AND rp.tipo = 'entrega'
    AND e.estado NOT IN ('entregado', 'devuelto', 'cancelado');
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Para retiros: si estado_retiro NO está en (retirado, fallido) → en_camino
  UPDATE public.envios e
  SET estado_retiro = 'en_camino',
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
$$;

-- 3) Función para iniciar hoja de ruta (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.start_hoja_ruta(p_hoja_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoja RECORD;
  v_updated_count INTEGER := 0;
BEGIN
  -- Verificar que la hoja existe
  SELECT * INTO v_hoja
  FROM public.hojas_ruta
  WHERE id = p_hoja_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hoja de ruta no encontrada');
  END IF;
  
  -- Verificar que el chofer es el asignado
  IF v_hoja.chofer_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para iniciar esta hoja de ruta');
  END IF;
  
  -- Si ya está en tránsito, no hacer nada
  IF v_hoja.estado = 'en_transito' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Hoja ya está en tránsito', 'already_started', true);
  END IF;
  
  IF v_hoja.estado IN ('completada', 'cancelada', 'recibida') THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se puede iniciar una hoja ' || v_hoja.estado);
  END IF;
  
  -- Actualizar estado de la hoja
  UPDATE public.hojas_ruta
  SET estado = 'en_transito',
      inicio_real = now(),
      fecha_salida = COALESCE(fecha_salida, now()),
      updated_at = now()
  WHERE id = p_hoja_id;
  
  -- Actualizar envíos SOLO si no están completados
  UPDATE public.envios e
  SET estado = 'en_transito',
      updated_at = now()
  FROM public.hoja_ruta_envios hre
  WHERE hre.hoja_ruta_id = p_hoja_id
    AND hre.envio_id = e.id
    AND e.estado NOT IN ('entregado', 'devuelto', 'cancelado');
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Actualizar estado de los envíos en la hoja a 'pendiente' si no están completados
  UPDATE public.hoja_ruta_envios
  SET estado = 'pendiente'
  WHERE hoja_ruta_id = p_hoja_id
    AND (estado IS NULL OR estado NOT IN ('entregado', 'recibido', 'fallido'));
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Hoja de ruta iniciada correctamente',
    'envios_updated', v_updated_count
  );
END;
$$;

-- 4) Dar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.start_ruta_planificada(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_hoja_ruta(uuid) TO authenticated;
