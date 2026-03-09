

# Fix: Parpadeo persistente en Firefox al volver a la pestaña

## Diagnóstico

La consola de Firefox muestra: **"El diseño se forzó antes de que la página se cargara completamente"** — un FOUC (Flash of Unstyled Content). Combinado con dos problemas restantes en el código:

### Causa 1: `useBranchConfig` sin protección
El hook `useBranchConfig` (usado en `AppSidebar`) **no tiene `refetchOnWindowFocus: false`**. Cuando Firefox refoca, este hook refetcha, `isLoading` pasa a `true` brevemente, y el sidebar muestra el **skeleton de carga** (líneas 356-375 de AppSidebar).

### Causa 2: `animate-fade-in` en el contenido principal
En `DashboardLayout.tsx` línea 51, el `<main>` tiene la clase `animate-fade-in`. Cada re-render del layout (causado por cualquier cambio de estado) **re-dispara la animación de entrada**, generando el efecto de "parpadeo" del contenido.

## Cambios

### 1. `src/hooks/useBranchConfig.ts`
Agregar `refetchOnWindowFocus: false` a la query (como ya se hizo en los otros hooks de layout).

### 2. `src/components/layout/DashboardLayout.tsx`
Eliminar `animate-fade-in` del `<main>`. Esta animación se re-dispara en cada re-render y causa el flash visual al volver a la pestaña.

### 3. `src/components/layout/AppSidebar.tsx`
Cambiar el guard de loading para que **no muestre skeleton si ya hay datos cargados** (usar `isLoading && !permissions.length` en vez de solo `isLoading`). Esto evita el flash del sidebar cuando los datos ya están en caché y solo se están refrescando en background.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useBranchConfig.ts` | Agregar `refetchOnWindowFocus: false` |
| `src/components/layout/DashboardLayout.tsx` | Eliminar `animate-fade-in` del main |
| `src/components/layout/AppSidebar.tsx` | No mostrar skeleton si ya hay datos en caché |

