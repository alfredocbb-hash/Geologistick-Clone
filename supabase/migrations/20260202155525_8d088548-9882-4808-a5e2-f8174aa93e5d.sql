-- Update validate_api_key function to use HMAC-SHA256 with backward compatibility
CREATE OR REPLACE FUNCTION public.validate_api_key(p_api_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_key_id UUID;
  v_expected_hash TEXT;
  v_computed_hash_hmac TEXT;
  v_computed_hash_sha256 TEXT;
  v_prefix TEXT;
  v_hmac_secret TEXT;
BEGIN
  -- Compute prefix in the same format as stored (tk_XXXX...YYYY)
  v_prefix := LEFT(p_api_key, 7) || '...' || RIGHT(p_api_key, 4);
  
  -- Get HMAC secret from app settings (set via ALTER DATABASE ... SET app.hmac_secret = '...')
  v_hmac_secret := current_setting('app.hmac_secret', true);
  
  -- Compute HMAC hash if secret is available
  IF v_hmac_secret IS NOT NULL AND v_hmac_secret != '' THEN
    v_computed_hash_hmac := encode(
      hmac(p_api_key::bytea, v_hmac_secret::bytea, 'sha256'), 
      'hex'
    );
  END IF;
  
  -- Always compute plain SHA-256 for backward compatibility
  v_computed_hash_sha256 := encode(sha256(p_api_key::bytea), 'hex');
  
  -- Get potential match based on prefix
  SELECT tenant_id, id, api_key_hash
  INTO v_tenant_id, v_key_id, v_expected_hash
  FROM public.tenant_api_keys
  WHERE api_key_prefix = v_prefix
    AND is_active = true
  LIMIT 1;
  
  -- If no row found, return NULL
  IF v_expected_hash IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Try HMAC hash first (new keys), then fallback to SHA-256 (legacy keys)
  IF (v_computed_hash_hmac IS NOT NULL AND v_computed_hash_hmac = v_expected_hash)
     OR (v_computed_hash_sha256 = v_expected_hash) THEN
    -- Update last used timestamp
    UPDATE public.tenant_api_keys
    SET last_used_at = now()
    WHERE id = v_key_id;
    
    RETURN v_tenant_id;
  END IF;
  
  RETURN NULL;
END;
$function$;