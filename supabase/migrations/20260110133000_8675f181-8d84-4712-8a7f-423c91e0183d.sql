-- =====================================================
-- Fase 1: Agregar columnas a tabla envios
-- =====================================================

-- Cantidad de bultos
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS cantidad_bultos INTEGER DEFAULT 1;

-- Códigos postales
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS codigo_postal_origen TEXT;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS codigo_postal_destino TEXT;

-- Datos adicionales del destinatario
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS whatsapp_destinatario TEXT;

-- DNI/CUIT de remitente y destinatario
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS dni_remitente TEXT;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS dni_destinatario TEXT;

-- Tipo de servicio (envio_completo o solo_retiro)
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS tipo_servicio TEXT DEFAULT 'envio_completo';

-- Campos de retiro en domicilio
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS requiere_retiro BOOLEAN DEFAULT FALSE;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS fecha_retiro DATE;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS horario_retiro TEXT;
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS notas_retiro TEXT;

-- Preferencias de entrega
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS dias_preferidos_entrega TEXT[];
ALTER TABLE public.envios ADD COLUMN IF NOT EXISTS horario_preferido_entrega TEXT;

-- =====================================================
-- Fase 2: Agregar columna dni_cuit a tabla clientes
-- =====================================================

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS dni_cuit TEXT;

-- Crear índice único para dni_cuit (solo para valores no nulos y no vacíos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_dni_cuit_unique 
ON public.clientes(dni_cuit) 
WHERE dni_cuit IS NOT NULL AND dni_cuit != '';

-- =====================================================
-- Comentarios para documentación
-- =====================================================

COMMENT ON COLUMN public.envios.tipo_servicio IS 'Tipo de servicio: envio_completo o solo_retiro';
COMMENT ON COLUMN public.envios.requiere_retiro IS 'Si el envío requiere retiro en domicilio del remitente';
COMMENT ON COLUMN public.envios.dias_preferidos_entrega IS 'Array de días preferidos: lunes, martes, etc';
COMMENT ON COLUMN public.clientes.dni_cuit IS 'DNI o CUIT del cliente para identificación única';