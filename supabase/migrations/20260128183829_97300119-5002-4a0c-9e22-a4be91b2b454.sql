-- Actualizar trigger para permitir Edge Functions con service role
CREATE OR REPLACE FUNCTION public.set_sucursal_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si ya viene con tenant_id, respetarlo (permite Edge Functions con service role)
  IF NEW.tenant_id IS NOT NULL THEN
    -- Si hay usuario autenticado y no es super_admin, verificar que pertenezca al tenant
    IF auth.uid() IS NOT NULL AND NOT public.current_user_is_super_admin() THEN
      IF NEW.tenant_id != public.current_user_tenant() THEN
        RAISE EXCEPTION 'No puede crear sucursales en otro tenant';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Si no viene tenant_id, intentar obtenerlo del usuario actual
  IF auth.uid() IS NOT NULL THEN
    NEW.tenant_id := public.current_user_tenant();
  END IF;
  
  -- Validación final
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required for sucursales';
  END IF;
  
  RETURN NEW;
END;
$$;