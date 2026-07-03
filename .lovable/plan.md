## Bug

En `src/components/finanzas/LiquidacionManualFormDialog.tsx` (línea 83), el query a `empresas_terciarizadas` filtra por `.eq("activo", true)`, pero la columna real es **`activa`**. Como esa columna no existe, PostgREST devuelve error / lista vacía y por eso el select solo muestra "— Sin empresa —".

## Fix

Cambiar `.eq("activo", true)` por `.eq("activa", true)` en el `useQuery` de `empresas`.

RLS de `empresas_terciarizadas` ya scope-ea por tenant, así que no hace falta agregar filtro de `tenant_id` explícito.
