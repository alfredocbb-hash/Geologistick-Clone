
ALTER TABLE public.liquidaciones_terciarizado ADD COLUMN factura_id uuid REFERENCES public.facturas(id);
ALTER TABLE public.facturas ADD COLUMN liquidacion_terciarizado_id uuid REFERENCES public.liquidaciones_terciarizado(id);
