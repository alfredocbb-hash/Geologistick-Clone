
-- 1. Add liquidacion_seller_id to envios
ALTER TABLE public.envios ADD COLUMN liquidacion_seller_id UUID REFERENCES public.liquidaciones_seller(id);

-- 2. Add liquidacion_seller_id to facturas
ALTER TABLE public.facturas ADD COLUMN liquidacion_seller_id UUID REFERENCES public.liquidaciones_seller(id);

-- 3. Add factura_id to liquidaciones_seller
ALTER TABLE public.liquidaciones_seller ADD COLUMN factura_id UUID REFERENCES public.facturas(id);

-- 4. Create indexes
CREATE INDEX idx_envios_liquidacion_seller_id ON public.envios(liquidacion_seller_id);
CREATE INDEX idx_facturas_liquidacion_seller_id ON public.facturas(liquidacion_seller_id);
