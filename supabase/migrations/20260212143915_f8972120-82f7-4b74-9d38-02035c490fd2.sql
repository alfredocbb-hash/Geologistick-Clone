
ALTER TABLE envios ADD COLUMN IF NOT EXISTS estado_ml text;

ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'no_entregado';

INSERT INTO ml_status_mapping (ml_status, ml_substatus, estado_interno, descripcion)
VALUES ('shipped', 'rescheduled_by_meli', 'en_transito', 'Reprogramado por MercadoLibre')
ON CONFLICT DO NOTHING;
