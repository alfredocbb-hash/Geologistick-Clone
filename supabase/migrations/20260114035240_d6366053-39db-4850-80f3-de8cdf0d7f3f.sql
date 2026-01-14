-- Add fiscal fields to clientes table
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS razon_social TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS condicion_iva TEXT DEFAULT 'consumidor_final';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo_contribuyente TEXT DEFAULT 'persona_fisica';

-- Create facturas table for complete invoice records
CREATE TABLE public.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id UUID REFERENCES public.envios(id),
  
  -- Invoice data
  tipo_comprobante TEXT NOT NULL CHECK (tipo_comprobante IN ('A', 'B', 'C')),
  punto_venta INTEGER NOT NULL,
  numero_comprobante BIGINT NOT NULL,
  fecha_emision TIMESTAMPTZ DEFAULT now(),
  
  -- ARCA data
  cae TEXT,
  cae_vencimiento DATE,
  
  -- Receptor data
  receptor_cuit TEXT,
  receptor_nombre TEXT,
  receptor_condicion_iva TEXT,
  receptor_domicilio TEXT,
  
  -- Amounts
  importe_neto DECIMAL(12,2) NOT NULL,
  importe_iva DECIMAL(12,2) DEFAULT 0,
  importe_total DECIMAL(12,2) NOT NULL,
  
  -- Status
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'emitida', 'rechazada', 'anulada')),
  error_mensaje TEXT,
  
  -- Metadata
  arca_response JSONB,
  pdf_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_facturas_envio ON public.facturas(envio_id);
CREATE INDEX idx_facturas_cae ON public.facturas(cae);
CREATE INDEX idx_facturas_estado ON public.facturas(estado);
CREATE INDEX idx_facturas_fecha ON public.facturas(fecha_emision);

-- RLS for facturas
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view facturas"
  ON public.facturas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert facturas"
  ON public.facturas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update facturas"
  ON public.facturas FOR UPDATE TO authenticated USING (true);

-- Create arca_config table for contributor configuration
CREATE TABLE public.arca_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contributor data
  cuit TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  condicion_iva TEXT NOT NULL CHECK (condicion_iva IN ('responsable_inscripto', 'monotributo', 'exento')),
  domicilio_comercial TEXT,
  
  -- Electronic point of sale
  punto_venta INTEGER NOT NULL,
  
  -- Start of activities
  inicio_actividades DATE,
  
  -- Enabled invoice types
  factura_a_habilitada BOOLEAN DEFAULT true,
  factura_b_habilitada BOOLEAN DEFAULT true,
  factura_c_habilitada BOOLEAN DEFAULT false,
  
  -- Last numbering used (updated automatically)
  ultimo_numero_a BIGINT DEFAULT 0,
  ultimo_numero_b BIGINT DEFAULT 0,
  ultimo_numero_c BIGINT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  environment TEXT DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only one active config per environment
CREATE UNIQUE INDEX idx_arca_config_active 
  ON public.arca_config(environment) 
  WHERE is_active = true;

-- RLS for arca_config
ALTER TABLE public.arca_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view arca_config"
  ON public.arca_config FOR SELECT TO authenticated 
  USING (current_user_is_admin());

CREATE POLICY "Only admins can insert arca_config"
  ON public.arca_config FOR INSERT TO authenticated 
  WITH CHECK (current_user_is_admin());

CREATE POLICY "Only admins can update arca_config"
  ON public.arca_config FOR UPDATE TO authenticated 
  USING (current_user_is_admin());

CREATE POLICY "Only admins can delete arca_config"
  ON public.arca_config FOR DELETE TO authenticated 
  USING (current_user_is_admin());

-- Add arca to integration_type enum
ALTER TYPE public.integration_type ADD VALUE IF NOT EXISTS 'arca';

-- Trigger for updated_at on arca_config
CREATE TRIGGER update_arca_config_updated_at
  BEFORE UPDATE ON public.arca_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();