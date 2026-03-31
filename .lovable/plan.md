

## URGENT FIX: Login bloqueado para todos los usuarios

### Problema
El trigger `log_auth_signin` que acabamos de crear intenta insertar en una columna `details` que NO existe en `user_activity_logs`. Esto causa un error 500 en cada intento de login, bloqueando a todos los usuarios.

Columnas existentes: `id, user_id, tenant_id, action, ip_address, user_agent, created_at`

### Solución
Una migración SQL que:

1. **Reemplaza el trigger** para que use solo las columnas existentes (sin `details`) y envuelva todo en `EXCEPTION WHEN OTHERS THEN NULL` para que nunca bloquee un login.

```sql
CREATE OR REPLACE FUNCTION public.log_auth_signin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public' AS $$
DECLARE v_tenant_id UUID;
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    BEGIN
      SELECT tenant_id INTO v_tenant_id
      FROM public.profiles WHERE user_id = NEW.id LIMIT 1;

      INSERT INTO public.user_activity_logs (user_id, tenant_id, action, created_at)
      VALUES (NEW.id, v_tenant_id, 'login', COALESCE(NEW.last_sign_in_at, now()));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END; $$;
```

### Archivo a modificar
- Nueva migración SQL (fix urgente)

