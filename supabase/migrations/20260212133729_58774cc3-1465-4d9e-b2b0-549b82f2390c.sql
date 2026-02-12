-- Remove the unique constraint on estado_interno to allow multiple ML statuses to map to the same internal status
ALTER TABLE ml_status_mapping DROP CONSTRAINT IF EXISTS ml_status_mapping_estado_interno_key;

-- Now insert the missing mappings
INSERT INTO ml_status_mapping (ml_status, ml_substatus, estado_interno, descripcion)
VALUES 
  ('not_delivered', 'returning_to_sender', 'devuelto', 'No entregado - devolviendo al remitente'),
  ('not_delivered', NULL, 'no_entregado', 'No entregado - motivo generico')
ON CONFLICT DO NOTHING;