
CREATE TABLE public.facturas_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  proveedor_nombre TEXT NOT NULL,
  proveedor_cuit TEXT,
  tipo_comprobante TEXT NOT NULL DEFAULT 'B',
  punto_venta INT,
  numero_comprobante INT,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  importe_neto NUMERIC(12,2) DEFAULT 0,
  importe_iva NUMERIC(12,2) DEFAULT 0,
  importe_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  categoria TEXT,
  notas TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.facturas_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant purchase invoices"
ON public.facturas_compra FOR SELECT
TO authenticated
USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can create purchase invoices for their tenant"
ON public.facturas_compra FOR INSERT
TO authenticated
WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update their tenant purchase invoices"
ON public.facturas_compra FOR UPDATE
TO authenticated
USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can delete their tenant purchase invoices"
ON public.facturas_compra FOR DELETE
TO authenticated
USING (public.user_belongs_to_tenant(tenant_id));

CREATE TRIGGER update_facturas_compra_updated_at
BEFORE UPDATE ON public.facturas_compra
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
