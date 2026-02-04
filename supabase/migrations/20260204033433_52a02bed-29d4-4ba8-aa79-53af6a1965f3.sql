-- Agregar estado 'incidencia' al enum shipment_status
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'incidencia';

-- Agregar campos de resolución a la tabla incidentes
ALTER TABLE incidentes 
ADD COLUMN IF NOT EXISTS accion_tomada text,
ADD COLUMN IF NOT EXISTS resuelto_por uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS resuelto_at timestamptz,
ADD COLUMN IF NOT EXISTS resolucion text;

-- Crear índice para consultas frecuentes de incidencias pendientes
CREATE INDEX IF NOT EXISTS idx_incidentes_estado_tenant 
ON incidentes(tenant_id, estado);

-- Crear índice para buscar por envío
CREATE INDEX IF NOT EXISTS idx_incidentes_envio_id 
ON incidentes(envio_id);