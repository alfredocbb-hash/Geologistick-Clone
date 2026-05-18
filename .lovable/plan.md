
# Portar modelo Multitenant + Suscripciones a Coopecur Connect

Proyecto destino: [Coopecur Connect](/projects/2e8291ac-8eb9-40aa-a41d-2e8f5909cf5c) (stack TanStack Start, BD Cloud vacía).

## Aviso de stack
Coopecur usa **TanStack Start (SSR)**, no React+Vite. La capa de base de datos (SQL, RLS, funciones) se copia tal cual; los componentes/hooks de React se portan adaptando rutas (`@tanstack/react-router` en vez de `react-router-dom`) y, donde haga falta, server functions en vez de llamadas directas al cliente Supabase.

## Alcance confirmado
1. Multitenant base (tenants, profiles, user_roles, tenant_branding, tenant_usage, helpers RLS)
2. Suscripciones + Trial (subscription_plans, tenant_subscriptions, trial_requests, banner, pantalla de bloqueo)
3. Panel Super Admin (gestión de planes y suscripciones de tenants)

Quedan **fuera**: pasarelas de pago (MP/Stripe), edge functions de cobro, federación cross-tenant, branding avanzado.

## Fase 1 — Base de datos en Coopecur

Migración única que crea, en orden:

**Enums y tablas base**
- `app_role` enum (`super_admin`, `admin`, `operador`, `user`) — ajustable a roles que Coopecur necesite (sugiero discutir antes de aplicar).
- `tenants` (nombre, slug, plan, activo, trial_ends_at, max_usuarios, max_sucursales).
- `profiles` (user_id, email, nombre, apellido, telefono, avatar_url, tenant_id, activo, idioma).
- `user_roles` (user_id, role) con unique (user_id, role).
- `tenant_branding` (tenant_id, nombre_app, logo_light, logo_dark, colores).
- `tenant_usage` (tenant_id, month_year, users_count, branches_count + contador genérico).

**Suscripciones**
- `subscription_plans` (name, price_monthly, max_users, max_branches, features jsonb, activo, stripe_product_id/price_id nullable para futuro).
- `tenant_subscriptions` (tenant_id unique, plan_id, status, current_period_start/end, cancel_at_period_end, mercadopago_subscription_id nullable).
- `trial_requests` (email, nombre, empresa, telefono, estado, created_at).

**Funciones SECURITY DEFINER** (search_path = public):
- `has_role(_user_id, _role)`, `is_admin`, `is_super_admin`
- `current_user_tenant()`, `current_user_is_admin()`, `current_user_is_super_admin()`
- `get_user_tenant(p_user_id)`, `user_belongs_to_tenant(p_tenant_id)`
- `handle_new_user()` trigger sobre `auth.users` que crea tenant trial + profile + role admin + branding
- `get_or_create_tenant_usage(p_tenant_id)`, `get_tenant_subscription_details(p_tenant_id)`
- `check_trial_request_rate_limit()` para anti-spam del formulario público
- `update_updated_at_column()` trigger genérico

**RLS** habilitada en todas. Patrón:
- `tenants`: select propio o super_admin; update solo super_admin.
- `profiles`: select/update propios + admins del mismo tenant.
- `user_roles`: select propio + admins del tenant; insert/delete solo admins.
- `subscription_plans`: select público (activos), CRUD solo super_admin.
- `tenant_subscriptions`: select propio del tenant + super_admin; CRUD solo super_admin.
- `trial_requests`: insert público con rate-limit; select/update solo super_admin.

## Fase 2 — Auth y bootstrap

- Habilitar email auth (sin auto-confirm).
- Trigger `on_auth_user_created` → `handle_new_user()` para crear tenant trial de 14 días automáticamente al registrar.
- Seed: 1 plan "Trial" + 1 plan "Pro" como ejemplo (vía insert tool, no migración).

## Fase 3 — Capa de aplicación (adaptada a TanStack Start)

Archivos a crear en Coopecur (rutas tentativas; ajustaré a la convención del proyecto destino):

**Contexto / hooks**
- `src/lib/auth.tsx` — AuthProvider equivalente: user, session, profile, roles, hasRole, isAdmin, isSuperAdmin. Compatible con SSR (hidratación inicial desde server function).
- `src/hooks/useSubscriptionBlock.ts` — calcula `isBlocked` por trial vencido o suscripción inactiva; super_admin bypass.
- `src/hooks/useSubscription.ts` — lee `tenant_subscriptions` + plan + `tenant_usage`, expone `getUsagePercentage`.
- `src/hooks/useTrial.ts` — días restantes de trial.
- `src/hooks/useTenant.ts` — datos del tenant actual + branding.

**UI**
- `src/components/trial/TrialBanner.tsx` — banner amarillo con días restantes y CTA.
- `src/components/subscription/SubscriptionBlockScreen.tsx` — pantalla full-screen al expirar.
- `src/components/subscriptions/SuperAdminSubscriptionManager.tsx` — panel con tabs: Tenants, Planes, Solicitudes de trial.
- `src/components/tenants/{Create,Edit,Delete,Details}TenantDialog.tsx` — CRUD básico (sin API keys ni branding avanzado).
- `src/routes/subscription.tsx` — vista de "Mi suscripción" (tenant) y panel super_admin condicional.
- `src/routes/trial-requests.tsx` — lista para super_admin.

**Layout**
- Insertar `<TrialBanner />` + chequeo `useSubscriptionBlock` en el root layout del dashboard.

## Fase 4 — Verificación

- Registrar un usuario nuevo → debe crear tenant trial + profile + rol admin.
- Crear un super_admin manualmente (insert en `user_roles`) → debe ver panel.
- Forzar `trial_ends_at` en el pasado → debe aparecer `SubscriptionBlockScreen`.
- Crear `tenant_subscription` activa → debe desbloquear.
- Linter Supabase + scan de seguridad final.

## Cómo procedo

Necesito que me confirmes:
1. **Roles**: ¿uso los mismos (`super_admin`, `admin`, `operador`, `user`) o Coopecur necesita otros (ej. `cliente`, `tecnico`, `cobrador`)?
2. **Trial**: ¿14 días como acá, u otro período?
3. ¿Aplico todo en una sola tanda (Fases 1+2 con migración, luego 3 con código) o preferís validar cada fase antes de seguir?

Cuando confirmes, abro el proyecto Coopecur y ejecuto.
