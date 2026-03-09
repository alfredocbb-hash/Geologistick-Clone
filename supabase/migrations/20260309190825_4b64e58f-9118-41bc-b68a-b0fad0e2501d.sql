
-- 1. Create trigger function to auto-set fecha_entrega when status changes to 'entregado'
CREATE OR REPLACE FUNCTION public.set_fecha_entrega_on_delivered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.estado = 'entregado' AND NEW.fecha_entrega IS NULL THEN
    NEW.fecha_entrega := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Create the trigger
CREATE TRIGGER trg_set_fecha_entrega
  BEFORE INSERT OR UPDATE ON public.envios
  FOR EACH ROW EXECUTE FUNCTION public.set_fecha_entrega_on_delivered();

-- 3. Backfill: set fecha_entrega for existing delivered shipments using history or updated_at
UPDATE envios e
SET fecha_entrega = COALESCE(
  (SELECT h.created_at FROM envio_historial h 
   WHERE h.envio_id = e.id AND h.estado_nuevo = 'entregado' 
   ORDER BY h.created_at DESC LIMIT 1),
  e.updated_at
)
WHERE e.estado = 'entregado' AND e.fecha_entrega IS NULL;
