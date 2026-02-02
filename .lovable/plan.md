

# Plan: Fortalecer Seguridad de API Keys con HMAC-SHA256

## Resumen

Actualizaré el sistema de API Keys para usar HMAC-SHA256 en lugar de SHA-256 simple. Esto agrega una capa de seguridad: incluso si un atacante obtiene acceso a los hashes en la base de datos, no podrá crackearlos sin conocer el secreto HMAC.

---

## Pasos a Realizar

### Paso 1: Agregar el Secreto HMAC

Agregaré el secreto que generaste (`3896fbea9e976df0a746b92324508fa65e2cadc1366023137afc3bf9e554bea2`) como variable de entorno en el backend.

### Paso 2: Actualizar Edge Function `manage-api-keys`

**Archivo:** `supabase/functions/manage-api-keys/index.ts`

Cambiar la función `sha256()` por `hmacSha256()`:

```typescript
// ANTES (vulnerable a fuerza bruta)
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  // ...
}

// DESPUES (protegido con secreto)
async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### Paso 3: Actualizar Función de Base de Datos `validate_api_key`

**Migración SQL:**

PostgreSQL tiene `pgcrypto` con `hmac()`. Actualizaré la función para usar HMAC:

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
  v_hmac_secret TEXT;
BEGIN
  -- Get HMAC secret from vault
  v_hmac_secret := current_setting('app.hmac_secret', true);
  
  -- Fallback for backward compatibility
  IF v_hmac_secret IS NULL OR v_hmac_secret = '' THEN
    v_computed_hash := encode(sha256(p_api_key::bytea), 'hex');
  ELSE
    v_computed_hash := encode(
      hmac(p_api_key::bytea, v_hmac_secret::bytea, 'sha256'), 
      'hex'
    );
  END IF;
  
  -- ... resto de la lógica igual
END;
$function$;
```

---

## Compatibilidad con Keys Existentes

Las API Keys existentes usan SHA-256 simple. El plan incluye:

1. **Período de transición**: La función de validación intentará primero con HMAC, y si falla, con SHA-256 simple
2. **Nuevas keys**: Todas las nuevas keys usarán HMAC-SHA256
3. **Migración gradual**: Los usuarios pueden regenerar sus keys para obtener la protección HMAC

---

## Arquitectura de Seguridad

```text
┌──────────────────────────────────────────────────────────────────┐
│                     FLUJO DE GENERACIÓN                          │
├──────────────────────────────────────────────────────────────────┤
│  1. Usuario solicita nueva API Key                               │
│                    ↓                                             │
│  2. Edge Function genera: tk_randomBase64String                  │
│                    ↓                                             │
│  3. Calcula HMAC: hmac(api_key, HMAC_SECRET)                    │
│                    ↓                                             │
│  4. Guarda en DB: { prefix: "tk_xxxx...yyyy", hash: hmac_hash } │
│                    ↓                                             │
│  5. Retorna API Key al usuario (única vez)                       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     FLUJO DE VALIDACIÓN                          │
├──────────────────────────────────────────────────────────────────┤
│  1. Request llega con header: x-api-key: tk_xxxxx...             │
│                    ↓                                             │
│  2. DB Function calcula: hmac(api_key, HMAC_SECRET)              │
│                    ↓                                             │
│  3. Compara con hash almacenado (constant-time)                  │
│                    ↓                                             │
│  4. Si coincide → retorna tenant_id                              │
│     Si no → retorna NULL                                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Beneficios de Seguridad

| Aspecto | SHA-256 (actual) | HMAC-SHA256 (propuesto) |
|---------|------------------|-------------------------|
| Ataque offline | Vulnerable | Protegido |
| Rainbow tables | Vulnerable | Inútiles sin secreto |
| Brute force | Posible | Imposible sin secreto |
| DB leak | Expone hashes crackeables | Hashes inútiles |

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Secreto HMAC | Agregar `API_KEY_HMAC_SECRET` |
| `supabase/functions/manage-api-keys/index.ts` | Usar HMAC-SHA256 |
| Nueva migración SQL | Actualizar `validate_api_key` con HMAC |

