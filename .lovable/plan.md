

## Plan: Mejoras de velocidad (sin romper nada)

Cambios conservadores y de bajo riesgo que reducen bundle, requests y re-renders innecesarios.

### 1. Lazy-load la landing page (`src/App.tsx`)
- Cambiar `import Index from "./pages/Index"` a `const Index = lazy(() => import("./pages/Index"))`
- Los usuarios que van directo a `/login` o `/dashboard` no descargan los 10 componentes de la landing

### 2. Separar chunks pesados (`vite.config.ts`)
Agregar a `manualChunks`:
- `maps`: `@react-google-maps/api`
- `charts`: `recharts`
- `pdf`: `jspdf`, `html2canvas`
- `excel`: `xlsx`
- `i18n`: `i18next`, `react-i18next`

Esto reduce el bundle inicial — estas libs se cargan solo cuando se necesitan.

### 3. React Query: desactivar `refetchOnWindowFocus` global (`src/App.tsx`)
- Cambiar `refetchOnWindowFocus: true` → `false`
- Aumentar `staleTime` de 30s a 60s
- Elimina ráfagas de requests al volver a la pestaña del navegador

### 4. Quitar `GoogleMapsProvider` del `DashboardLayout` (`src/components/layout/DashboardLayout.tsx`)
- Mover el wrapper `<GoogleMapsProvider>` solo a las rutas que usan mapas en `App.tsx`: `/route-planner`, `/live-map`, `/shipments/new`, `/branches`, `/dashboard`
- El resto de páginas (Facturación, Usuarios, Caja, etc.) no cargan ni el hook ni la Edge Function de Maps

### 5. Cache de Maps API key (`src/hooks/useMapsApiKey.ts`)
- Migrar de `useState`/`useEffect` manual a `useQuery` con `staleTime: 30min`
- Eliminar el listener `onAuthStateChange` duplicado
- Resultado: una sola llamada a `get-maps-config` por sesión en vez de una por cada mount

### 6. Eliminar session polling de 60s (`src/lib/auth.tsx`)
- Quitar el `setInterval` que llama `getSession()` cada minuto
- Supabase ya maneja token refresh automáticamente via `onAuthStateChange`
- Ahorra 1 request/minuto por usuario

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Lazy Index, refetchOnWindowFocus false, staleTime 60s, GoogleMapsProvider per-route |
| `vite.config.ts` | manualChunks para maps/charts/pdf/excel/i18n |
| `src/components/layout/DashboardLayout.tsx` | Quitar GoogleMapsProvider |
| `src/hooks/useMapsApiKey.ts` | Migrar a useQuery con 30min cache |
| `src/lib/auth.tsx` | Eliminar setInterval polling |

### Riesgo
Bajo. Todos los cambios son de rendimiento puro — no cambian lógica de negocio, datos, ni UI visible. Los mapas siguen funcionando exactamente igual, solo se cargan donde se necesitan.

