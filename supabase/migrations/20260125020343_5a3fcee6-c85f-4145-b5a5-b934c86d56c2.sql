-- Add ecommerce_enabled column to tenants table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenants' 
    AND column_name = 'ecommerce_enabled'
  ) THEN
    ALTER TABLE public.tenants ADD COLUMN ecommerce_enabled boolean DEFAULT false;
  END IF;
END $$;