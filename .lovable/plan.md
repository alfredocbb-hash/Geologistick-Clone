

# Diagnóstico: Página se congela al crear envío en otra computadora

## Problema identificado

Después de revisar el código en detalle, encontré varios problemas que pueden causar congelamiento en la página `/shipments/new`:

### 1. Queries sin protección de autenticación
- La query `sucursales` (línea 313) y `allClients` (línea 501) **no tienen `enabled` guard** — se ejecutan inmediatamente aunque `profile` no esté cargado todavía. En una computadora nueva, la autenticación puede demorar más y estas queries fallan silenciosamente o causan errores de RLS.
- La query `tarifa_conceptos` (línea 346) usa `profile?.tenant_id` pero no tiene `enabled: !!profile?.tenant_id`, lo que puede enviar queries con filtros `null`.

### 2. Componente excesivamente pesado
- `NewShipment.tsx` tiene **2653 líneas** con 15+ queries de React Query, múltiples `useMemo` pesados, y Google Maps — todo renderizado simultáneamente.

### 3. Falta de estado de carga inicial
- No hay un loading state mientras se cargan los datos iniciales (sucursal del usuario, tarifas, conceptos). El componente intenta renderizar el formulario completo antes de tener los datos necesarios.

## Plan de corrección

### Archivo: `src/pages/NewShipment.tsx`

1. **Agregar `enabled` guards a todas las queries sin protección**:
   - `sucursales`: agregar `enabled: !!user`
   - `allClients`: agregar `enabled: !!user && !!profile?.tenant_id`
   - `tarifa_conceptos`: agregar `enabled: !!user && !!profile?.tenant_id`

2. **Agregar loading state inicial**: mostrar spinner mientras se cargan los datos esenciales (sucursal del usuario, tarifas) antes de renderizar el formulario completo.

3. **Envolver el cálculo de precio en try/catch**: el `useMemo` de precio (línea 660+) accede a propiedades de `selectedTarifa` que podría ser undefined si las queries aún no cargaron.

Estos cambios son mínimos y quirúrgicos — 3 líneas de `enabled` + un bloque de loading al inicio del render.

