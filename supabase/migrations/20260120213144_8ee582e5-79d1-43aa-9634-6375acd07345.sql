-- =====================================================
-- PARTE 1: Configuración de Comisiones por Chofer
-- =====================================================

-- Agregar campos de comisión a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comision_tipo TEXT DEFAULT 'tarifa';
-- Valores: 'tarifa' (usa tarifa del envío), 'porcentaje', 'fija', 'mixta'

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comision_porcentaje DECIMAL(5,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comision_fija DECIMAL(10,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comision_notas TEXT;

-- =====================================================
-- PARTE 2: Auditoría para edición de montos
-- =====================================================

-- Campos de auditoría en comisiones
ALTER TABLE comisiones ADD COLUMN IF NOT EXISTS monto_original DECIMAL(10,2);
ALTER TABLE comisiones ADD COLUMN IF NOT EXISTS editado_por UUID REFERENCES auth.users(id);
ALTER TABLE comisiones ADD COLUMN IF NOT EXISTS editado_at TIMESTAMPTZ;

-- =====================================================
-- PARTE 3: Registro de Última Milla
-- =====================================================

-- Campos para última milla en envios
ALTER TABLE envios ADD COLUMN IF NOT EXISTS chofer_ultima_milla_id UUID REFERENCES auth.users(id);
ALTER TABLE envios ADD COLUMN IF NOT EXISTS fecha_asignacion_ultima_milla TIMESTAMPTZ;

-- Índice para búsquedas por chofer de última milla
CREATE INDEX IF NOT EXISTS idx_envios_chofer_ultima_milla ON envios(chofer_ultima_milla_id) WHERE chofer_ultima_milla_id IS NOT NULL;