
-- 1. Add IVA columns to empresas_terciarizadas
ALTER TABLE public.empresas_terciarizadas
  ADD COLUMN IF NOT EXISTS incluye_iva boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS porcentaje_iva numeric DEFAULT 21;

-- 2. Create liquidaciones_terciarizado table
CREATE TABLE public.liquidaciones_terciarizado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas_terciarizadas(id),
  periodo_inicio date NOT NULL,
  periodo_fin date NOT NULL,
  monto_total numeric NOT NULL DEFAULT 0,
  monto_iva numeric NOT NULL DEFAULT 0,
  monto_neto numeric NOT NULL DEFAULT 0,
  cantidad_envios integer NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'generada',
  notas text,
  metodo_pago text,
  referencia_pago text,
  fecha_pago timestamptz,
  generado_por uuid,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create liquidacion_terciarizado_detalles table
CREATE TABLE public.liquidacion_terciarizado_detalles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id uuid NOT NULL REFERENCES public.liquidaciones_terciarizado(id) ON DELETE CASCADE,
  envio_id uuid NOT NULL REFERENCES public.envios(id),
  monto numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.liquidaciones_terciarizado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidacion_terciarizado_detalles ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for liquidaciones_terciarizado
CREATE POLICY "Ver liquidaciones terciarizado"
  ON public.liquidaciones_terciarizado FOR SELECT
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Crear liquidaciones terciarizado"
  ON public.liquidaciones_terciarizado FOR INSERT
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Actualizar liquidaciones terciarizado"
  ON public.liquidaciones_terciarizado FOR UPDATE
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Eliminar liquidaciones terciarizado no pagadas"
  ON public.liquidaciones_terciarizado FOR DELETE
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
    AND estado <> 'pagada'
    AND tenant_id = current_user_tenant()
  );

-- 6. RLS policies for liquidacion_terciarizado_detalles
CREATE POLICY "Ver detalles liquidacion terciarizado"
  ON public.liquidacion_terciarizado_detalles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.liquidaciones_terciarizado l
      WHERE l.id = liquidacion_terciarizado_detalles.liquidacion_id
      AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
    )
  );

CREATE POLICY "Crear detalles liquidacion terciarizado"
  ON public.liquidacion_terciarizado_detalles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.liquidaciones_terciarizado l
      WHERE l.id = liquidacion_terciarizado_detalles.liquidacion_id
      AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
    )
  );
