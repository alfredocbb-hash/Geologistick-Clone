
-- Add AFIP-standard columns to facturas
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS concepto smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fecha_servicio_desde date,
  ADD COLUMN IF NOT EXISTS fecha_servicio_hasta date,
  ADD COLUMN IF NOT EXISTS fecha_vto_pago date,
  ADD COLUMN IF NOT EXISTS importe_no_gravado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importe_exento numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importe_tributos numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS tipo_documento smallint NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS condicion_venta text;

-- Create factura_detalles table for line items
CREATE TABLE IF NOT EXISTS public.factura_detalles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id uuid NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  codigo text,
  descripcion text NOT NULL,
  cantidad numeric NOT NULL DEFAULT 1,
  unidad_medida text NOT NULL DEFAULT 'unidades',
  precio_unitario numeric NOT NULL DEFAULT 0,
  bonificacion_pct numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  alicuota_iva numeric NOT NULL DEFAULT 21,
  subtotal_con_iva numeric NOT NULL DEFAULT 0,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.factura_detalles ENABLE ROW LEVEL SECURITY;

-- RLS policies for factura_detalles
CREATE POLICY "Users can view their tenant factura_detalles"
  ON public.factura_detalles FOR SELECT TO authenticated
  USING (tenant_id = public.current_user_tenant());

CREATE POLICY "Users can insert their tenant factura_detalles"
  ON public.factura_detalles FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_user_tenant());

CREATE POLICY "Users can update their tenant factura_detalles"
  ON public.factura_detalles FOR UPDATE TO authenticated
  USING (tenant_id = public.current_user_tenant());

CREATE POLICY "Users can delete their tenant factura_detalles"
  ON public.factura_detalles FOR DELETE TO authenticated
  USING (tenant_id = public.current_user_tenant());

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_factura_detalles_factura_id ON public.factura_detalles(factura_id);
CREATE INDEX IF NOT EXISTS idx_factura_detalles_tenant_id ON public.factura_detalles(tenant_id);
