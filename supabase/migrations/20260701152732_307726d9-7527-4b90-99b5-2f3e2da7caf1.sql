
-- 1. Crear tabla de tokens protegida
CREATE TABLE public.ecommerce_seller_tokens (
  seller_id UUID PRIMARY KEY REFERENCES public.ecommerce_sellers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. GRANTs: solo service_role
GRANT ALL ON public.ecommerce_seller_tokens TO service_role;
-- explícitamente NO se otorga a authenticated ni anon

-- 3. RLS habilitada + policy que niega todo a authenticated/anon
ALTER TABLE public.ecommerce_seller_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all access to authenticated"
  ON public.ecommerce_seller_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all access to anon"
  ON public.ecommerce_seller_tokens
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 4. Trigger updated_at
CREATE TRIGGER update_ecommerce_seller_tokens_updated_at
  BEFORE UPDATE ON public.ecommerce_seller_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Migrar tokens existentes
INSERT INTO public.ecommerce_seller_tokens (seller_id, tenant_id, access_token, refresh_token, token_expires_at)
SELECT id, tenant_id, access_token, refresh_token, token_expires_at
FROM public.ecommerce_sellers
WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;

-- 6. Añadir flag público de conexión activa
ALTER TABLE public.ecommerce_sellers
  ADD COLUMN IF NOT EXISTS has_valid_token BOOLEAN NOT NULL DEFAULT false;

UPDATE public.ecommerce_sellers
SET has_valid_token = true
WHERE access_token IS NOT NULL;

-- 7. Eliminar columnas sensibles de ecommerce_sellers
ALTER TABLE public.ecommerce_sellers
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token,
  DROP COLUMN IF EXISTS token_expires_at;
