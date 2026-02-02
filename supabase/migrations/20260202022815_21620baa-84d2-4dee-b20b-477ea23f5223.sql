-- Fix function search path for security
CREATE OR REPLACE FUNCTION public.notify_ml_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for ML shipments
  IF NEW.ml_shipment_id IS NOT NULL AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    -- Mark as pending sync
    NEW.ml_sync_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;