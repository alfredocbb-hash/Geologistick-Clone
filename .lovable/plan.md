
# Plan: Corregir Validación de API Keys

## Problema Identificado

La función `validate_api_key` en la base de datos busca API keys usando `LEFT(p_api_key, 8)` como prefijo, pero la Edge Function `manage-api-keys` almacena el prefijo en un formato diferente:

| Componente | Formato del Prefijo |
|------------|---------------------|
| Edge Function (almacena) | `tk_IoIF...zK2b` (7 chars + `...` + 4 chars) |
| validate_api_key (busca) | `tk_IoIFr` (primeros 8 caracteres) |

**Resultado**: La búsqueda nunca encuentra la API key porque los formatos no coinciden.

---

## Solución Propuesta

Modificar la función de base de datos `validate_api_key` para que use el mismo formato de prefijo que almacena la Edge Function.

### Cambio en SQL

```sql
-- ACTUAL (incorrecto):
WHERE api_key_prefix = LEFT(p_api_key, 8)

-- NUEVO (correcto):
WHERE api_key_prefix = LEFT(p_api_key, 7) || '...' || RIGHT(p_api_key, 4)
```

### Migración SQL Completa

```sql
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
```

---

## Pasos de Implementación

1. **Ejecutar migración SQL** para actualizar la función `validate_api_key`
2. **Probar** la API con la key existente: `tk_IoIFryrlTbRottqJOfij1QmIQSszzK2b`

---

## Verificación Post-Fix

Después de aplicar el cambio, la consulta:
```sql
SELECT public.validate_api_key('tk_IoIFryrlTbRottqJOfij1QmIQSszzK2b');
```

Debería retornar el `tenant_id` correcto en lugar de `NULL`.

---

## Detalle Técnico

La Edge Function genera el prefijo así:
```typescript
const prefix = apiKey.substring(0, 7) + '...' + apiKey.slice(-4);
// Resultado: "tk_IoIF...zK2b"
```

La función SQL debe construir el mismo prefijo para la búsqueda:
```sql
v_prefix := LEFT(p_api_key, 7) || '...' || RIGHT(p_api_key, 4);
-- Resultado: "tk_IoIF...zK2b"
```
