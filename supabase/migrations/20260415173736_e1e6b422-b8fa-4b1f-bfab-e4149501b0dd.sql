
CREATE TABLE public.gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  proveedor TEXT NOT NULL,
  cuit_proveedor TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  importe_neto NUMERIC NOT NULL DEFAULT 0,
  iva NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  categoria TEXT NOT NULL DEFAULT 'otros',
  descripcion TEXT,
  numero_comprobante TEXT,
  tipo_comprobante TEXT DEFAULT 'factura_b',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view gastos of their tenant"
ON public.gastos FOR SELECT TO authenticated
USING (tenant_id = public.current_user_tenant());

CREATE POLICY "Users can create gastos in their tenant"
ON public.gastos FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.current_user_tenant());

CREATE POLICY "Users can update gastos of their tenant"
ON public.gastos FOR UPDATE TO authenticated
USING (tenant_id = public.current_user_tenant());

CREATE POLICY "Users can delete gastos of their tenant"
ON public.gastos FOR DELETE TO authenticated
USING (tenant_id = public.current_user_tenant());

CREATE TRIGGER update_gastos_updated_at
BEFORE UPDATE ON public.gastos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
