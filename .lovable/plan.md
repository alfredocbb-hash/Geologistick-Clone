## Problema

Al crear un envío para un destinatario **nuevo** (ej. CAMILA, DNI `123456`, tel `+541131034783`), aparece el error:

> "No se pudo crear ni encontrar el cliente. Verifique los datos e intente nuevamente."

## Causa raíz

En `src/pages/NewShipment.tsx → findOrCreateClient`, la búsqueda por DNI/CUIT (paso 1) y por nombre+dirección (paso 2) **no filtran por `tenant_id`**:

```ts
.from('clientes')
.select('*')
.ilike('dni_cuit', data.dni_cuit.trim())
```

Resultado: el DNI genérico `123456` matchea a un cliente de **otro tenant** (`KLEVELAND LOCAL`, tenant `81be07a7…`). El código intenta actualizar ese registro, pero RLS lo bloquea silenciosamente (0 filas afectadas, sin error). Devuelve el `id` ajeno; cuando luego se intenta crear el envío con ese `destinatario_id`, falla por RLS / FK cross-tenant, y el catch genérico lanza el mensaje "No se pudo crear ni encontrar".

El mismo bug existe también en:
- El fallback `findByNameAddr` (sin filtro de tenant).
- El fallback por DNI dentro del bloque de error `23505`.
- Análogamente en `src/pages/Clients.tsx` (búsquedas de duplicado sin tenant).

## Plan

### 1. `src/pages/NewShipment.tsx`
- Agregar `.eq('tenant_id', tenantId)` a:
  - Búsqueda por `dni_cuit` (paso 1).
  - `findByNameAddr` (recibe tenantId por closure).
  - Búsqueda fallback por `dni_cuit` dentro del manejo de error `23505`.
- Si `tenantId` es null/undefined, **saltear** las búsquedas por DNI y por nombre+dirección (ya hay validación posterior que lanza error si falta tenant para crear).
- Antes del `INSERT`, validar que el `telefono_normalizado` calculado no exista en otro registro del mismo tenant; si aparece, reusar ese cliente (cinturón + tirantes para que nunca caiga al 23505 por teléfono).

### 2. `src/pages/Clients.tsx`
- Revisar la validación previa de creación manual de cliente: confirmar que el lookup por teléfono normalizado y por DNI también filtre por `tenant_id`.

### 3. QA
- Crear envío nuevo con destinatario CAMILA, DNI `123456`, tel `+541131034783` → debe crear cliente y envío sin error.
- Crear envío con destinatario cuyo DNI ya exista en **otro** tenant → debe crear cliente nuevo en el tenant actual, sin reusar el ajeno.
- Reusar ARDEBACO (mismo teléfono) → sigue funcionando como antes (dedupe por teléfono).
- Crear cliente manual desde `Clients` con DNI repetido en otro tenant → permitido; con teléfono repetido en el **mismo** tenant → bloqueado.

## Notas técnicas

- Cambios solo en cliente (frontend). No requiere migración.
- El índice único `(tenant_id, telefono_normalizado)` ya creado sigue siendo la salvaguarda de DB; estos cambios evitan llegar al conflicto y, sobre todo, evitan el cross-tenant leak.
