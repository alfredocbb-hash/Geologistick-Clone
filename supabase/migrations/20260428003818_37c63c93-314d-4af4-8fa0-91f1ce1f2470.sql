-- Add fields for credit notes (NC) and invoice voiding
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS factura_origen_id UUID REFERENCES public.facturas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_nota_credito TEXT,
  ADD COLUMN IF NOT EXISTS es_nota_credito BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anulada_por UUID,
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

CREATE INDEX IF NOT EXISTS idx_facturas_origen ON public.facturas(factura_origen_id);
CREATE INDEX IF NOT EXISTS idx_facturas_es_nc ON public.facturas(es_nota_credito) WHERE es_nota_credito = true;