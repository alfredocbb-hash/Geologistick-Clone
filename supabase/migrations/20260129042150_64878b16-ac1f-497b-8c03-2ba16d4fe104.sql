-- =====================================================
-- Sistema Avanzado de Tarifas: Rangos, Seguro y Ajustes
-- =====================================================

-- 1. Agregar nuevos campos a tabla tarifas
ALTER TABLE public.tarifas 
ADD COLUMN IF NOT EXISTS rangos_kg jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS umbral_volumen_cm integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS precio_minimo_flete numeric DEFAULT 0;

-- 2. Agregar campos de dimensiones separadas a envios
ALTER TABLE public.envios
ADD COLUMN IF NOT EXISTS alto_cm numeric,
ADD COLUMN IF NOT EXISTS ancho_cm numeric,
ADD COLUMN IF NOT EXISTS largo_cm numeric,
ADD COLUMN IF NOT EXISTS volumen_m3 numeric,
ADD COLUMN IF NOT EXISTS tarifa_metodo_aplicado text;

-- 3. Crear tabla de configuración de seguro por tenant
CREATE TABLE IF NOT EXISTS public.configuracion_seguro (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  valor_minimo_declarado numeric NOT NULL DEFAULT 40000,
  seguro_base numeric NOT NULL DEFAULT 2400,
  porcentaje_excedente numeric NOT NULL DEFAULT 6,
  valor_maximo_asegurado numeric NOT NULL DEFAULT 500000,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(tenant_id)
);

-- 4. Crear tabla de historial de ajustes de tarifas
CREATE TABLE IF NOT EXISTS public.historial_ajustes_tarifas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  porcentaje_aplicado numeric NOT NULL,
  tarifas_afectadas jsonb DEFAULT '[]'::jsonb,
  conceptos_afectados jsonb DEFAULT '[]'::jsonb,
  opciones_aplicadas jsonb DEFAULT '{}'::jsonb,
  aplicado_por uuid,
  created_at timestamp with time zone DEFAULT now(),
  notas text
);

-- 5. Habilitar RLS en las nuevas tablas
ALTER TABLE public.configuracion_seguro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_ajustes_tarifas ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para configuracion_seguro
CREATE POLICY "Ver configuración de seguro de su tenant"
ON public.configuracion_seguro FOR SELECT
USING (tenant_id = current_user_tenant() OR is_super_admin(auth.uid()));

CREATE POLICY "Gestionar configuración de seguro"
ON public.configuracion_seguro FOR ALL
USING ((tenant_id = current_user_tenant() AND is_admin(auth.uid())) OR is_super_admin(auth.uid()));

-- 7. Políticas RLS para historial_ajustes_tarifas
CREATE POLICY "Ver historial de ajustes de su tenant"
ON public.historial_ajustes_tarifas FOR SELECT
USING (tenant_id = current_user_tenant() OR is_super_admin(auth.uid()));

CREATE POLICY "Crear historial de ajustes"
ON public.historial_ajustes_tarifas FOR INSERT
WITH CHECK ((tenant_id = current_user_tenant() AND is_admin(auth.uid())) OR is_super_admin(auth.uid()));

-- 8. Función para actualizar conceptos por porcentaje
CREATE OR REPLACE FUNCTION public.actualizar_conceptos_porcentaje(
  p_factor numeric,
  p_tarifa_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tarifa_conceptos
  SET 
    monto = ROUND(monto * p_factor, 2),
    updated_at = now()
  WHERE tarifa_id = ANY(p_tarifa_ids);
END;
$$;

-- 9. Trigger para actualizar updated_at en configuracion_seguro
CREATE OR REPLACE FUNCTION public.update_configuracion_seguro_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_configuracion_seguro_timestamp ON public.configuracion_seguro;
CREATE TRIGGER update_configuracion_seguro_timestamp
BEFORE UPDATE ON public.configuracion_seguro
FOR EACH ROW
EXECUTE FUNCTION public.update_configuracion_seguro_updated_at();

-- 10. Comentarios para documentación
COMMENT ON TABLE public.configuracion_seguro IS 'Configuración de seguro por tenant con mínimos, máximos y porcentajes';
COMMENT ON TABLE public.historial_ajustes_tarifas IS 'Registro histórico de ajustes masivos de tarifas';
COMMENT ON COLUMN public.tarifas.rangos_kg IS 'Array JSON de rangos de peso: [{desde, hasta, precio}]';
COMMENT ON COLUMN public.tarifas.umbral_volumen_cm IS 'Dimensión mínima para aplicar tarifa por volumen';
COMMENT ON COLUMN public.envios.tarifa_metodo_aplicado IS 'Método usado para calcular: peso o volumen';