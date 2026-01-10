-- Tabla de incidentes para reportes del chofer
CREATE TABLE public.incidentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  envio_id UUID REFERENCES public.envios(id) ON DELETE CASCADE,
  chofer_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ausente', 'rechazo', 'direccion_incorrecta', 'paquete_dañado', 'otro')),
  descripcion TEXT,
  foto_evidencia TEXT,
  resolucion TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'resuelto')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de ubicaciones de choferes en tiempo real
CREATE TABLE public.driver_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chofer_id UUID NOT NULL UNIQUE,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  accuracy NUMERIC,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agregar campos a hojas_ruta
ALTER TABLE public.hojas_ruta 
ADD COLUMN IF NOT EXISTS inicio_real TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fin_real TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS distancia_total_km NUMERIC,
ADD COLUMN IF NOT EXISTS tiempo_estimado_horas NUMERIC;

-- Agregar campo estado_retiro a envios
ALTER TABLE public.envios 
ADD COLUMN IF NOT EXISTS estado_retiro TEXT DEFAULT 'pendiente' CHECK (estado_retiro IN ('pendiente', 'en_camino', 'retirado', 'fallido'));

-- Enable RLS
ALTER TABLE public.incidentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para incidentes
CREATE POLICY "Choferes pueden ver sus incidentes" 
ON public.incidentes 
FOR SELECT 
USING (chofer_id = auth.uid());

CREATE POLICY "Choferes pueden crear incidentes" 
ON public.incidentes 
FOR INSERT 
WITH CHECK (chofer_id = auth.uid());

CREATE POLICY "Admins pueden ver todos los incidentes"
ON public.incidentes
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins pueden actualizar incidentes"
ON public.incidentes
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Políticas RLS para driver_locations
CREATE POLICY "Choferes pueden actualizar su ubicación" 
ON public.driver_locations 
FOR ALL 
USING (chofer_id = auth.uid());

CREATE POLICY "Admins pueden ver ubicaciones"
ON public.driver_locations
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Crear bucket para fotos de entrega
INSERT INTO storage.buckets (id, name, public) 
VALUES ('delivery-photos', 'delivery-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para delivery-photos
CREATE POLICY "Choferes pueden subir fotos de entrega"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'delivery-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Fotos de entrega son públicas"
ON storage.objects
FOR SELECT
USING (bucket_id = 'delivery-photos');

CREATE POLICY "Choferes pueden actualizar sus fotos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'delivery-photos' AND auth.role() = 'authenticated');