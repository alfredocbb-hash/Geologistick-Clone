-- =============================================
-- SISTEMA DE LIQUIDACIONES COMPLETO
-- =============================================

-- 1. Conceptos dinámicos para tarifas (flete, seguro, embalaje, etc.)
CREATE TABLE public.tarifa_conceptos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tarifa_conceptos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tarifa_conceptos
CREATE POLICY "Todos pueden ver conceptos activos"
ON public.tarifa_conceptos FOR SELECT
USING (true);

CREATE POLICY "Solo admin puede gestionar conceptos"
ON public.tarifa_conceptos FOR ALL
USING (public.is_admin(auth.uid()));

-- 2. Precios de cada concepto por tarifa
CREATE TABLE public.tarifa_concepto_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarifa_id UUID REFERENCES public.tarifas(id) ON DELETE CASCADE NOT NULL,
  concepto_id UUID REFERENCES public.tarifa_conceptos(id) ON DELETE CASCADE NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tarifa_id, concepto_id)
);

-- Enable RLS
ALTER TABLE public.tarifa_concepto_precios ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Todos pueden ver precios de conceptos"
ON public.tarifa_concepto_precios FOR SELECT
USING (true);

CREATE POLICY "Solo admin puede gestionar precios"
ON public.tarifa_concepto_precios FOR ALL
USING (public.is_admin(auth.uid()));

-- 3. Comisiones por sucursal (% por concepto y tipo de pago)
CREATE TABLE public.sucursal_comisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE CASCADE NOT NULL,
  concepto_id UUID REFERENCES public.tarifa_conceptos(id) ON DELETE CASCADE NOT NULL,
  porcentaje_contado NUMERIC DEFAULT 0 CHECK (porcentaje_contado >= 0 AND porcentaje_contado <= 100),
  porcentaje_destino NUMERIC DEFAULT 0 CHECK (porcentaje_destino >= 0 AND porcentaje_destino <= 100),
  porcentaje_cta_cte NUMERIC DEFAULT 0 CHECK (porcentaje_cta_cte >= 0 AND porcentaje_cta_cte <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sucursal_id, concepto_id)
);

-- Enable RLS
ALTER TABLE public.sucursal_comisiones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Ver comisiones de sucursal"
ON public.sucursal_comisiones FOR SELECT
USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor') OR sucursal_id = public.get_user_sucursal(auth.uid()));

CREATE POLICY "Solo admin puede gestionar comisiones"
ON public.sucursal_comisiones FOR ALL
USING (public.is_admin(auth.uid()));

-- 4. Desglose de envío por concepto
CREATE TABLE public.envio_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_id UUID REFERENCES public.envios(id) ON DELETE CASCADE NOT NULL,
  concepto_id UUID REFERENCES public.tarifa_conceptos(id),
  nombre_concepto TEXT NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.envio_detalles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Ver detalles de envío"
ON public.envio_detalles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.envios e 
    WHERE e.id = envio_detalles.envio_id 
    AND (
      public.is_admin(auth.uid()) 
      OR e.sucursal_origen_id = public.get_user_sucursal(auth.uid())
      OR e.sucursal_destino_id = public.get_user_sucursal(auth.uid())
      OR e.chofer_id = auth.uid()
      OR e.created_by = auth.uid()
    )
  )
);

CREATE POLICY "Crear detalles de envío"
ON public.envio_detalles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.envios e 
    WHERE e.id = envio_detalles.envio_id 
    AND (
      public.is_admin(auth.uid()) 
      OR public.has_role(auth.uid(), 'operador')
      OR public.has_role(auth.uid(), 'atencion_cliente')
      OR e.sucursal_origen_id = public.get_user_sucursal(auth.uid())
    )
  )
);

-- 5. Liquidaciones de sucursales
CREATE TABLE public.liquidaciones_sucursal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID REFERENCES public.sucursales(id) NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  total_cobrado NUMERIC DEFAULT 0,
  total_comisiones NUMERIC DEFAULT 0,
  saldo NUMERIC DEFAULT 0,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'pagada', 'rechazada')),
  notas TEXT,
  created_by UUID,
  aprobado_por UUID,
  fecha_pago TIMESTAMPTZ,
  metodo_pago payment_method,
  referencia_pago TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.liquidaciones_sucursal ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Ver liquidaciones de sucursal"
ON public.liquidaciones_sucursal FOR SELECT
USING (
  public.is_admin(auth.uid()) 
  OR public.has_role(auth.uid(), 'supervisor')
  OR sucursal_id = public.get_user_sucursal(auth.uid())
);

CREATE POLICY "Crear liquidaciones de sucursal"
ON public.liquidaciones_sucursal FOR INSERT
WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Actualizar liquidaciones de sucursal"
ON public.liquidaciones_sucursal FOR UPDATE
USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor'));

