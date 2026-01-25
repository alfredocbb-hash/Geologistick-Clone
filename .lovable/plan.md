
## Diagnóstico (por qué pasa)
- El error `duplicate key value violates unique constraint "user_roles_user_id_role_key"` significa que **ese usuario ya tiene el rol `seller` en la tabla `user_roles`**.
- En `/admin/users`, al agregar un rol, el frontend hace un `.insert()` directo a `user_roles`. Si el rol ya existe (o si ocurre un “doble click” / estado desactualizado / condición de carrera), Postgres lo rechaza por la restricción `UNIQUE (user_id, role)` y aparece ese mensaje técnico.

Objetivo: que “asignar rol” sea **idempotente** (si ya lo tiene, no debe explotar) y mostrar un mensaje claro.

---

## Cambios a realizar (sin cambios de base de datos)
### 1) Hacer que la asignación de roles sea “ON CONFLICT DO NOTHING”
**Archivo:** `src/pages/Users.tsx`

- Cambiar `addRoleMutation` para usar `upsert` con:
  - `onConflict: 'user_id,role'`
  - `ignoreDuplicates: true`
- Esto evita el error por duplicado sin requerir políticas UPDATE en `user_roles` (porque no hace merge, hace “do nothing”).

**Además (UI):**
- Evitar duplicados en el estado local `editingRoles`:
  - Antes de mutar, si `editingRoles.includes(newRole)` → mostrar toast tipo “El usuario ya tiene este rol” y no ejecutar nada.
  - Actualizar `editingRoles` **solo si** la mutación terminó OK (o tratar “duplicate” como OK, pero sin duplicar el badge).

**Mensajes al usuario:**
- Si el backend devuelve código/indicador de `23505` (unique violation), mostrar:
  - “El usuario ya tenía asignado ese rol”
  - y no mostrar el mensaje técnico.

---

### 2) Blindar las asignaciones automáticas de rol seller (e-Commerce) contra carreras
Actualmente `ensureSellerRole` hace “select y luego insert”, lo que puede fallar si dos flujos lo ejecutan casi al mismo tiempo.

**Archivos:**
- `src/components/ecommerce/CreateSellerDialog.tsx`
- `src/components/ecommerce/EditSellerDialog.tsx`

**Cambio:**
- Reemplazar la lógica `select + insert` por un `upsert` con `ignoreDuplicates: true` (igual que arriba).
- Esto hace la operación atómica e idempotente.

---

### 3) Robustecer la asignación de roles en la función backend de creación de usuario
**Archivo:** `supabase/functions/create-user/index.ts`

- Cambiar el insert masivo de roles:
  - de `.insert(roleInserts)`
  - a `.upsert(roleInserts, { onConflict: 'user_id,role', ignoreDuplicates: true })`
- Extra: deduplicar el array de roles antes de insertar (por seguridad) para evitar repetir el mismo rol en el payload.

---

### 4) (Opcional) Hacer lo mismo en `create-tenant-with-admin`
**Archivo:** `supabase/functions/create-tenant-with-admin/index.ts`
- Cambiar la inserción del rol `admin` a `upsert` ignoreDuplicates para evitar problemas si la función se reintenta.
- No es estrictamente necesario para tu caso, pero deja todo consistente.

---

## Verificación (pasos para probar)
1) Ir a **Administración → Usuarios** (`/admin/users`).
2) Editar un usuario que ya tenga “Seller e-Commerce”.
3) Intentar asignar “Seller e-Commerce” de nuevo:
   - Resultado esperado: **no error técnico**, solo un mensaje tipo “ya estaba asignado” (o silencio) y sin duplicar badges.
4) Crear/editar un Seller y vincularlo a un usuario existente:
   - Resultado esperado: si ya tenía rol seller, no falla; si no lo tenía, lo asigna.
5) Crear usuario nuevo con rol seller desde el flujo e-Commerce:
   - Resultado esperado: se asigna rol sin errores.

---

## Beneficio inmediato
- Desaparece el error y queda un comportamiento “a prueba de doble click / estado desfasado / condiciones de carrera”.
- Se mantiene la seguridad: roles siguen estando en `user_roles` con `UNIQUE (user_id, role)` y sin almacenar roles en perfiles.

---

## Archivos a tocar
- `src/pages/Users.tsx` (mutación de agregar rol + manejo de UI/estado)
- `src/components/ecommerce/CreateSellerDialog.tsx` (ensureSellerRole idempotente)
- `src/components/ecommerce/EditSellerDialog.tsx` (ensureSellerRole idempotente)
- `supabase/functions/create-user/index.ts` (asignación de roles idempotente)
- (Opcional) `supabase/functions/create-tenant-with-admin/index.ts`

---

## Nota para tu caso puntual (lo que muestra tu captura)
En tu captura el rol “Seller e-Commerce” ya aparece asignado. El error aparece porque el sistema intenta volver a insertarlo. Con estos cambios, si ya estaba asignado, no se rompe nada y lo trata como OK.
