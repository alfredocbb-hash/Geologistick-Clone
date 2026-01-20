-- Agregar tipo de tarifa y campos adicionales a tarifas
ALTER TABLE public.tarifas 
ADD COLUMN IF NOT EXISTS tipo_tarifa TEXT DEFAULT 'peso' CHECK (tipo_tarifa IN ('codigo_postal', 'zona', 'distancia', 'peso', 'volumen')),
ADD COLUMN IF NOT EXISTS precio_por_m3 NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rangos_precios JSONB DEFAULT '[]'::jsonb;

-- Agregar campo es_basico a tarifa_conceptos
ALTER TABLE public.tarifa_conceptos
ADD COLUMN IF NOT EXISTS es_basico BOOLEAN DEFAULT true;

-- Crear tabla sucursal_conceptos para gestionar conceptos adicionales por sucursal
CREATE TABLE IF NOT EXISTS public.sucursal_conceptos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE CASCADE,
  concepto_id UUID NOT NULL REFERENCES public.tarifa_conceptos(id) ON DELETE CASCADE,
  habilitado BOOLEAN DEFAULT true,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sucursal_id, concepto_id)
);

-- Habilitar RLS en sucursal_conceptos
ALTER TABLE public.sucursal_conceptos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para sucursal_conceptos
CREATE POLICY "Users can view sucursal_conceptos from their tenant"
ON public.sucursal_conceptos FOR SELECT
USING (
  public.current_user_is_super_admin() OR
  tenant_id = public.current_user_tenant()
);

CREATE POLICY "Admins can insert sucursal_conceptos for their tenant"
ON public.sucursal_conceptos FOR INSERT
WITH CHECK (
  public.current_user_is_super_admin() OR
  (public.current_user_is_admin() AND tenant_id = public.current_user_tenant())
);

CREATE POLICY "Admins can update sucursal_conceptos for their tenant"
ON public.sucursal_conceptos FOR UPDATE
USING (
  public.current_user_is_super_admin() OR
  (public.current_user_is_admin() AND tenant_id = public.current_user_tenant())
);

CREATE POLICY "Admins can delete sucursal_conceptos for their tenant"
ON public.sucursal_conceptos FOR DELETE
USING (
  public.current_user_is_super_admin() OR
  (public.current_user_is_admin() AND tenant_id = public.current_user_tenant())
);

-- Trigger para auto-asignar tenant_id
CREATE OR REPLACE FUNCTION public.set_sucursal_conceptos_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    NEW.tenant_id := public.current_user_tenant();
  END IF;
  
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required for sucursal_conceptos';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_sucursal_conceptos_tenant_id_trigger ON public.sucursal_conceptos;
CREATE TRIGGER set_sucursal_conceptos_tenant_id_trigger
BEFORE INSERT ON public.sucursal_conceptos
FOR EACH ROW EXECUTE FUNCTION public.set_sucursal_conceptos_tenant_id();

-- Comentarios
COMMENT ON COLUMN public.tarifas.tipo_tarifa IS 'Tipo de cálculo: codigo_postal, zona, distancia, peso, volumen';
COMMENT ON COLUMN public.tarifas.rangos_precios IS 'Rangos de precios escalonados en formato JSON';
COMMENT ON COLUMN public.tarifa_conceptos.es_basico IS 'true = disponible para todas las sucursales, false = requiere habilitación por sucursal';
COMMENT ON TABLE public.sucursal_conceptos IS 'Controla qué conceptos adicionales tiene habilitados cada sucursal';