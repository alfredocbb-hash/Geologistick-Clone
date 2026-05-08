CREATE OR REPLACE FUNCTION public.reschedule_envio(p_envio_id uuid, p_new_date timestamp with time zone, p_reason text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_envio RECORD;
  v_new_estado TEXT;
  v_is_ml BOOLEAN;
  v_can_reprogramar BOOLEAN;
BEGIN
  SELECT id, estado, chofer_id, reprogramado_count, tenant_id, ml_shipment_id
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

  v_is_ml := v_envio.ml_shipment_id IS NOT NULL;
  v_can_reprogramar := v_envio.estado::text IN ('en_reparto', 'primera_visita', 'segunda_visita');

  IF v_is_ml AND v_can_reprogramar THEN
    v_new_estado := 'reprogramado';
  ELSE
    v_new_estado := 'pendiente';
  END IF;

  UPDATE envios SET
    fecha_entrega = p_new_date,
    estado = v_new_estado::shipment_status,
    chofer_id = CASE WHEN v_new_estado = 'pendiente' THEN NULL ELSE chofer_id END,
    reprogramado_count = COALESCE(v_envio.reprogramado_count, 0) + 1,
    ultima_reprogramacion = NOW()
  WHERE id = p_envio_id;

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
    v_new_estado::shipment_status,
    'Entrega reprogramada para ' || to_char(p_new_date, 'DD/MM/YYYY')
      || '. Motivo: ' || COALESCE(NULLIF(p_reason, ''), 'No especificado')
      || '. Intento #' || (COALESCE(v_envio.reprogramado_count, 0) + 1),
    auth.uid()
  );
END;
$function$;