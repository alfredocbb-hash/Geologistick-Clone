

## Plan: Registrar logins server-side con trigger en auth.users

### Problema
El registro de actividad actual se hace desde el cliente (React `onAuthStateChange`), lo que significa que solo se registra si el usuario inicia sesión desde un navegador que ejecuta tu app. Si inician desde otro PC, red o dispositivo donde el cliente no se ejecutó, no queda registro.

### Solución
Crear un **trigger en la base de datos** que detecte cambios en `auth.users.last_sign_in_at` y automáticamente inserte un log en `user_activity_logs`. Esto funciona independientemente del dispositivo/red porque se ejecuta server-side.

Además, agregar `tenant_id` al log para poder filtrar por empresa, y eliminar el insert duplicado del cliente.

### Cambios

**1. Migración SQL** — Trigger server-side para logins
```sql
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
```

**2. `src/lib/auth.tsx`** — Eliminar el insert client-side de login
- Eliminar el bloque `if (event === 'SIGNED_IN') { supabase.from('user_activity_logs').insert(...) }` (líneas ~98-105) ya que el trigger server-side lo reemplaza completamente.

### Resultado
- Todo login queda registrado sin importar desde qué dispositivo, red o IP se conecte el usuario
- El `tenant_id` se guarda automáticamente para filtrar por empresa
- Sin código duplicado en el cliente

### Archivos a modificar
- Migración SQL (nueva)
- `src/lib/auth.tsx`

