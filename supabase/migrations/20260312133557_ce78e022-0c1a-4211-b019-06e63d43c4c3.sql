
CREATE OR REPLACE FUNCTION public.close_ruta_planificada(p_ruta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ruta RECORD;
BEGIN
  SELECT * INTO v_ruta
  FROM public.rutas_planificadas
  WHERE id = p_ruta_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruta no encontrada');
  END IF;
  
  IF v_ruta.chofer_id != auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para cerrar esta ruta');
  END IF;
  
  IF v_ruta.estado != 'en_curso' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden cerrar rutas en curso');
  END IF;
  
  UPDATE public.rutas_planificadas
  SET estado = 'completada',
      updated_at = now()
  WHERE id = p_ruta_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Ruta cerrada correctamente');
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_hoja_ruta(p_hoja_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hoja RECORD;
BEGIN
  SELECT * INTO v_hoja
  FROM public.hojas_ruta
  WHERE id = p_hoja_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hoja de ruta no encontrada');
  END IF;
  
  IF v_hoja.chofer_id != auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para cerrar esta hoja de ruta');
  END IF;
  
  IF v_hoja.estado != 'en_transito' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden cerrar hojas en tránsito');
  END IF;
  
  UPDATE public.hojas_ruta
  SET estado = 'completada',
      fin_real = now(),
      updated_at = now()
  WHERE id = p_hoja_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Hoja de ruta cerrada correctamente');
END;
$function$;
