-- Actualizar la función handle_new_user para crear tenant automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  new_slug TEXT;
BEGIN
  -- Generar un slug único basado en el email
  new_slug := LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '-')) || '-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 8);
  
  -- Crear un nuevo tenant para el usuario
  INSERT INTO public.tenants (nombre, slug, plan, activo, trial_ends_at, max_usuarios, max_sucursales, max_envios_mes)
  VALUES (
    'Mi Empresa',
    new_slug,
    'trial',
    true,
    NOW() + INTERVAL '14 days',
    5,
    3,
    500
  )
  RETURNING id INTO new_tenant_id;
  
  -- Crear el perfil del usuario con el tenant asignado
  INSERT INTO public.profiles (user_id, email, nombre, tenant_id)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', SPLIT_PART(NEW.email, '@', 1)), new_tenant_id);
  
  -- Asignar rol de admin al usuario (es el dueño de su empresa)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin');
  
  -- Crear sucursal principal para el tenant
  INSERT INTO public.sucursales (nombre, direccion, tenant_id, codigo, es_centro_logistico, activa)
  VALUES ('Sucursal Principal', 'Por configurar', new_tenant_id, 'MAIN', true, true);
  
  -- Crear branding inicial para el tenant
  INSERT INTO public.tenant_branding (tenant_id, nombre_app)
  VALUES (new_tenant_id, 'Mi Empresa');
  
  RETURN NEW;
END;
$$;