

## Plan: Fix scroll en Ruta Activa y Ruta Start (APK)

### Problema
`ActiveRouteNavigation` y `RouteStart` se renderizan fuera de `MobileAppLayout` (son rutas standalone en App.tsx). Usan `min-h-screen` sin `overflow-y-auto`, lo que impide el scroll en la APK cuando el contenido excede la pantalla — mismo problema que se corrigió en `MobileAppLayout`.

### Cambios

**1. `src/pages/ActiveRouteNavigation.tsx`** (línea 617):
- Cambiar el div raíz de `min-h-screen bg-background pb-24` a `h-screen bg-background overflow-y-auto pb-24`
- Esto permite scroll en la lista de paradas cuando hay muchos envíos

**2. `src/pages/RouteStart.tsx`** (línea 330 aprox, div raíz del return principal):
- Cambiar `min-h-screen bg-background` a `h-screen bg-background overflow-y-auto`
- Mismo fix para que el contenido sea scrolleable en la APK

### Archivos a modificar
- `src/pages/ActiveRouteNavigation.tsx` — div raíz: agregar `overflow-y-auto`, cambiar `min-h-screen` → `h-screen`
- `src/pages/RouteStart.tsx` — div raíz: agregar `overflow-y-auto`, cambiar `min-h-screen` → `h-screen`

