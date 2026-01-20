-- Parte 1: Actualizar RLS para que solo admin/chofer puedan cambiar estados

-- Política restrictiva para envio_historial (INSERT)
DROP POLICY IF EXISTS "Insertar historial" ON envio_historial;
CREATE POLICY "Insertar historial" ON envio_historial
FOR INSERT TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR 
  (has_role(auth.uid(), 'chofer') AND EXISTS (
    SELECT 1 FROM envios e WHERE e.id = envio_historial.envio_id AND e.chofer_id = auth.uid()
  ))
);

-- Política restrictiva para actualizar envíos
DROP POLICY IF EXISTS "Actualizar envíos de su tenant" ON envios;
CREATE POLICY "Actualizar envíos de su tenant" ON envios
FOR UPDATE TO authenticated
USING (
  (tenant_id = current_user_tenant() AND (
    is_admin(auth.uid()) OR 
    chofer_id = auth.uid()
  )) OR is_super_admin(auth.uid())
);

-- Parte 2: Reabrir ruta del chofer Lucas
UPDATE rutas_planificadas 
SET estado = 'en_curso', updated_at = now()
WHERE id = '7b0f3508-55ee-4bac-b283-7b6bfa7a43b6';

-- Parte 3: Crear tabla de historial de ubicaciones para trazabilidad
CREATE TABLE IF NOT EXISTS driver_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chofer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ruta_id UUID REFERENCES rutas_planificadas(id) ON DELETE SET NULL,
  hoja_ruta_id UUID REFERENCES hojas_ruta(id) ON DELETE SET NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  accuracy NUMERIC,
  speed NUMERIC,
  heading NUMERIC,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_location_history_chofer_date 
ON driver_location_history(chofer_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_history_ruta 
ON driver_location_history(ruta_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_location_history_hoja 
ON driver_location_history(hoja_ruta_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_location_history_tenant 
ON driver_location_history(tenant_id, recorded_at DESC);

-- Habilitar RLS
ALTER TABLE driver_location_history ENABLE ROW LEVEL SECURITY;

-- Política para ver historial de ubicaciones de su tenant
CREATE POLICY "Ver historial de ubicaciones de su tenant"
ON driver_location_history FOR SELECT TO authenticated
USING (tenant_id = current_user_tenant() OR is_super_admin(auth.uid()));

-- Política para que el chofer inserte su propia ubicación
CREATE POLICY "Chofer inserta su ubicación"
ON driver_location_history FOR INSERT TO authenticated
WITH CHECK (chofer_id = auth.uid());

-- Habilitar realtime para la tabla
ALTER PUBLICATION supabase_realtime ADD TABLE driver_location_history;