-- Drop the current global unique index on sucursales.codigo
DROP INDEX IF EXISTS idx_sucursales_codigo;

-- Create a new unique index that's scoped per tenant
-- This allows each tenant to have their own "ADMIN" branch code
CREATE UNIQUE INDEX idx_sucursales_codigo 
ON public.sucursales (tenant_id, codigo) 
WHERE (codigo IS NOT NULL);