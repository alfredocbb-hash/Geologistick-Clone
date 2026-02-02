-- =====================================================
-- MERCADO ENVÍOS FLEX INTEGRATION
-- =====================================================

-- 1. Add MercadoLibre columns to envios table
ALTER TABLE public.envios
ADD COLUMN IF NOT EXISTS ml_shipment_id bigint,
ADD COLUMN IF NOT EXISTS ml_order_id bigint,
ADD COLUMN IF NOT EXISTS ml_sync_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS ml_last_sync_at timestamptz;

-- Create index for fast ML shipment lookup
CREATE INDEX IF NOT EXISTS idx_envios_ml_shipment_id ON public.envios(ml_shipment_id) WHERE ml_shipment_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.envios.ml_shipment_id IS 'MercadoLibre shipment ID for Flex integration';
COMMENT ON COLUMN public.envios.ml_order_id IS 'MercadoLibre order ID';
COMMENT ON COLUMN public.envios.ml_sync_status IS 'Sync status: pending, synced, error';
COMMENT ON COLUMN public.envios.ml_last_sync_at IS 'Last sync timestamp with ML API';

-- 2. Create ML status mapping table
CREATE TABLE IF NOT EXISTS public.ml_status_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estado_interno text NOT NULL,
  ml_status text NOT NULL,
  ml_substatus text,
  descripcion text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(estado_interno)
);

-- Enable RLS
ALTER TABLE public.ml_status_mapping ENABLE ROW LEVEL SECURITY;

-- RLS policies for ml_status_mapping (read-only for most users)
CREATE POLICY "Anyone can view ML status mapping"
ON public.ml_status_mapping
FOR SELECT
USING (true);

CREATE POLICY "Only super admins can manage ML status mapping"
ON public.ml_status_mapping
FOR ALL
USING (is_super_admin(auth.uid()));

-- Insert default status mappings
INSERT INTO public.ml_status_mapping (estado_interno, ml_status, ml_substatus, descripcion)
VALUES 
  ('pendiente', 'ready_to_ship', NULL, 'Pendiente de pickup'),
  ('recogido', 'shipped', 'picked_up', 'Recogido por el chofer'),
  ('en_bodega', 'shipped', 'picked_up', 'En centro de distribución'),
  ('en_transito', 'shipped', 'in_transit', 'En tránsito entre sucursales'),
  ('en_reparto', 'shipped', 'out_for_delivery', 'Salió a reparto'),
  ('entregado', 'delivered', NULL, 'Entregado al destinatario'),
  ('no_entregado', 'not_delivered', 'receiver_absent', 'No se pudo entregar'),
  ('cancelado', 'cancelled', NULL, 'Envío cancelado'),
  ('devuelto', 'returned', NULL, 'Devuelto al remitente')
ON CONFLICT (estado_interno) DO NOTHING;

-- 3. Add trigger to auto-sync ML status on envio state change
CREATE OR REPLACE FUNCTION public.notify_ml_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for ML shipments
  IF NEW.ml_shipment_id IS NOT NULL AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    -- Mark as pending sync
    NEW.ml_sync_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_ml_status_change ON public.envios;
CREATE TRIGGER trigger_notify_ml_status_change
  BEFORE UPDATE ON public.envios
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ml_status_change();