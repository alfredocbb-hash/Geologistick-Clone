-- Paso 1: Agregar nuevo valor al enum
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'en_sucursal' AFTER 'recogido';