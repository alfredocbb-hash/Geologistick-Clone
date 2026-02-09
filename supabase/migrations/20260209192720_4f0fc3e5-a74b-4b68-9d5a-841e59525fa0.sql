
-- Add ML-specific columns to ecommerce_orders
ALTER TABLE public.ecommerce_orders
  ADD COLUMN IF NOT EXISTS ml_shipment_id BIGINT,
  ADD COLUMN IF NOT EXISTS ml_tracking_number TEXT;

-- Update existing records from raw_data where available
UPDATE public.ecommerce_orders
SET 
  ml_shipment_id = (raw_data->>'id')::BIGINT,
  ml_tracking_number = CONCAT('ML-', raw_data->>'id')
WHERE plataforma = 'mercadolibre' 
  AND raw_data IS NOT NULL 
  AND raw_data->>'id' IS NOT NULL
  AND ml_shipment_id IS NULL;

-- Create index for ML shipment lookups
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_ml_shipment_id 
  ON public.ecommerce_orders(ml_shipment_id) 
  WHERE ml_shipment_id IS NOT NULL;

-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function for auto-syncing ML status via Edge Function
CREATE OR REPLACE FUNCTION public.auto_sync_ml_status()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  request_id BIGINT;
BEGIN
  -- Only act if estado actually changed
  IF OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NEW;
  END IF;

  -- Only act on ML shipments
  IF NEW.ml_shipment_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL and service role key from vault or settings
  SELECT decrypted_secret INTO supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url'
  LIMIT 1;

  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- Fallback: use current_setting if vault doesn't have them
  IF supabase_url IS NULL THEN
    supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;
  IF service_role_key IS NULL THEN
    service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  -- If we still don't have the URL, try to construct it
  IF supabase_url IS NULL THEN
    supabase_url := 'https://uhlgimnmfifmrxraorrl.supabase.co';
  END IF;

  -- Only proceed if we have the service role key
  IF service_role_key IS NULL THEN
    RAISE LOG 'auto_sync_ml_status: No service_role_key found, skipping ML sync for envio %', NEW.id;
    RETURN NEW;
  END IF;

  -- Make async HTTP POST to the edge function
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/mercadolibre-update-status',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'envio_id', NEW.id,
      'estado', NEW.estado
    )
  ) INTO request_id;

  RAISE LOG 'auto_sync_ml_status: Triggered ML sync for envio %, estado %, request_id %', NEW.id, NEW.estado, request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_sync_ml_status ON public.envios;
CREATE TRIGGER trigger_auto_sync_ml_status
  AFTER UPDATE OF estado ON public.envios
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_ml_status();
