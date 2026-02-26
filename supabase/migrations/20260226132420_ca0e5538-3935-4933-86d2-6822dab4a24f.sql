
CREATE UNIQUE INDEX idx_clientes_unique_nombre_direccion 
ON clientes (tenant_id, LOWER(TRIM(nombre)), LOWER(TRIM(direccion)))
WHERE nombre IS NOT NULL AND direccion IS NOT NULL;
