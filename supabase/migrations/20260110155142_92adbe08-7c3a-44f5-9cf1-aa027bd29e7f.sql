-- =====================================================
-- TABLA: vehiculos
-- Gestión de vehículos de la empresa
-- =====================================================
CREATE TABLE public.vehiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patente TEXT NOT NULL UNIQUE,
  marca TEXT,
  modelo TEXT,
  anio INTEGER,
  tipo TEXT DEFAULT 'furgon', -- furgon, camioneta, moto, auto
  capacidad_kg DECIMAL,
  capacidad_bultos INTEGER,
  estado TEXT DEFAULT 'disponible', -- disponible, en_uso, mantenimiento, inactivo
  chofer_asignado_id UUID,
  sucursal_id UUID REFERENCES sucursales(id),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER update_vehiculos_updated_at
  BEFORE UPDATE ON public.vehiculos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para vehiculos
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver vehículos" ON public.vehiculos
  FOR SELECT USING (true);

CREATE POLICY "Gestionar vehículos admin" ON public.vehiculos
  FOR ALL USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role));

-- =====================================================
-- TABLA: hojas_ruta
-- Hojas de ruta entre sucursales para transferencia de envíos
-- =====================================================
CREATE TABLE public.hojas_ruta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  sucursal_origen_id UUID NOT NULL REFERENCES sucursales(id),
  sucursal_destino_id UUID NOT NULL REFERENCES sucursales(id),
  chofer_id UUID,
  vehiculo_id UUID REFERENCES vehiculos(id),
  fecha_salida TIMESTAMPTZ,
  fecha_llegada_estimada TIMESTAMPTZ,
  fecha_llegada_real TIMESTAMPTZ,
  estado TEXT DEFAULT 'pendiente', -- pendiente, en_transito, recibida, cancelada
  cantidad_envios INTEGER DEFAULT 0,
  notas TEXT,
  recibido_por UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER update_hojas_ruta_updated_at
  BEFORE UPDATE ON public.hojas_ruta
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para hojas_ruta
ALTER TABLE public.hojas_ruta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver hojas de ruta" ON public.hojas_ruta
  FOR SELECT USING (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR
    has_role(auth.uid(), 'operador'::app_role) OR
    has_role(auth.uid(), 'despachador'::app_role) OR
    sucursal_origen_id = get_user_sucursal(auth.uid()) OR
    sucursal_destino_id = get_user_sucursal(auth.uid())
  );

CREATE POLICY "Crear hojas de ruta" ON public.hojas_ruta
  FOR INSERT WITH CHECK (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR
    has_role(auth.uid(), 'operador'::app_role) OR
    has_role(auth.uid(), 'despachador'::app_role)
  );

CREATE POLICY "Actualizar hojas de ruta" ON public.hojas_ruta
  FOR UPDATE USING (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR
    has_role(auth.uid(), 'operador'::app_role) OR
    sucursal_origen_id = get_user_sucursal(auth.uid()) OR
    sucursal_destino_id = get_user_sucursal(auth.uid())
  );

-- =====================================================
-- TABLA: hoja_ruta_envios
-- Relación entre hojas de ruta y envíos
-- =====================================================
CREATE TABLE public.hoja_ruta_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hoja_ruta_id UUID NOT NULL REFERENCES hojas_ruta(id) ON DELETE CASCADE,
  envio_id UUID NOT NULL REFERENCES envios(id),
  orden INTEGER,
  estado TEXT DEFAULT 'asignado', -- asignado, en_transito, recibido
  recibido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para hoja_ruta_envios
ALTER TABLE public.hoja_ruta_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver envíos de hoja de ruta" ON public.hoja_ruta_envios
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM hojas_ruta hr 
      WHERE hr.id = hoja_ruta_envios.hoja_ruta_id 
      AND (
        is_admin(auth.uid()) OR 
        has_role(auth.uid(), 'supervisor'::app_role) OR
        has_role(auth.uid(), 'operador'::app_role) OR
        hr.sucursal_origen_id = get_user_sucursal(auth.uid()) OR
        hr.sucursal_destino_id = get_user_sucursal(auth.uid())
      )
    )
  );

