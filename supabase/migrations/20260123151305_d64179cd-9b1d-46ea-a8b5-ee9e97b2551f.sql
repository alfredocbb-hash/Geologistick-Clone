-- Tabla principal de empresas terciarizadas
CREATE TABLE public.empresas_terciarizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  razon_social TEXT,
  cuit TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  ciudad TEXT,
  provincia TEXT,
  codigo_postal TEXT,
  notas TEXT,
  tiene_cuenta_corriente BOOLEAN DEFAULT false,
  limite_credito NUMERIC DEFAULT 0,
  saldo_cuenta_corriente NUMERIC DEFAULT 0,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Historial de movimientos de cuenta corriente
CREATE TABLE public.terciarizado_cuenta_corriente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas_terciarizadas(id) ON DELETE CASCADE NOT NULL,
  envio_id UUID REFERENCES public.envios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('cargo', 'pago', 'ajuste')),
  monto NUMERIC NOT NULL,
  saldo_anterior NUMERIC NOT NULL DEFAULT 0,
  saldo_nuevo NUMERIC NOT NULL DEFAULT 0,
  descripcion TEXT,
  referencia TEXT,
  metodo_pago TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Modificar tabla envios para referenciar empresa terciarizada
ALTER TABLE public.envios
ADD COLUMN empresa_terciarizada_id UUID REFERENCES public.empresas_terciarizadas(id);

-- Índices
CREATE INDEX idx_empresas_terciarizadas_tenant ON public.empresas_terciarizadas(tenant_id);
CREATE INDEX idx_empresas_terciarizadas_codigo ON public.empresas_terciarizadas(codigo);
CREATE INDEX idx_terciarizado_cta_cte_empresa ON public.terciarizado_cuenta_corriente(empresa_id);

-- RLS Policies
ALTER TABLE public.empresas_terciarizadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terciarizado_cuenta_corriente ENABLE ROW LEVEL SECURITY;

-- Políticas para empresas_terciarizadas
CREATE POLICY "Ver empresas terciarizadas de su tenant"
  ON public.empresas_terciarizadas FOR SELECT
  USING (tenant_id = current_user_tenant() OR is_super_admin(auth.uid()));

CREATE POLICY "Crear empresas terciarizadas"
  ON public.empresas_terciarizadas FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Actualizar empresas terciarizadas"
  ON public.empresas_terciarizadas FOR UPDATE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Eliminar empresas terciarizadas"
  ON public.empresas_terciarizadas FOR DELETE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role));

-- Políticas para cuenta corriente
CREATE POLICY "Ver cuenta corriente terciarizados"
  ON public.terciarizado_cuenta_corriente FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM empresas_terciarizadas e
    WHERE e.id = terciarizado_cuenta_corriente.empresa_id
    AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
  ));

CREATE POLICY "Gestionar cuenta corriente terciarizados"
  ON public.terciarizado_cuenta_corriente FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role));