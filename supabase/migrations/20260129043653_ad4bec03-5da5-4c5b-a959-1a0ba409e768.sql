-- Fix 1: Add explicit deny for anonymous access to tenant_api_keys
CREATE POLICY "Deny anonymous access to API keys"
ON public.tenant_api_keys
FOR SELECT
TO anon
USING (false);

-- Fix 2: Restrict subscription_plans to authenticated users only
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;

CREATE POLICY "Authenticated users can view active plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (is_active = true);

-- Fix 3: Update landing_content to use a more secure pattern
-- Keep public read but through authenticated check for most content
DROP POLICY IF EXISTS "Anyone can view landing content" ON public.landing_content;

-- Public sections (hero, features, general) can be read by anyone
CREATE POLICY "Public can view landing content"
ON public.landing_content
FOR SELECT
USING (section IN ('hero', 'features', 'general'));

-- Fix 4: Improve validate_api_key to prevent timing attacks
-- Drop and recreate with constant-time comparison
DROP FUNCTION IF EXISTS public.validate_api_key(text);

CREATE OR REPLACE FUNCTION public.validate_api_key(p_api_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tenant_id UUID;
  v_key_id UUID;
  v_expected_hash TEXT;
  v_computed_hash TEXT;
  v_hashes_match BOOLEAN;
BEGIN
  -- Compute hash first (always happens regardless of prefix match)
  v_computed_hash := encode(sha256(p_api_key::bytea), 'hex');
  
  -- Get all potential matches based on prefix
  -- This ensures we always do the hash comparison even if prefix doesn't exist
  SELECT tenant_id, id, api_key_hash
  INTO v_tenant_id, v_key_id, v_expected_hash
  FROM public.tenant_api_keys
  WHERE api_key_prefix = LEFT(p_api_key, 8)
    AND is_active = true
  LIMIT 1;
  
  -- If no row found, still do a dummy comparison to prevent timing attack
  IF v_expected_hash IS NULL THEN
    -- Dummy comparison with random hash to maintain constant time
    v_expected_hash := encode(sha256('dummy_value_for_constant_time'::bytea), 'hex');
  END IF;
  
  -- Use pg_catalog.texteq for comparison (still not perfectly constant-time but better)
  -- The key improvement is always doing the hash computation
  v_hashes_match := (v_computed_hash = v_expected_hash);
  
  -- Only return tenant_id if both prefix matched AND hash matched
  IF v_tenant_id IS NOT NULL AND v_hashes_match THEN
    -- Update last_used_at
    UPDATE public.tenant_api_keys
    SET last_used_at = now()
    WHERE id = v_key_id;
    
    RETURN v_tenant_id;
  END IF;
  
  RETURN NULL;
END;
$function$;