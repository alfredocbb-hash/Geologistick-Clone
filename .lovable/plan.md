
# Plan: Corregir Error al Crear Empresa desde Edge Function

## Problema Identificado

Al crear una empresa desde el panel de administración, aparece el error:
**"Edge Function returned a non-2xx status code"**

### Causa Raíz

El trigger `set_sucursal_tenant_id` en la tabla `sucursales` está bloqueando la inserción de la sucursal "Administración" porque:

1. La Edge Function `create-tenant-with-admin` usa **service role key** para crear la sucursal
2. Con service role, no hay usuario autenticado en el contexto de Supabase
3. El trigger intenta verificar si el usuario es super_admin usando `auth.uid()`, que retorna NULL
4. Como `current_user_is_super_admin()` falla, el trigger sobrescribe `tenant_id` con `current_user_tenant()` (que también es NULL)
5. El trigger rechaza la operación: `"tenant_id is required for sucursales"`

### Flujo del Error

```text
Edge Function (service role)
    ↓
INSERT INTO sucursales (tenant_id = 'xxx-xxx', ...)
    ↓
Trigger: set_sucursal_tenant_id_trigger
    ↓
auth.uid() = NULL (no hay usuario en contexto de service role)
    ↓
current_user_is_super_admin() = FALSE
    ↓
NEW.tenant_id := current_user_tenant() → NULL
    ↓
ERROR: tenant_id is required for sucursales
```

---

## Solución Propuesta

Modificar el trigger `set_sucursal_tenant_id` para que **respete el tenant_id proporcionado** cuando ya viene con un valor, independientemente del contexto de autenticación.

### Lógica Actualizada

```sql
CREATE OR REPLACE FUNCTION public.set_sucursal_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si ya viene con tenant_id, respetarlo (permite Edge Functions con service role)
  IF NEW.tenant_id IS NOT NULL THEN
    -- Si hay un usuario autenticado y no es super_admin, verificar que pertenezca al tenant
    IF auth.uid() IS NOT NULL AND NOT public.current_user_is_super_admin() THEN
      IF NEW.tenant_id != public.current_user_tenant() THEN
        RAISE EXCEPTION 'No puede crear sucursales en otro tenant';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Si no viene tenant_id, intentar obtenerlo del usuario actual
  IF auth.uid() IS NOT NULL THEN
    NEW.tenant_id := public.current_user_tenant();
  END IF;
  
  -- Validación final
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required for sucursales';
  END IF;
  
  RETURN NEW;
END;
$$;
```

### Cambios Clave

| Antes | Después |
|-------|---------|
| Siempre sobrescribe tenant_id si no es super_admin | Respeta tenant_id si ya viene con valor |
| Falla con service role (auth.uid = NULL) | Funciona con service role si tenant_id está presente |
| No permite Edge Functions crear sucursales | Edge Functions pueden crear con tenant_id explícito |

---

## Seguridad

La nueva lógica mantiene la seguridad:

1. **Usuarios normales**: Solo pueden crear en su propio tenant (validación explícita)
2. **Super admins**: Pueden crear en cualquier tenant
3. **Service role** (Edge Functions): Puede crear con tenant_id explícito (necesario para onboarding)
4. **Sin tenant_id**: Sigue fallando como antes

---

## Migración SQL Requerida

```sql
-- Actualizar trigger para permitir Edge Functions con service role
CREATE OR REPLACE FUNCTION public.set_sucursal_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si ya viene con tenant_id, respetarlo (permite Edge Functions con service role)
  IF NEW.tenant_id IS NOT NULL THEN
    -- Si hay usuario autenticado y no es super_admin, verificar que pertenezca al tenant
    IF auth.uid() IS NOT NULL AND NOT public.current_user_is_super_admin() THEN
      IF NEW.tenant_id != public.current_user_tenant() THEN
        RAISE EXCEPTION 'No puede crear sucursales en otro tenant';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Si no viene tenant_id, intentar obtenerlo del usuario actual
  IF auth.uid() IS NOT NULL THEN
    NEW.tenant_id := public.current_user_tenant();
  END IF;
  
  -- Validación final
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required for sucursales';
  END IF;
  
  RETURN NEW;
END;
$$;
```

---

## Resultado Esperado

Después de aplicar la migración:

1. El super admin puede crear empresas sin errores
2. La Edge Function `create-tenant-with-admin` creará la sucursal correctamente
3. El flujo completo de onboarding funcionará
4. Los usuarios normales siguen restringidos a su tenant
