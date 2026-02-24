
-- Fix corrupt data: update sucursal_tarifas records with wrong tenant_id
-- by setting tenant_id based on the tarifa's tenant_id
UPDATE public.sucursal_tarifas st
SET tenant_id = t.tenant_id
FROM public.tarifas t
WHERE st.tarifa_id = t.id
  AND st.tenant_id IS DISTINCT FROM t.tenant_id;

-- Same for sucursal_conceptos
UPDATE public.sucursal_conceptos sc
SET tenant_id = tc.tenant_id
FROM public.tarifa_conceptos tc
WHERE sc.concepto_id = tc.id
  AND sc.tenant_id IS DISTINCT FROM tc.tenant_id;

-- Create SECURITY DEFINER function for sucursal_tarifas upsert
CREATE OR REPLACE FUNCTION public.upsert_sucursal_tarifas(
  p_tarifa_id UUID,
  p_tenant_id UUID,
  p_assignments JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assignment JSONB;
  v_sucursal_id UUID;
  v_habilitada BOOLEAN;
BEGIN
  -- Validate caller is admin
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Validate tenant_id matches caller (unless super_admin)
  IF NOT public.current_user_is_super_admin() THEN
    IF p_tenant_id IS DISTINCT FROM public.current_user_tenant() THEN
      RAISE EXCEPTION 'Permission denied: tenant mismatch';
    END IF;
  END IF;

  -- Process each assignment
  FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    v_sucursal_id := (v_assignment->>'sucursal_id')::UUID;
    v_habilitada := (v_assignment->>'habilitada')::BOOLEAN;

    IF EXISTS (SELECT 1 FROM sucursal_tarifas WHERE sucursal_id = v_sucursal_id AND tarifa_id = p_tarifa_id) THEN
      UPDATE sucursal_tarifas
      SET habilitada = v_habilitada, tenant_id = p_tenant_id, updated_at = NOW()
      WHERE sucursal_id = v_sucursal_id AND tarifa_id = p_tarifa_id;
    ELSE
      INSERT INTO sucursal_tarifas (sucursal_id, tarifa_id, habilitada, tenant_id, updated_at)
      VALUES (v_sucursal_id, p_tarifa_id, v_habilitada, p_tenant_id, NOW());
    END IF;
  END LOOP;
END;
$$;

-- Create SECURITY DEFINER function for sucursal_conceptos upsert
CREATE OR REPLACE FUNCTION public.upsert_sucursal_conceptos(
  p_concepto_id UUID,
  p_tenant_id UUID,
  p_assignments JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assignment JSONB;
  v_sucursal_id UUID;
  v_habilitado BOOLEAN;
BEGIN
  -- Validate caller is admin
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- Validate tenant_id matches caller (unless super_admin)
  IF NOT public.current_user_is_super_admin() THEN
    IF p_tenant_id IS DISTINCT FROM public.current_user_tenant() THEN
      RAISE EXCEPTION 'Permission denied: tenant mismatch';
    END IF;
  END IF;

  -- Process each assignment
  FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
  LOOP
    v_sucursal_id := (v_assignment->>'sucursal_id')::UUID;
    v_habilitado := (v_assignment->>'habilitado')::BOOLEAN;

    IF EXISTS (SELECT 1 FROM sucursal_conceptos WHERE sucursal_id = v_sucursal_id AND concepto_id = p_concepto_id) THEN
      UPDATE sucursal_conceptos
      SET habilitado = v_habilitado, tenant_id = p_tenant_id, updated_at = NOW()
      WHERE sucursal_id = v_sucursal_id AND concepto_id = p_concepto_id;
    ELSE
      INSERT INTO sucursal_conceptos (sucursal_id, concepto_id, habilitado, tenant_id, updated_at)
      VALUES (v_sucursal_id, p_concepto_id, v_habilitado, p_tenant_id, NOW());
    END IF;
  END LOOP;
END;
$$;
