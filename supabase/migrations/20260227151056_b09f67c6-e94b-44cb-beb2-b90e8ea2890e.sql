CREATE OR REPLACE FUNCTION public.validate_concepto_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_concepto_tenant_id UUID;
  v_tarifa_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_concepto_tenant_id FROM tarifa_conceptos WHERE id = NEW.concepto_id;
  SELECT tenant_id INTO v_tarifa_tenant_id FROM tarifas WHERE id = NEW.tarifa_id;
  
  -- Permitir conceptos globales (sin tenant) en cualquier tarifa
  IF v_concepto_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Permitir si el usuario es super admin
  IF public.current_user_is_super_admin() THEN
    RETURN NEW;
  END IF;
  
  -- Validacion normal: deben coincidir los tenants
  IF v_concepto_tenant_id IS DISTINCT FROM v_tarifa_tenant_id THEN
    RAISE EXCEPTION 'El concepto (tenant %) no pertenece al mismo tenant que la tarifa (tenant %)',
      v_concepto_tenant_id, v_tarifa_tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$;