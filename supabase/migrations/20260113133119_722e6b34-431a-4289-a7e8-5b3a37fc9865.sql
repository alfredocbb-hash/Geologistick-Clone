-- Function to close a ruta planificada
CREATE OR REPLACE FUNCTION public.close_ruta_planificada(p_ruta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ruta RECORD;
BEGIN
  -- Verify the route exists
  SELECT * INTO v_ruta
  FROM public.rutas_planificadas
  WHERE id = p_ruta_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruta no encontrada');
  END IF;
  
  -- Verify the driver is the assigned one
  IF v_ruta.chofer_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para cerrar esta ruta');
  END IF;
  
  -- Verify the route is in progress
  IF v_ruta.estado != 'en_curso' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden cerrar rutas en curso');
  END IF;
  
  -- Update route status to completed
  UPDATE public.rutas_planificadas
  SET estado = 'completada',
      updated_at = now()
  WHERE id = p_ruta_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Ruta cerrada correctamente');
END;
$$;

-- Function to close a hoja de ruta
CREATE OR REPLACE FUNCTION public.close_hoja_ruta(p_hoja_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hoja RECORD;
BEGIN
  -- Verify the hoja exists
  SELECT * INTO v_hoja
  FROM public.hojas_ruta
  WHERE id = p_hoja_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hoja de ruta no encontrada');
  END IF;
  
  -- Verify the driver is the assigned one
  IF v_hoja.chofer_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para cerrar esta hoja de ruta');
  END IF;
  
  -- Verify the hoja is in transit
  IF v_hoja.estado != 'en_transito' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden cerrar hojas en tránsito');
  END IF;
  
  -- Update hoja status to completed
  UPDATE public.hojas_ruta
  SET estado = 'completada',
      fin_real = now(),
      updated_at = now()
  WHERE id = p_hoja_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Hoja de ruta cerrada correctamente');
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.close_ruta_planificada(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_hoja_ruta(uuid) TO authenticated;