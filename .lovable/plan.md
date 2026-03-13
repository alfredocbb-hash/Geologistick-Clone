

# Fix: Dashboard limitado a 1000 registros

## Problema

La query de **Ingresos del Día** (línea 46-51) obtiene filas reales (`precio_total`) y suma en el cliente. Supabase tiene un límite por defecto de 1000 filas, así que si hay más de 1000 envíos hoy, el total de ingresos se trunca.

Las queries de conteo (`count: 'exact', head: true`) no tienen este problema — devuelven el conteo correcto sin traer filas.

## Solución

Reemplazar la query de ingresos que trae filas y suma en el cliente por una **database function** que haga el `SUM` directamente en PostgreSQL, evitando el límite de 1000 filas.

### 1. Migración SQL — función `get_daily_revenue`

```sql
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
```

### 2. `src/pages/Dashboard.tsx`

Reemplazar la query de ingresos (líneas 46-53):

```typescript
// Antes: traía filas y sumaba en cliente (límite 1000)
const { data: todayRevenue } = await supabase
  .from('envios')
  .select('precio_total')
  ...

// Después: suma en la base de datos
const { data: revenueResult } = await supabase
  .rpc('get_daily_revenue', { p_tenant_id: tenantId, p_date: today });

const revenue = Number(revenueResult) || 0;
```

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Crear función `get_daily_revenue` |
| `src/pages/Dashboard.tsx` | Usar RPC en vez de fetch + reduce |

