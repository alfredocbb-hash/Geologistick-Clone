-- Fix 1: Make delivery-photos bucket private
UPDATE storage.buckets SET public = false WHERE name = 'delivery-photos';

-- Fix 2: Add rate limiting for trial requests to prevent spam
CREATE OR REPLACE FUNCTION public.check_trial_request_rate_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM trial_requests
  WHERE created_at > NOW() - INTERVAL '1 hour';
  
  RETURN recent_count < 20;
END;
$$;

-- Drop the old permissive INSERT policy and replace with rate-limited one
DROP POLICY IF EXISTS "Anyone can submit trial request" ON trial_requests;

CREATE POLICY "Rate limited trial request insert"
  ON trial_requests FOR INSERT
  WITH CHECK (public.check_trial_request_rate_limit());

-- Add email format constraint
ALTER TABLE trial_requests ADD CONSTRAINT valid_trial_email
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');