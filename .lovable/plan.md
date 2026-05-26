# Módulo Logístico Avanzado (Planificador + Mapa en Vivo)

Unificar Planificador y Mapa en Vivo bajo un único flag comercial. Reutilizar la columna existente `tenants.planificador_enabled` (sin migración disruptiva) y exponerla en UI con el nombre "Módulo Logístico Avanzado".

## 1. Base de datos
- **Sin cambios de esquema.** Mantener la columna `tenants.planificador_enabled` (default `true`) como flag único.
- Opcional/futuro: si más adelante se desea separar, agregar `live_map_enabled`. Por ahora un solo switch.

## 2. Guard compartido
- Renombrar `PlanificadorGuard.tsx` → `AdvancedLogisticsGuard.tsx` (mantener export `PlanificadorGuard` como alias para evitar romper imports).
- Texto de la pantalla "Módulo no disponible" pasa a: **"Módulo Logístico Avanzado no disponible — Contactá al administrador para habilitar Planificador y Mapa en Vivo."**

## 3. Rutas protegidas en `src/App.tsx`
- Envolver `/live-map` con el mismo guard:
  ```tsx
  <Route element={<AdvancedLogisticsGuard />}>
    <Route path="/live-map" element={<GoogleMapsProvider><LiveMap /></GoogleMapsProvider>} />
    <Route path="/planner" element={...} />
  </Route>
  <Route path="/route-planner" element={<AdvancedLogisticsGuard />}>...</Route>
  ```

## 4. Sidebar (`AppSidebar.tsx`)
- Marcar el ítem `Mapa en Vivo` (`/live-map`) con `requiresPlanificador: true` (o renombrar la prop a `requiresAdvancedLogistics` y aplicar a ambos ítems). Sin cambios en la lógica de filtrado.

## 5. Botones/CTAs dispersos
- Auditar entradas hacia `/live-map` (Dashboard widgets, atajos en Hojas de Ruta, header de Choferes). Ocultar con la misma condición `tenant?.planificador_enabled !== false` ya usada para Planificador.

## 6. Admin UI
- En `EditTenantDialog.tsx`: renombrar la etiqueta del Switch de "Módulo Planificador" → **"Módulo Logístico Avanzado"** con subtítulo "Habilita Planificador de Rutas y Mapa en Vivo".
- Mismo cambio en `create-tenant-with-admin/index.ts` (solo copy en frontend; la edge function ya acepta el flag).

## 7. Validación
- Tenant con flag `false`: sidebar oculta Planificador y Mapa en Vivo; URLs `/planner`, `/route-planner`, `/live-map` muestran la pantalla informativa; super_admin sigue accediendo.
- Tenant con flag `true` (default): comportamiento actual intacto.

## Archivos a tocar
- `src/components/guards/PlanificadorGuard.tsx` (rename + copy)
- `src/App.tsx` (envolver `/live-map`)
- `src/components/layout/AppSidebar.tsx` (marcar live-map)
- `src/components/tenants/EditTenantDialog.tsx` (label)
- Posibles widgets del Dashboard u Hojas de Ruta con link directo a `/live-map` (auditar)

Sin migración de DB, sin cambios en edge functions.
