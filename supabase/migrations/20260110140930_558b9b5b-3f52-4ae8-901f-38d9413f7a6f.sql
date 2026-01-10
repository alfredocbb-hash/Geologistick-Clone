-- =============================================
-- FASE 1: Actualizar tabla sucursales
-- =============================================

-- Código único de sucursal (para tracking)
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS ciudad TEXT;

-- Capacidades operativas
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS es_centro_logistico BOOLEAN DEFAULT FALSE;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS puede_despachar BOOLEAN DEFAULT TRUE;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS puede_recibir BOOLEAN DEFAULT TRUE;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS realiza_retiros BOOLEAN DEFAULT FALSE;
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS realiza_entregas BOOLEAN DEFAULT FALSE;

-- Centro logístico al que pertenece (para ruteo)
ALTER TABLE sucursales ADD COLUMN IF NOT EXISTS centro_logistico_id UUID REFERENCES sucursales(id);

-- Índice único para código
CREATE UNIQUE INDEX IF NOT EXISTS idx_sucursales_codigo ON sucursales(codigo) WHERE codigo IS NOT NULL;

-- =============================================
-- FASE 2: Crear tabla sucursal_zonas (cobertura por ciudad)
-- =============================================

CREATE TABLE IF NOT EXISTS sucursal_zonas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  ciudad TEXT NOT NULL,
  provincia TEXT,
  codigo_postal_desde TEXT,
  codigo_postal_hasta TEXT,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sucursal_id, ciudad)
);

-- RLS para sucursal_zonas
ALTER TABLE sucursal_zonas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestionan zonas" ON sucursal_zonas FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Usuarios ven zonas" ON sucursal_zonas FOR SELECT
USING (true);

-- =============================================
-- FASE 3: Actualizar tabla envios
-- =============================================

-- Tipo de servicio expandido
ALTER TABLE envios ADD COLUMN IF NOT EXISTS tipo_servicio_detalle TEXT DEFAULT 'sucursal_sucursal';
-- Valores: 'puerta_sucursal', 'puerta_puerta', 'sucursal_puerta', 'sucursal_sucursal'

-- Direcciones de retiro (para servicios puerta_*)
ALTER TABLE envios ADD COLUMN IF NOT EXISTS direccion_retiro TEXT;
ALTER TABLE envios ADD COLUMN IF NOT EXISTS ciudad_retiro TEXT;
ALTER TABLE envios ADD COLUMN IF NOT EXISTS cp_retiro TEXT;

-- Direcciones de entrega (para servicios *_puerta)
ALTER TABLE envios ADD COLUMN IF NOT EXISTS direccion_entrega TEXT;
ALTER TABLE envios ADD COLUMN IF NOT EXISTS ciudad_entrega TEXT;
ALTER TABLE envios ADD COLUMN IF NOT EXISTS cp_entrega TEXT;

-- Control de rótulos
ALTER TABLE envios ADD COLUMN IF NOT EXISTS rotulo_generado BOOLEAN DEFAULT FALSE;
ALTER TABLE envios ADD COLUMN IF NOT EXISTS rotulo_generado_at TIMESTAMPTZ;

-- Sucursal que realiza el retiro (puede ser diferente a origen)
ALTER TABLE envios ADD COLUMN IF NOT EXISTS sucursal_retiro_id UUID REFERENCES sucursales(id);
-- Sucursal que realiza la entrega (puede ser diferente a destino)  
ALTER TABLE envios ADD COLUMN IF NOT EXISTS sucursal_entrega_id UUID REFERENCES sucursales(id);

-- =============================================
-- FASE 4: Crear tabla transferencias
-- =============================================

CREATE TABLE IF NOT EXISTS transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id UUID NOT NULL REFERENCES envios(id) ON DELETE CASCADE,
  sucursal_origen_id UUID NOT NULL REFERENCES sucursales(id),
  sucursal_destino_id UUID NOT NULL REFERENCES sucursales(id),
  tipo TEXT NOT NULL, -- 'a_centro', 'desde_centro', 'entre_sucursales'
  estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'en_transito', 'recibido'
  fecha_despacho TIMESTAMPTZ,
  fecha_recepcion TIMESTAMPTZ,
  despachado_por UUID,
  recibido_por UUID,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para transferencias
CREATE INDEX IF NOT EXISTS idx_transferencias_envio ON transferencias(envio_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_origen ON transferencias(sucursal_origen_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON transferencias(sucursal_destino_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_estado ON transferencias(estado);

-- RLS para transferencias
ALTER TABLE transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver transferencias de su sucursal" ON transferencias FOR SELECT
USING (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR
  sucursal_origen_id = get_user_sucursal(auth.uid()) OR
  sucursal_destino_id = get_user_sucursal(auth.uid())
);

CREATE POLICY "Crear transferencias" ON transferencias FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR
  has_role(auth.uid(), 'operador'::app_role) OR
  has_role(auth.uid(), 'despachador'::app_role)
);

CREATE POLICY "Actualizar transferencias" ON transferencias FOR UPDATE
USING (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR
  sucursal_destino_id = get_user_sucursal(auth.uid())
);

-- =============================================
-- FASE 5: Agregar conceptos de retiro y entrega
-- =============================================

INSERT INTO tarifa_conceptos (codigo, nombre, descripcion, orden, activo)
VALUES 
  ('retiro', 'Retiro a Domicilio', 'Servicio de retiro en domicilio del remitente', 10, true),
  ('entrega', 'Entrega a Domicilio', 'Servicio de entrega en domicilio del destinatario', 11, true)
ON CONFLICT (codigo) DO NOTHING;

-- =============================================
-- FASE 6: Actualizar función generate_tracking_number
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_tracking_number(p_sucursal_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  codigo_sucursal TEXT;
  new_tracking TEXT;
  exists_already BOOLEAN;
BEGIN
  -- Obtener código de sucursal
  IF p_sucursal_id IS NOT NULL THEN
    SELECT COALESCE(codigo, 'XXX') INTO codigo_sucursal
    FROM public.sucursales WHERE id = p_sucursal_id;
  ELSE
    codigo_sucursal := 'XXX';
  END IF;
  
  -- Si no hay código, usar XXX
  IF codigo_sucursal IS NULL THEN
    codigo_sucursal := 'XXX';
  END IF;
  
  -- Generar tracking único con prefijo
  LOOP
    new_tracking := codigo_sucursal || '-ENV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.envios WHERE tracking_number = new_tracking) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  
  RETURN new_tracking;
END;
$function$;