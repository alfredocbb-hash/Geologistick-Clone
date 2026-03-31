CREATE OR REPLACE FUNCTION public.log_auth_signin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' 
     AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    
    SELECT tenant_id INTO v_tenant_id
    FROM public.profiles
    WHERE user_id = NEW.id;

    INSERT INTO public.user_activity_logs (user_id, tenant_id, action, details, created_at)
    VALUES (
      NEW.id,
      v_tenant_id,
      'login',
      jsonb_build_object('email', NEW.email),
      COALESCE(NEW.last_sign_in_at, now())
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_auth_signin ON auth.users;
CREATE TRIGGER trg_log_auth_signin
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.log_auth_signin();