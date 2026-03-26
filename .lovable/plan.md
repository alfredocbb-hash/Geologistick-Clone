

## Plan: Corregir flujo de registro ML — múltiples problemas detectados

### Diagnóstico

Revisé los logs de la Edge Function `register-ml-shipment`: **nunca fue invocada**. El problema es 100% del frontend — el diálogo no llega a llamar al backend.

Identifiqué **dos problemas principales**:

### Problema 1: `mlSenderId` undefined bloquea el lookup

En `MLRegisterDialog.tsx`, el `useEffect` (línea 49) requiere `mlSenderId` para ejecutarse:
```javascript
if (open && mlSenderId) { lookupSeller(); }
```

Pero **no todos los formatos de QR incluyen `sender_id`**. Solo el formato JSON (`{"id":"...","sender_id":...}`) lo incluye. Si el QR se parsea como número puro (10+ dígitos) o con prefijo `ML:`, `mlSenderId` queda `undefined` y el `useEffect` nunca se ejecuta → el diálogo se abre vacío, sin seller ni cuenta logística, y el botón "Registrar" queda deshabilitado.

Además, `lookupLogisticsAccount()` tiene `if (!userId) return;` como guard, pero no tiene guard por `mlSenderId`. Sin embargo, si el `useEffect` no se ejecuta, nunca se llama `lookupLogisticsAccount`.

### Problema 2: El botón "Registrar" requiere `mlSenderId`

En `handleRegister` (línea 117):
```javascript
if (!mlSenderId) {
  setError('No se pudo identificar el seller desde el código QR');
  return;
}
```
Esto bloquea completamente el registro cuando no hay `sender_id`.

### Solución

**1. `MLRegisterDialog.tsx`** — Hacer el flujo robusto sin `mlSenderId`:
- El `useEffect` debe ejecutarse siempre que `open` sea true (no depender de `mlSenderId`)
- Si hay `mlSenderId`, buscar seller directo primero; si no hay, ir directo a buscar cuenta logística
- `handleRegister`: si no hay `mlSenderId`, permitir registro con cuenta logística pasando `sender_id` como string vacío o un placeholder (la Edge Function ya maneja el lookup por cuenta logística)
- Quitar el guard `if (!mlSenderId)` que bloquea el registro

**2. `register-ml-shipment/index.ts` (Edge Function)** — Hacer `sender_id` opcional cuando `use_logistics_account` es true:
- Cuando se usa cuenta logística, el `sender_id` no es estrictamente necesario para el lookup (ya se busca por tenant)
- Validar solo que haya `ml_shipment_id`
- Si `sender_id` no viene pero `use_logistics_account` es true, buscar la cuenta logística directamente por tenant del usuario

### Archivos a modificar
- `src/components/scan/MLRegisterDialog.tsx` — useEffect sin depender de mlSenderId + handleRegister sin bloquear por mlSenderId
- `supabase/functions/register-ml-shipment/index.ts` — sender_id opcional cuando use_logistics_account=true

