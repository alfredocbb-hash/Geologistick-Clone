CREATE OR REPLACE FUNCTION public.get_daily_revenue(p_tenant_id uuid, p_date text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(precio_total), 0)
  FROM envios
  WHERE tenant_id = p_tenant_id
    AND created_at >= p_date::timestamptz
    AND estado NOT IN ('cancelado', 'devuelto');
$$;