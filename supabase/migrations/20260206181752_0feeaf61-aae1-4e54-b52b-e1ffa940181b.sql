
-- 1. Crear función RPC para crear hoja de ruta desde Modo Flex
CREATE OR REPLACE FUNCTION public.create_hoja_ruta_flex(
  p_sucursal_destino_id UUID,
  p_envio_ids UUID[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_sucursal_origen_id UUID;
  v_hoja_numero TEXT;
  v_hoja_id UUID;
  v_envio_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;
  
  -- Obtener tenant y sucursal del chofer
  SELECT tenant_id, sucursal_id 
  INTO v_tenant_id, v_sucursal_origen_id
  FROM profiles 
  WHERE user_id = v_user_id;
  
  IF v_sucursal_origen_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes una sucursal asignada');
  END IF;
  
  IF v_sucursal_origen_id = p_sucursal_destino_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'La sucursal destino debe ser diferente a la de origen');
  END IF;
  
  -- Validar que hay envíos
  v_envio_count := array_length(p_envio_ids, 1);
  IF v_envio_count IS NULL OR v_envio_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No hay envíos para la hoja de ruta');
  END IF;
  
  -- Generar número de hoja de ruta
  v_hoja_numero := generate_hoja_ruta_number();
  
  -- Crear la hoja de ruta (ya iniciada en_transito)
  INSERT INTO hojas_ruta (
    numero,
    sucursal_origen_id,
    sucursal_destino_id,
    chofer_id,
    estado,
    inicio_real,
    fecha_salida,
    cantidad_envios,
    tenant_id,
    created_by
  ) VALUES (
    v_hoja_numero,
    v_sucursal_origen_id,
    p_sucursal_destino_id,
    v_user_id,
    'en_transito',
    now(),
    now(),
    v_envio_count,
    v_tenant_id,
    v_user_id
  )
  RETURNING id INTO v_hoja_id;
  
  -- Crear registros en hoja_ruta_envios
  INSERT INTO hoja_ruta_envios (hoja_ruta_id, envio_id, orden, estado)
  SELECT v_hoja_id, unnest_id, row_number() OVER (), 'pendiente'
  FROM unnest(p_envio_ids) AS unnest_id;
  
  -- Actualizar envíos: estado en_transito + asignar chofer
  UPDATE envios
  SET estado = 'en_transito',
      chofer_id = v_user_id,
      chofer_ultima_milla_id = v_user_id,
      fecha_asignacion_ultima_milla = now(),
      updated_at = now()
  WHERE id = ANY(p_envio_ids)
    AND estado NOT IN ('entregado', 'devuelto', 'cancelado');
  
  RETURN jsonb_build_object(
    'success', true, 
    'hoja_id', v_hoja_id, 
    'numero', v_hoja_numero,
    'envios_count', v_envio_count
  );
END;
$$;

-- 2. Corregir start_hoja_ruta para asignar chofer_id a envíos
CREATE OR REPLACE FUNCTION public.start_hoja_ruta(p_hoja_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  
  -- Actualizar envíos: estado + asignar chofer_id
  UPDATE public.envios e
  SET estado = 'en_transito',
      chofer_id = v_hoja.chofer_id,
      chofer_ultima_milla_id = v_hoja.chofer_id,
      fecha_asignacion_ultima_milla = now(),
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
