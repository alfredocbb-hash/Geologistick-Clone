-- Create liquidaciones_seller table
CREATE TABLE public.liquidaciones_seller (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES ecommerce_sellers(id) ON DELETE CASCADE NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  total_cargos NUMERIC DEFAULT 0,
  total_pagos NUMERIC DEFAULT 0,
  saldo_periodo NUMERIC DEFAULT 0,
  saldo_anterior NUMERIC DEFAULT 0,
  saldo_final NUMERIC DEFAULT 0,
  cantidad_movimientos INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'generada',
  notas TEXT,
  metodo_pago TEXT,
  referencia_pago TEXT,
  fecha_pago TIMESTAMPTZ,
  generado_por UUID REFERENCES auth.users(id),
  aprobado_por UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add liquidacion_id column to seller_cuenta_corriente
ALTER TABLE public.seller_cuenta_corriente 
ADD COLUMN IF NOT EXISTS liquidacion_id UUID REFERENCES liquidaciones_seller(id);

-- Enable RLS
ALTER TABLE public.liquidaciones_seller ENABLE ROW LEVEL SECURITY;

-- RLS Policies for liquidaciones_seller
CREATE POLICY "Ver liquidaciones seller" ON public.liquidaciones_seller
FOR SELECT USING (
  tenant_id = current_user_tenant() 
  OR is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM ecommerce_sellers es WHERE es.id = seller_id AND es.user_id = auth.uid())
);

CREATE POLICY "Crear liquidaciones seller" ON public.liquidaciones_seller
FOR INSERT WITH CHECK (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Actualizar liquidaciones seller" ON public.liquidaciones_seller
FOR UPDATE USING (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Eliminar liquidaciones seller" ON public.liquidaciones_seller
FOR DELETE USING (
  (is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role))
  AND estado <> 'pagada'
  AND tenant_id = current_user_tenant()
);

-- Add UPDATE policy for seller_cuenta_corriente to allow linking to liquidaciones
CREATE POLICY "Actualizar movimientos para liquidacion" ON public.seller_cuenta_corriente
FOR UPDATE USING (
  is_admin(auth.uid()) OR has_role(auth.uid(), 'supervisor'::app_role)
);