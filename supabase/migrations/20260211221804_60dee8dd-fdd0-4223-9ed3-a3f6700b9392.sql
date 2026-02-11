
-- Add fecha_entrega_estimada column
ALTER TABLE public.ecommerce_orders
ADD COLUMN fecha_entrega_estimada date;

-- Create function to calculate fecha_entrega_estimada
CREATE OR REPLACE FUNCTION public.calculate_fecha_entrega_estimada()
RETURNS TRIGGER AS $$
DECLARE
  hora_argentina integer;
  fecha_argentina date;
BEGIN
  -- Get current hour in Argentina timezone
  hora_argentina := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'));
  fecha_argentina := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  
  -- If fecha_entrega_estimada is not already set
  IF NEW.fecha_entrega_estimada IS NULL THEN
    IF hora_argentina >= 12 THEN
      NEW.fecha_entrega_estimada := fecha_argentina + INTERVAL '1 day';
    ELSE
      NEW.fecha_entrega_estimada := fecha_argentina;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
CREATE TRIGGER set_fecha_entrega_estimada
BEFORE INSERT ON public.ecommerce_orders
FOR EACH ROW
EXECUTE FUNCTION public.calculate_fecha_entrega_estimada();

-- Backfill existing orders
UPDATE public.ecommerce_orders
SET fecha_entrega_estimada = CASE
  WHEN EXTRACT(HOUR FROM (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')) >= 12
    THEN (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + INTERVAL '1 day'
  ELSE (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
END
WHERE fecha_entrega_estimada IS NULL;
