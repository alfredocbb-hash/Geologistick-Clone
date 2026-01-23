-- Add columns for third-party shipments (terciarizados)
ALTER TABLE envios 
ADD COLUMN IF NOT EXISTS es_terciarizado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS empresa_terciarizada TEXT,
ADD COLUMN IF NOT EXISTS tracking_externo TEXT,
ADD COLUMN IF NOT EXISTS codigo_cliente_externo TEXT,
ADD COLUMN IF NOT EXISTS codigo_orden_externo TEXT,
ADD COLUMN IF NOT EXISTS duracion_estimada_minutos INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS provincia TEXT;

-- Add index for tracking_externo for faster searches
CREATE INDEX IF NOT EXISTS idx_envios_tracking_externo ON envios(tracking_externo) WHERE tracking_externo IS NOT NULL;

-- Add index for filtering terciarizados
CREATE INDEX IF NOT EXISTS idx_envios_terciarizado ON envios(es_terciarizado) WHERE es_terciarizado = true;