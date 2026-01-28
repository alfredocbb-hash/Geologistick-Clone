-- Fase 1: Agregar campos para múltiples opciones de envío a ecommerce_sellers
ALTER TABLE public.ecommerce_sellers
ADD COLUMN IF NOT EXISTS tarifa_express_id UUID REFERENCES public.tarifas(id),
ADD COLUMN IF NOT EXISTS express_delivery_days INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS express_surcharge NUMERIC DEFAULT 0;

-- Fase 2: Agregar campos para pickup a ecommerce_sellers
ALTER TABLE public.ecommerce_sellers
ADD COLUMN IF NOT EXISTS permite_pickup BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pickup_surcharge NUMERIC DEFAULT 0;

-- Agregar campo a sucursales para habilitar retiro de clientes
ALTER TABLE public.sucursales
ADD COLUMN IF NOT EXISTS permite_retiro_clientes BOOLEAN DEFAULT false;

-- Comentarios descriptivos
COMMENT ON COLUMN public.ecommerce_sellers.tarifa_express_id IS 'Tarifa para envío express (opcional)';
COMMENT ON COLUMN public.ecommerce_sellers.express_delivery_days IS 'Días de entrega para envío express';
COMMENT ON COLUMN public.ecommerce_sellers.express_surcharge IS 'Recargo adicional para envío express';
COMMENT ON COLUMN public.ecommerce_sellers.permite_pickup IS 'Si el seller permite retiro en sucursal';
COMMENT ON COLUMN public.ecommerce_sellers.pickup_surcharge IS 'Descuento o recargo para retiro en sucursal';
COMMENT ON COLUMN public.sucursales.permite_retiro_clientes IS 'Si la sucursal acepta retiros de clientes e-commerce';