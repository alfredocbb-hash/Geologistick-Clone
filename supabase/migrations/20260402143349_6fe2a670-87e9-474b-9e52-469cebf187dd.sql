
DROP INDEX IF EXISTS idx_clientes_dni_cuit_unique;
CREATE UNIQUE INDEX idx_clientes_dni_cuit_unique 
  ON public.clientes (tenant_id, lower(trim(dni_cuit))) 
  WHERE dni_cuit IS NOT NULL AND dni_cuit <> '';
