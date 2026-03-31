CREATE OR REPLACE FUNCTION public.log_auth_signin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    BEGIN
      SELECT tenant_id INTO v_tenant_id
      FROM public.profiles WHERE user_id = NEW.id LIMIT 1;

      INSERT INTO public.user_activity_logs (user_id, tenant_id, action, created_at)
      VALUES (NEW.id, v_tenant_id, 'login', COALESCE(NEW.last_sign_in_at, now()));
    EXCEPTION WHEN OTHERS THEN
      RETURN NEW;
    END;
  END IF;
  RETURN NEW;
END;
$$;