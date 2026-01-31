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
  v_computed_hash TEXT;
  v_hashes_match BOOLEAN;
  v_prefix TEXT;
BEGIN
  -- Compute prefix in the same format as stored (tk_XXXX...YYYY)
  v_prefix := LEFT(p_api_key, 7) || '...' || RIGHT(p_api_key, 4);
  
  -- Compute hash
  v_computed_hash := encode(sha256(p_api_key::bytea), 'hex');
  
  -- Get potential match based on prefix
  SELECT tenant_id, id, api_key_hash
  INTO v_tenant_id, v_key_id, v_expected_hash
  FROM public.tenant_api_keys
  WHERE api_key_prefix = v_prefix
    AND is_active = true
  LIMIT 1;
  
  -- If no row found, do dummy comparison for timing attack prevention
  IF v_expected_hash IS NULL THEN
    v_expected_hash := encode(sha256('dummy_value_for_constant_time'::bytea), 'hex');
  END IF;
  
  -- Compare hashes
  v_hashes_match := (v_computed_hash = v_expected_hash);
  
  -- Return tenant_id only if prefix AND hash matched
  IF v_tenant_id IS NOT NULL AND v_hashes_match THEN
    UPDATE public.tenant_api_keys
    SET last_used_at = now()
    WHERE id = v_key_id;
    
    RETURN v_tenant_id;
  END IF;
  
  RETURN NULL;
END;
$function$;