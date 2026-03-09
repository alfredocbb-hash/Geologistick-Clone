

# Fix: Parpadeo y reset del sidebar al volver a la pestaña

## Causa raíz

El parpadeo persiste porque hay hooks críticos en el **layout principal** (`DashboardLayout`) que **no tienen `refetchOnWindowFocus: false`** y se refrescan al volver a la pestaña:

1. **`useSubscription()`** en `TrialBanner` — llama **dos edge functions** (mp-check-subscription + check-subscription) en cada foco. Mientras carga, `trialLoading || subLoading` puede ser `true` temporalmente, causando flash.
2. **`useTrial()`** en `TrialBanner` — refetcha tenant data en cada foco.
3. **`useTenant()`** en `AppSidebar` — refetcha tenant + branding. Mientras `isLoading`, el sidebar muestra **skeleton** (ya lo vi en el código), que es exactamente el "parpadeo" que ves.
4. **`usePermissions()`** en `AppSidebar` — refetcha permisos. Mientras carga, también muestra skeleton.

Estos 4 hooks se ejecutan **en el layout que envuelve todo**, así que cuando refetchan al volver de otra pestaña, todo el sidebar y header "parpadean" momentáneamente mostrando skeletons.

## Cambios

### 1. `src/hooks/useSubscription.ts`
Agregar `refetchOnWindowFocus: false` a ambas queries (subscription y plans).

### 2. `src/hooks/useTrial.ts`
Agregar `refetchOnWindowFocus: false`.

### 3. `src/hooks/useTenant.ts`
Agregar `refetchOnWindowFocus: false` a las queries de tenant y branding.

### 4. `src/hooks/usePermissions.ts`
Agregar `refetchOnWindowFocus: false`.

Estos datos (plan, trial, branding, permisos) cambian muy rara vez y ya tienen `refetchInterval` o `staleTime` configurados. No necesitan refrescarse en cada cambio de foco.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useSubscription.ts` | `refetchOnWindowFocus: false` en 2 queries |
| `src/hooks/useTrial.ts` | `refetchOnWindowFocus: false` |
| `src/hooks/useTenant.ts` | `refetchOnWindowFocus: false` en 2 queries |
| `src/hooks/usePermissions.ts` | `refetchOnWindowFocus: false` |

