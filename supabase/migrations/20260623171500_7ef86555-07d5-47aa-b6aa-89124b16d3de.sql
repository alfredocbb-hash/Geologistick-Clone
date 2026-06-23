CREATE OR REPLACE FUNCTION public.assign_envios_to_chofer_retroactivo(
  p_chofer_user_id uuid,
  p_envio_ids uuid[],
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_tenant uuid;
  v_chofer_tenant uuid;
  v_caller_name text;
  v_chofer_name text;
  v_asignados int := 0;
  v_omitidos int := 0;
  v_envio RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
  END IF;

  IF NOT public.is_admin(v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo administradores pueden asignar envíos retroactivamente');
  END IF;

  SELECT tenant_id INTO v_tenant FROM profiles WHERE user_id = v_caller LIMIT 1;
  SELECT tenant_id INTO v_chofer_tenant FROM profiles WHERE user_id = p_chofer_user_id LIMIT 1;

  IF v_chofer_tenant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chofer no encontrado');
  END IF;

  -- super_admin puede operar en cualquier tenant; admin solo en el suyo
  IF NOT public.is_super_admin(v_caller) AND v_chofer_tenant <> v_tenant THEN
    RETURN jsonb_build_object('success', false, 'error', 'El chofer no pertenece a tu organización');
  END IF;

  v_caller_name := public.get_user_display_name(v_caller);
  v_chofer_name := public.get_user_display_name(p_chofer_user_id);

  FOR v_envio IN
    SELECT id, estado, chofer_id, tenant_id
    FROM envios
    WHERE id = ANY(p_envio_ids)
      AND tenant_id = v_chofer_tenant
  LOOP
    -- Evitar pisar envíos ya asignados a OTRO chofer (salvo super_admin)
    IF v_envio.chofer_id IS NOT NULL AND v_envio.chofer_id <> p_chofer_user_id AND NOT public.is_super_admin(v_caller) THEN
      v_omitidos := v_omitidos + 1;
      CONTINUE;
    END IF;

    UPDATE envios
    SET chofer_id = p_chofer_user_id,
        chofer_ultima_milla_id = p_chofer_user_id,
        fecha_asignacion_ultima_milla = COALESCE(fecha_asignacion_ultima_milla, now()),
        updated_at = now()
    WHERE id = v_envio.id;

    INSERT INTO envio_historial (envio_id, estado_anterior, estado_nuevo, notas, created_by)
    VALUES (
      v_envio.id,
      v_envio.estado,
      v_envio.estado,
      'Chofer asignado retroactivamente a ' || COALESCE(v_chofer_name, p_chofer_user_id::text)
        || ' por ' || COALESCE(v_caller_name, 'admin')
        || CASE WHEN p_motivo IS NOT NULL AND p_motivo <> '' THEN '. Motivo: ' || p_motivo ELSE '' END,
      v_caller
    );

    v_asignados := v_asignados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'asignados', v_asignados,
    'omitidos', v_omitidos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_envios_to_chofer_retroactivo(uuid, uuid[], text) TO authenticated;