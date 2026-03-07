

# Fix: Redirección congelada + Envíos duplicados + Pérdida de estado al cambiar pestaña

## Diagnóstico confirmado

Revisé el código en detalle. Los 3 bugs tienen causas claras:

1. **Redirección congelada**: El `Popover` del combobox de sucursal destino puede quedar montado durante `navigate()`, y sin `dedupe` en Vite pueden existir instancias duplicadas de React que bloquean el desmontaje de portales Radix.

2. **Envíos duplicados**: No hay guard contra doble-click en `handleSubmit` ni en la mutación. Si el usuario clickea rápido "Crear Envío", `createShipmentMutation.mutate()` se ejecuta múltiples veces.

3. **Estado perdido al cambiar pestaña**: `tipoServicioDetalle`, `diasPreferidos`, coordenadas y conceptos seleccionados usan `useState` simple que no sobrevive re-renders causados por token refresh de auth.

## Cambios

### 1. `vite.config.ts` — Agregar `dedupe` para React
Agregar `dedupe: ["react", "react-dom", "react/jsx-runtime"]` en `resolve` para forzar una única instancia de React y evitar conflictos de portales Radix.

### 2. `src/pages/NewShipment.tsx` — 3 fixes

**Fix navegación (línea ~198):**
- Agregar `const navigationAttemptedRef = useRef(false);`

**Fix duplicados (línea ~1481 en `handleSubmit`):**
- Agregar guard: `if (createShipmentMutation.isPending || navigationAttemptedRef.current) return;` al inicio de `handleSubmit`

**Fix navegación en `onSuccess` (línea ~1312):**
- Agregar `setSucursalDestinoOpen(false);` antes de cualquier `navigate()`
- Wrap navigations con `if (!navigationAttemptedRef.current) { navigationAttemptedRef.current = true; navigate(...); }`
- Hacer lo mismo en `handlePaymentConfirm` (línea ~1565)
- Reset `navigationAttemptedRef.current = false` al inicio de `handleSubmit` para permitir re-intentos después de error

**Fix persistencia de estado (líneas ~209, ~212, ~267-268, ~280-282):**
- Importar `usePersistedState` de `@/hooks/usePersistedState`
- Reemplazar `useState` por `usePersistedState` para:
  - `tipoServicioDetalle` → key `'ns-tipo-servicio'`
  - `diasPreferidos` → key `'ns-dias-preferidos'`
- En `onSuccess`, limpiar estos estados persistidos con `sessionStorage.removeItem()`

### Archivos a modificar
1. `vite.config.ts`
2. `src/pages/NewShipment.tsx`

