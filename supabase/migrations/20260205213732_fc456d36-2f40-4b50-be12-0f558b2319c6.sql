-- Crear función pública para obtener logos de clientes (para landing)
CREATE OR REPLACE FUNCTION public.get_public_client_logos()
RETURNS TABLE (
  id uuid,
  nombre text,
  slug text,
  logo_light text,
  logo_dark text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.nombre,
    t.slug,
    tb.logo_light,
    tb.logo_dark
  FROM public.tenants t
  JOIN public.tenant_branding tb ON tb.tenant_id = t.id
  WHERE
    t.activo = true
    AND (tb.logo_light IS NOT NULL OR tb.logo_dark IS NOT NULL)
  ORDER BY t.nombre;
$$;

-- Dar permisos a usuarios anónimos y autenticados
GRANT EXECUTE ON FUNCTION public.get_public_client_logos() TO anon, authenticated;

-- Crear función para contar tenants activos (para CTA badge)
CREATE OR REPLACE FUNCTION public.get_public_active_tenant_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.tenants
  WHERE activo = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_active_tenant_count() TO anon, authenticated;

-- Eliminar la política pública que exponía todo el branding
DROP POLICY IF EXISTS "Acceso público a logos para landing" ON public.tenant_branding;