CREATE POLICY "Gestionar envíos de hoja de ruta" ON public.hoja_ruta_envios
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hojas_ruta hr 
      WHERE hr.id = hoja_ruta_envios.hoja_ruta_id 
      AND (
        is_admin(auth.uid()) OR 
        has_role(auth.uid(), 'supervisor'::app_role) OR
        has_role(auth.uid(), 'operador'::app_role) OR
        has_role(auth.uid(), 'despachador'::app_role)
      )
    )
  );

-- =====================================================
-- TABLA: rutas_planificadas
-- Rutas de entrega/retiro planificadas
-- =====================================================
CREATE TABLE public.rutas_planificadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  hora_inicio TIME,
  tipo TEXT DEFAULT 'mixta', -- retiro, entrega, mixta
  chofer_id UUID,
  vehiculo_id UUID REFERENCES vehiculos(id),
  sucursal_id UUID REFERENCES sucursales(id),
  distancia_total_km DECIMAL,
  tiempo_estimado_minutos INTEGER,
  estado TEXT DEFAULT 'borrador', -- borrador, confirmada, en_progreso, completada, cancelada
  paradas_completadas INTEGER DEFAULT 0,
  total_paradas INTEGER DEFAULT 0,
  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER update_rutas_planificadas_updated_at
  BEFORE UPDATE ON public.rutas_planificadas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para rutas_planificadas
ALTER TABLE public.rutas_planificadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver rutas planificadas" ON public.rutas_planificadas
  FOR SELECT USING (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR
    has_role(auth.uid(), 'operador'::app_role) OR
    chofer_id = auth.uid() OR
    sucursal_id = get_user_sucursal(auth.uid())
  );

CREATE POLICY "Gestionar rutas planificadas" ON public.rutas_planificadas
  FOR ALL USING (
    is_admin(auth.uid()) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR
    has_role(auth.uid(), 'operador'::app_role)
  );

-- =====================================================
-- TABLA: ruta_paradas
-- Paradas de una ruta planificada
-- =====================================================
CREATE TABLE public.ruta_paradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruta_id UUID NOT NULL REFERENCES rutas_planificadas(id) ON DELETE CASCADE,
  envio_id UUID NOT NULL REFERENCES envios(id),
  orden INTEGER NOT NULL,
  tipo TEXT NOT NULL, -- retiro, entrega
  direccion TEXT,
  lat DECIMAL,
  lng DECIMAL,
  hora_estimada TIME,
  estado TEXT DEFAULT 'pendiente', -- pendiente, en_camino, completada, fallida
  completada_at TIMESTAMPTZ,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para ruta_paradas
ALTER TABLE public.ruta_paradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver paradas de ruta" ON public.ruta_paradas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rutas_planificadas rp 
      WHERE rp.id = ruta_paradas.ruta_id 
      AND (
        is_admin(auth.uid()) OR 
        has_role(auth.uid(), 'supervisor'::app_role) OR
        has_role(auth.uid(), 'operador'::app_role) OR
        rp.chofer_id = auth.uid() OR
        rp.sucursal_id = get_user_sucursal(auth.uid())
      )
    )
  );

CREATE POLICY "Gestionar paradas de ruta" ON public.ruta_paradas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM rutas_planificadas rp 
      WHERE rp.id = ruta_paradas.ruta_id 
      AND (
        is_admin(auth.uid()) OR 
        has_role(auth.uid(), 'supervisor'::app_role) OR
        has_role(auth.uid(), 'operador'::app_role) OR
        rp.chofer_id = auth.uid()
      )
    )
  );

-- =====================================================
-- Función para generar número de hoja de ruta
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_hoja_ruta_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_number TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_number := 'HR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.hojas_ruta WHERE numero = new_number) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_number;
END;
$$;

-- =====================================================
-- Función para generar número de ruta planificada
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_ruta_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  new_number TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_number := 'RP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.rutas_planificadas WHERE numero = new_number) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN new_number;
END;
$$;