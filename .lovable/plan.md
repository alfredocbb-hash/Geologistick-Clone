

## Plan: Fix tracking back button + optimizar velocidad del dashboard

### 1. Tracking: Botón volver al dashboard

Cambiar el link de `/` a `/dashboard` en `src/pages/Tracking.tsx` linea 168.

### 2. Optimizar velocidad de carga del Dashboard

El problema principal: cada componente del dashboard hace **multiples queries secuenciales** (una tras otra con `await`). Por ejemplo, `DashboardWeeklyChart` hace **14 queries en serie** (2 por dia x 7 dias). Esto significa que si cada query tarda 100ms, el chart tarda 1.4 segundos solo en queries.

**Solucion: Paralelizar queries con `Promise.all`** en cada componente:

| Componente | Queries actuales (secuenciales) | Mejora |
|---|---|---|
| `DashboardStatsCards` | 6 awaits en serie | 1 `Promise.all` con 6 queries |
| `DashboardWeeklyChart` | 14 awaits en serie (loop de 7 dias) | 1 `Promise.all` con 14 queries |
| `DashboardDaySummary` | 3 awaits en serie | 1 `Promise.all` con 3 queries |
| `DashboardTopDrivers` | 2 awaits en serie | 1 `Promise.all` con 2 queries |
| `DashboardRecentShipments` | 1 query | Sin cambio |
| `DashboardMiniMap` | 1 query | Sin cambio |

Esto reducira el tiempo de carga del dashboard de ~3-4 segundos a ~0.5-1 segundo (todas las queries corren en paralelo en lugar de una tras otra).

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/Tracking.tsx` | Link de `/` a `/dashboard` |
| `src/components/dashboard/DashboardStatsCards.tsx` | Paralelizar 6 queries |
| `src/components/dashboard/DashboardWeeklyChart.tsx` | Paralelizar 14 queries |
| `src/components/dashboard/DashboardDaySummary.tsx` | Paralelizar 3 queries |
| `src/components/dashboard/DashboardTopDrivers.tsx` | Paralelizar 2 queries |

### Seguridad
No se modifican RLS, tablas ni logica de negocio. Solo se cambia el orden de ejecucion de las mismas queries existentes.

