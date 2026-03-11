

# Problema: Sucursales no ven liquidaciones de sucursal en "Mis Comisiones"

## Diagnóstico

La página `MyCommissions.tsx` solo consulta dos tablas:
- `comisiones` — comisiones de chofer
- `liquidaciones` — liquidaciones de chofer

**No consulta `liquidaciones_sucursal`**, que es donde se guardan las liquidaciones generadas por el admin para sucursales como Berazategui.

Las políticas RLS de `liquidaciones_sucursal` ya permiten lectura cuando `sucursal_id = get_user_sucursal(auth.uid())`, así que el acceso en base de datos está bien. El problema es puramente de UI.

## Plan

### 1. Agregar pestaña "Liquidaciones Sucursal" en `src/pages/MyCommissions.tsx`

- Detectar si el usuario tiene `sucursal_id` asignado (desde `profile`)
- Si tiene sucursal, agregar un nuevo `useQuery` que consulte `liquidaciones_sucursal` filtrando por `sucursal_id` del perfil del usuario
- Agregar una 4ta pestaña "Sucursal" al `TabsList` (visible solo si tiene sucursal asignada)
- Mostrar tabla con: período, monto total, estado (pendiente/aprobada/pagada), fecha de pago, y acciones (ver detalle, descargar PDF)
- Agregar stats de sucursal (saldo pendiente, pagadas) en las cards superiores cuando aplique

### 2. Reutilizar componentes existentes

- `SettlementDetailDialog` con `type="branch"` para ver detalle
- `downloadBranchSettlementPDF` para descarga de PDF

### Archivos a modificar
- `src/pages/MyCommissions.tsx` — agregar query, pestaña y lógica condicional

No se necesitan cambios en RLS ni en base de datos.