-- 6. Detalle de liquidación sucursal
CREATE TABLE public.liquidacion_sucursal_detalles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id UUID REFERENCES public.liquidaciones_sucursal(id) ON DELETE CASCADE NOT NULL,
  envio_id UUID REFERENCES public.envios(id) NOT NULL,
  tipo_pago TEXT NOT NULL,
  monto_envio NUMERIC NOT NULL,
  comision_aplicada NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.liquidacion_sucursal_detalles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Ver detalles de liquidación"
ON public.liquidacion_sucursal_detalles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.liquidaciones_sucursal ls
    WHERE ls.id = liquidacion_sucursal_detalles.liquidacion_id
    AND (
      public.is_admin(auth.uid())
      OR public.has_role(auth.uid(), 'supervisor')
      OR ls.sucursal_id = public.get_user_sucursal(auth.uid())
    )
  )
);

CREATE POLICY "Crear detalles de liquidación"
ON public.liquidacion_sucursal_detalles FOR INSERT
WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor'));

-- 7. Cuenta corriente de clientes (movimientos)
CREATE TABLE public.cliente_cuenta_corriente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  envio_id UUID REFERENCES public.envios(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('cargo', 'pago')),
  monto NUMERIC NOT NULL,
  saldo_anterior NUMERIC NOT NULL DEFAULT 0,
  saldo_nuevo NUMERIC NOT NULL DEFAULT 0,
  descripcion TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cliente_cuenta_corriente ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Ver cuenta corriente"
ON public.cliente_cuenta_corriente FOR SELECT
USING (
  public.is_admin(auth.uid()) 
  OR public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'atencion_cliente')
  OR EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = cliente_cuenta_corriente.cliente_id 
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Crear movimiento cuenta corriente"
ON public.cliente_cuenta_corriente FOR INSERT
WITH CHECK (
  public.is_admin(auth.uid()) 
  OR public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'atencion_cliente')
  OR public.has_role(auth.uid(), 'operador')
);

-- 8. Liquidaciones de clientes
CREATE TABLE public.liquidaciones_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  saldo_anterior NUMERIC DEFAULT 0,
  total_cargos NUMERIC DEFAULT 0,
  total_pagos NUMERIC DEFAULT 0,
  saldo_final NUMERIC DEFAULT 0,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviada', 'pagada')),
  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.liquidaciones_cliente ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Ver liquidaciones de cliente"
ON public.liquidaciones_cliente FOR SELECT
USING (
  public.is_admin(auth.uid()) 
  OR public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'atencion_cliente')
  OR EXISTS (
    SELECT 1 FROM public.clientes c 
    WHERE c.id = liquidaciones_cliente.cliente_id 
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Crear liquidación de cliente"
ON public.liquidaciones_cliente FOR INSERT
WITH CHECK (
  public.is_admin(auth.uid()) 
  OR public.has_role(auth.uid(), 'supervisor')
  OR public.has_role(auth.uid(), 'atencion_cliente')
);

CREATE POLICY "Actualizar liquidación de cliente"
ON public.liquidaciones_cliente FOR UPDATE
USING (
  public.is_admin(auth.uid()) 
  OR public.has_role(auth.uid(), 'supervisor')
);

-- 9. Modificar tabla envios - agregar tipo_pago
ALTER TABLE public.envios 
ADD COLUMN tipo_pago TEXT DEFAULT 'contado' CHECK (tipo_pago IN ('contado', 'destino', 'cuenta_corriente'));

-- 10. Modificar tabla clientes - agregar campos cuenta corriente
ALTER TABLE public.clientes
ADD COLUMN tiene_cuenta_corriente BOOLEAN DEFAULT false,
ADD COLUMN limite_credito NUMERIC DEFAULT 0,
ADD COLUMN saldo_cuenta_corriente NUMERIC DEFAULT 0;

-- 11. Trigger para actualizar updated_at
CREATE TRIGGER update_tarifa_conceptos_updated_at
BEFORE UPDATE ON public.tarifa_conceptos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sucursal_comisiones_updated_at
BEFORE UPDATE ON public.sucursal_comisiones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_liquidaciones_sucursal_updated_at
BEFORE UPDATE ON public.liquidaciones_sucursal
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_liquidaciones_cliente_updated_at
BEFORE UPDATE ON public.liquidaciones_cliente
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Insertar conceptos básicos por defecto
INSERT INTO public.tarifa_conceptos (nombre, codigo, descripcion, orden) VALUES
('Flete', 'flete', 'Costo de transporte', 1),
('Seguro', 'seguro', 'Seguro de mercadería', 2),
('Embalaje', 'embalaje', 'Servicio de embalaje', 3);