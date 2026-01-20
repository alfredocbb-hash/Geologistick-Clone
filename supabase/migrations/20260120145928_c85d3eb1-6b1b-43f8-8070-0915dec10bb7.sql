-- Tabla para almacenar plantillas de rutas frecuentes
CREATE TABLE public.rutas_frecuentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  sucursal_id UUID REFERENCES sucursales(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla para almacenar las paradas de cada ruta frecuente
CREATE TABLE public.ruta_frecuente_paradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruta_frecuente_id UUID NOT NULL REFERENCES rutas_frecuentes(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  orden INTEGER NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'retiro',
  direccion TEXT,
  ciudad TEXT,
  lat DECIMAL,
  lng DECIMAL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.rutas_frecuentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ruta_frecuente_paradas ENABLE ROW LEVEL SECURITY;

-- Políticas para rutas_frecuentes
CREATE POLICY "Ver rutas frecuentes de su tenant"
  ON public.rutas_frecuentes FOR SELECT
  USING (tenant_id = current_user_tenant());

CREATE POLICY "Crear rutas frecuentes en su tenant"
  ON public.rutas_frecuentes FOR INSERT
  WITH CHECK (
    tenant_id = current_user_tenant() AND 
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
  );

CREATE POLICY "Actualizar rutas frecuentes de su tenant"
  ON public.rutas_frecuentes FOR UPDATE
  USING (
    tenant_id = current_user_tenant() AND 
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
  );

CREATE POLICY "Eliminar rutas frecuentes de su tenant"
  ON public.rutas_frecuentes FOR DELETE
  USING (
    tenant_id = current_user_tenant() AND 
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
  );

-- Políticas para ruta_frecuente_paradas (acceso via ruta padre)
CREATE POLICY "Ver paradas de rutas frecuentes"
  ON public.ruta_frecuente_paradas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rutas_frecuentes rf 
      WHERE rf.id = ruta_frecuente_paradas.ruta_frecuente_id 
      AND rf.tenant_id = current_user_tenant()
    )
  );

CREATE POLICY "Gestionar paradas de rutas frecuentes"
  ON public.ruta_frecuente_paradas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rutas_frecuentes rf 
      WHERE rf.id = ruta_frecuente_paradas.ruta_frecuente_id 
      AND rf.tenant_id = current_user_tenant()
      AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_rutas_frecuentes_updated_at
  BEFORE UPDATE ON public.rutas_frecuentes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();