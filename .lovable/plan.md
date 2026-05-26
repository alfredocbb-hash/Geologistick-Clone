## Plan: Módulo Planificador habilitable por tenant (Opción B)

### 1. Base de datos
Agregar columna `planificador_enabled BOOLEAN NOT NULL DEFAULT true` a `public.tenants`. Default `true` preserva el comportamiento actual para todos los tenants existentes.

### 2. Hook `useTenant`
Agregar `planificador_enabled?: boolean` a la interfaz `Tenant` en `src/hooks/useTenant.ts`.

### 3. Sidebar (`src/components/layout/AppSidebar.tsx`)
- Agregar flag `requiresPlanificador` al tipado de items/grupos.
- Marcar el item "Planificador" (ruta `/planner`) con `requiresPlanificador: true`.
- Filtrar igual que `requiresEcommerce`: si `!tenant?.planificador_enabled`, ocultar el item.

### 4. Guard de rutas (Opción B — pantalla informativa)
Crear `src/components/guards/PlanificadorGuard.tsx` que:
- Lee `tenant.planificador_enabled` vía `useTenant()`.
- Si está habilitado → renderiza `<Outlet />`.
- Si no → renderiza una pantalla con icono, título "Módulo no disponible", descripción "El módulo Planificador no está habilitado para tu organización. Contactá al administrador para activarlo." y botón "Volver al Dashboard".
- Mientras `isLoading`, muestra spinner.

Envolver en `src/App.tsx` las rutas `/planner` y `/route-planner` (web y native) con este guard.

### 5. Ocultar botones dispersos
Buscar y ocultar (no deshabilitar) cuando `!tenant?.planificador_enabled`:
- "Planificar ruta" / "Enviar a planificador" en `src/pages/Shipments.tsx` y componentes en `src/components/shipments/`.
- "Crear ruta" desde e-commerce (`src/pages/ecommerce/Orders.tsx`, `Settlements.tsx`) y terciarizados (`src/pages/ThirdPartyCompanies.tsx`, `ThirdPartySettlements.tsx`).
- Cualquier CTA en Dashboard que apunte a `/planner`.

Patrón uniforme: `{tenant?.planificador_enabled && <Button>...</Button>}`.

### 6. Admin — gestión del switch
- En `src/pages/Tenants.tsx` (gestión Super Admin): agregar un Switch "Módulo Planificador" junto al de e-commerce, con update directo a `tenants.planificador_enabled`.
- En `supabase/functions/create-tenant-with-admin/index.ts`: aceptar `planificador_enabled` opcional en el payload (default `true`) al crear nuevos tenants.

### 7. Validaciones
- Verificar que datos previos (rutas planificadas, paradas) siguen existiendo y visibles en otras vistas (Hojas de Ruta, Live Map) cuando el módulo se desactiva.
- Verificar que la app móvil (chofer) no se ve afectada — solo bloquea creación/edición desde web.

### Detalles técnicos
- Tipo `Tenant` ya extensible.
- `requiresEcommerce` ya es el patrón espejo a replicar.
- El guard usa `<Outlet />` para anidarse en `DashboardLayout`.
- Sin cambios en RLS (la columna es solo flag UI; el bloqueo es client-side. Si se quisiera bloqueo server-side, podría agregarse después a las funciones de creación de rutas).

### Archivos afectados (estimado)
- 1 migración SQL
- `src/hooks/useTenant.ts`
- `src/components/layout/AppSidebar.tsx`
- `src/components/guards/PlanificadorGuard.tsx` (nuevo)
- `src/App.tsx`
- `src/pages/Shipments.tsx` + 1-2 componentes de shipments
- `src/pages/ecommerce/Orders.tsx`, `Settlements.tsx`
- `src/pages/ThirdPartyCompanies.tsx`, `ThirdPartySettlements.tsx`
- `src/pages/Tenants.tsx`
- `supabase/functions/create-tenant-with-admin/index.ts`
