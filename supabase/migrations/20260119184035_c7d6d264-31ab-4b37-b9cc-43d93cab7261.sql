-- Update the handle_new_user trigger to:
-- 1. Create branch named "Administración" with code "ADMIN"
-- 2. Assign the branch to the user's profile immediately

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  new_slug TEXT;
  existing_tenant_id UUID;
  new_branch_id UUID;
BEGIN
  -- Check if user is being added to an existing tenant (created by super_admin)
  existing_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  
  IF existing_tenant_id IS NOT NULL THEN
    -- User is being added to existing tenant, just create profile without branch assignment
    -- The admin who created them should assign the branch
    INSERT INTO public.profiles (user_id, email, nombre, tenant_id)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', SPLIT_PART(NEW.email, '@', 1)), existing_tenant_id);
    RETURN NEW;
  END IF;
  
  -- Create new tenant for self-registered users
  new_slug := LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '-')) || '-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 8);
  
  INSERT INTO public.tenants (nombre, slug, plan, activo, trial_ends_at, max_usuarios, max_sucursales, max_envios_mes)
  VALUES ('Mi Empresa', new_slug, 'trial', true, NOW() + INTERVAL '14 days', 5, 3, 500)
  RETURNING id INTO new_tenant_id;
  
  -- Create "Administración" branch and get its ID
  INSERT INTO public.sucursales (nombre, direccion, tenant_id, codigo, es_centro_logistico, activa)
  VALUES ('Administración', 'Por configurar', new_tenant_id, 'ADMIN', true, true)
  RETURNING id INTO new_branch_id;
  
  -- Create profile WITH the branch assigned
  INSERT INTO public.profiles (user_id, email, nombre, tenant_id, sucursal_id)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', SPLIT_PART(NEW.email, '@', 1)), new_tenant_id, new_branch_id);
  
  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  
  -- Create default branding
  INSERT INTO public.tenant_branding (tenant_id, nombre_app)
  VALUES (new_tenant_id, 'Mi Empresa');
  
  RETURN NEW;
END;
$$;