
-- Add unique partial index for MP payment upsert (duplicates already cleaned)
CREATE UNIQUE INDEX IF NOT EXISTS pagos_envio_metodo_unique 
  ON pagos(envio_id, metodo) 
  WHERE estado = 'pendiente';
