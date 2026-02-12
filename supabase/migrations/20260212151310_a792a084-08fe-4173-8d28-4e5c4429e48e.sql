CREATE OR REPLACE FUNCTION public.reschedule_envio(p_envio_id uuid, p_new_date timestamp with time zone, p_reason text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_envio RECORD;
BEGIN
  SELECT id, estado, chofer_id, reprogramado_count, tenant_id
  INTO v_envio
  FROM envios
  WHERE id = p_envio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envío no encontrado';
  END IF;

  IF v_envio.chofer_id != auth.uid() 
     AND NOT is_admin(auth.uid()) 
     AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'No tiene permisos para reprogramar este envío';
  END IF;

  UPDATE envios SET
    fecha_entrega = p_new_date,
    estado = 'pendiente',
    chofer_id = NULL,
    reprogramado_count = COALESCE(v_envio.reprogramado_count, 0) + 1,
    ultima_reprogramacion = NOW()
  WHERE id = p_envio_id;

  -- Marcar parada(s) en rutas planificadas como 'reprogramado'
  UPDATE ruta_paradas SET
    estado = 'reprogramado',
    completada_at = NOW(),
    notas = COALESCE(notas || ' | ', '') || 'Reprogramado: ' || COALESCE(NULLIF(p_reason, ''), 'Sin motivo')
  WHERE envio_id = p_envio_id
    AND estado = 'pendiente';

  INSERT INTO envio_historial (envio_id, estado_anterior, estado_nuevo, notas, created_by)
  VALUES (
    p_envio_id,
    v_envio.estado,
    'pendiente',
    'Entrega reprogramada para ' || to_char(p_new_date, 'DD/MM/YYYY') 
      || '. Motivo: ' || COALESCE(NULLIF(p_reason, ''), 'No especificado')
      || '. Intento #' || (COALESCE(v_envio.reprogramado_count, 0) + 1),
    auth.uid()
  );
END;
$function$;