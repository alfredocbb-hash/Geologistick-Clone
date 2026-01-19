-- Fix handle_new_user trigger to detect when user is created for an existing tenant
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
BEGIN
  -- Check if user was created with a specific tenant_id in metadata (by super admin)
  existing_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  
  IF existing_tenant_id IS NOT NULL THEN
    -- User created for an existing tenant - only create profile, don't create new tenant
    INSERT INTO public.profiles (user_id, email, nombre, tenant_id)
    VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(NEW.raw_user_meta_data->>'nombre', SPLIT_PART(NEW.email, '@', 1)),
      existing_tenant_id
    );
    
    -- Don't create tenant, branch, role or branding - the edge function handles that
    RETURN NEW;
  END IF;
  
  -- Normal user registration: create tenant, profile, role, branch and branding
  new_slug := LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '-')) || '-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 8);
  
  INSERT INTO public.tenants (nombre, slug, plan, activo, trial_ends_at, max_usuarios, max_sucursales, max_envios_mes)
  VALUES ('Mi Empresa', new_slug, 'trial', true, NOW() + INTERVAL '14 days', 5, 3, 500)
  RETURNING id INTO new_tenant_id;
  
  INSERT INTO public.profiles (user_id, email, nombre, tenant_id)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', SPLIT_PART(NEW.email, '@', 1)), new_tenant_id);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  
  INSERT INTO public.sucursales (nombre, direccion, tenant_id, codigo, es_centro_logistico, activa)
  VALUES ('Sucursal Principal', 'Por configurar', new_tenant_id, 'MAIN', true, true);
  
  INSERT INTO public.tenant_branding (tenant_id, nombre_app)
  VALUES (new_tenant_id, 'Mi Empresa');
  
  RETURN NEW;
END;
$$;

-- Clean up orphaned tenants (those without any users)
DELETE FROM public.tenants 
WHERE id NOT IN (SELECT DISTINCT tenant_id FROM public.profiles WHERE tenant_id IS NOT NULL);