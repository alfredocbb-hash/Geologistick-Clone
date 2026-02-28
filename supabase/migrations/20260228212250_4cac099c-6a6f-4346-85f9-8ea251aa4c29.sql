CREATE OR REPLACE FUNCTION public.upsert_sucursal_tarifas(p_tarifa_id uuid, p_tenant_id uuid, p_assignments jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assignment JSONB;
  v_sucursal_id UUID;
  v_habilitada BOOLEAN;
  v_tarifa_tenant_id UUID;
BEGIN
  -- Validate caller is admin
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Derive tenant_id from the tarifa itself (authoritative source)
  SELECT tenant_id INTO v_tarifa_tenant_id FROM tarifas WHERE id = p_tarifa_id;
  
  IF v_tarifa_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tarifa not found or has no tenant_id';
  END IF;

  -- Validate tenant_id matches caller (unless super_admin)
  IF NOT public.current_user_is_super_admin() THEN
    IF v_tarifa_tenant_id IS DISTINCT FROM public.current_user_tenant() THEN
      RAISE EXCEPTION 'Permission denied: tenant mismatch';
    END IF;
  END IF;

  -- Process each assignment using the tarifa's tenant_id (not the passed p_tenant_id)
  FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    v_sucursal_id := (v_assignment->>'sucursal_id')::UUID;
    v_habilitada := (v_assignment->>'habilitada')::BOOLEAN;

    IF EXISTS (SELECT 1 FROM sucursal_tarifas WHERE sucursal_id = v_sucursal_id AND tarifa_id = p_tarifa_id) THEN
      UPDATE sucursal_tarifas
      SET habilitada = v_habilitada, tenant_id = v_tarifa_tenant_id, updated_at = NOW()
      WHERE sucursal_id = v_sucursal_id AND tarifa_id = p_tarifa_id;
    ELSE
      INSERT INTO sucursal_tarifas (sucursal_id, tarifa_id, habilitada, tenant_id, updated_at)
      VALUES (v_sucursal_id, p_tarifa_id, v_habilitada, v_tarifa_tenant_id, NOW());
    END IF;
  END LOOP;
END;
$function$