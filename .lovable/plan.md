
## Objetivo

Cuando un admin de tenant quiera **reactivar** una sucursal o usuario previamente deshabilitado por el super admin, validar que no se exceda el plan contratado (`max_usuarios`, `max_sucursales`). Si excede, bloquear la acción y mostrar aviso claro pidiendo contactar a soporte. El super admin sigue pudiendo reactivar sin restricción (bypass).

## Alcance

Aplica a dos acciones:
1. **Reactivar sucursal** (`sucursales.activa = false → true`) en `src/pages/Branches.tsx`.
2. **Reactivar usuario** (`profiles.activo = false → true` / desbloqueo) en `src/pages/Users.tsx`.

No aplica a: creación de nuevos recursos (esa validación ya existe vía `useSubscription.isWithinLimits`) ni a desactivación.

## Diseño

### 1. Hook reutilizable `usePlanLimitCheck`

Nuevo archivo `src/hooks/usePlanLimitCheck.ts`:
- Recibe `tenantId` (efectivo) y tipo (`'users' | 'branches'`).
- Consulta:
  - Límites del tenant: `tenants.max_usuarios`, `max_sucursales` (o `tenant_subscriptions` + `subscription_plans` vía `get_tenant_subscription_details` si hay suscripción activa — preferir ese si existe, sino fallback a `tenants.*`).
  - Uso actual **activo**: `count` de `profiles` activos y `sucursales.activa = true` para ese tenant.
- Devuelve `{ canActivate: boolean, current, max, planName }`.
- Función `checkBeforeActivate()` que dispara la consulta on-demand (no en cada render).

### 2. Diálogo de aviso `PlanLimitExceededDialog`

Nuevo archivo `src/components/common/PlanLimitExceededDialog.tsx`:
- AlertDialog con icono de warning.
- Texto: "No se puede reactivar [sucursal/usuario] porque excede el plan contratado ([plan]). Límite: X. Actualmente activos: Y. Para ampliar tu plan, contactá a soporte."
- Botón "Entendido" y "Contactar soporte" (link a `/support` o `mailto:`).

### 3. Integración en `Branches.tsx`

En la mutación/handler de "Activar sucursal":
- Si el usuario actual es `super_admin` → continuar sin validación.
- Si es `admin` → llamar `checkBeforeActivate('branches')` antes del `UPDATE`.
- Si `canActivate === false` → abrir `PlanLimitExceededDialog`, abortar.
- Si `true` → ejecutar el update e invalidar queries.

### 4. Integración en `Users.tsx`

Mismo patrón en la acción de reactivar usuario (toggle `activo` o desbloqueo).
- Bypass para `super_admin`.
- Validar contra `max_usuarios`.
- Mostrar diálogo si excede.

### 5. Backend

No requiere migraciones. RLS y triggers existentes ya permiten el update; la validación es client-side (consistente con el patrón actual de `useSubscription`). El super admin ya bypassa por su rol.

Opcional (no incluido en este plan, recomendado a futuro): trigger DB que valide en `BEFORE UPDATE` para defensa en profundidad.

## Archivos

**Nuevos:**
- `src/hooks/usePlanLimitCheck.ts`
- `src/components/common/PlanLimitExceededDialog.tsx`

**Modificados:**
- `src/pages/Branches.tsx` — interceptar reactivación.
- `src/pages/Users.tsx` — interceptar reactivación.

## QA

1. Tenant Black Box con plan: 5 usuarios / 3 sucursales. Super admin deshabilita 2 sucursales (quedan 1 activa).
2. Admin del tenant intenta reactivar 1 sucursal → permitido (queda 2/3).
3. Admin intenta reactivar la 3ra → permitido (3/3).
4. Super admin baja el plan a 2 sucursales. Admin intenta reactivar una más → diálogo "excede el plan, contactar soporte", no se ejecuta el update.
5. Mismo flujo con usuarios.
6. Super admin reactivando con tenant filter activo → siempre permitido.
