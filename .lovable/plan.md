

# Fix: Aislamiento de Caja por Sucursal + Selector para Admins

## Problema

La query de `currentSession` (líneas 160-168) para admins trae la primera sesión abierta de **cualquier** sucursal del tenant usando `.in('sucursal_id', sucursalIds)`. Esto hace que Administración y Berazategui compartan la misma caja visible.

El admin de "Administración" necesita:
1. Tener su **propia** caja (la de su sucursal asignada)
2. Poder **ver y administrar** las cajas de otras sucursales mediante un selector

## Solución

### Cambios en `src/pages/Cash.tsx`

1. **Agregar estado `selectedSucursalId`** — por defecto la sucursal del usuario (`profile.sucursal_id`). Admins pueden cambiarla con un selector.

2. **Selector de sucursal para admins** — un `<Select>` en el header que permite elegir qué caja ver/gestionar entre todas las sucursales activas del tenant.

3. **Filtrar `currentSession` por `selectedSucursalId`** — reemplazar `.in('sucursal_id', sucursalIds)` por `.eq('sucursal_id', selectedSucursalId)` para todos los roles. Esto aísla cada sucursal.

4. **Filtrar `sessionHistory` por `selectedSucursalId`** — el historial muestra solo la sucursal seleccionada. Agregar opción "Todas" para ver historial consolidado.

5. **Apertura de caja usa `selectedSucursalId`** — reemplazar `profile.sucursal_id` en la mutación de apertura por `selectedSucursalId`, permitiendo al admin abrir caja en cualquier sucursal.

6. **Query keys incluyen `selectedSucursalId`** — para invalidación correcta del cache.

### Flujo resultante

```text
Admin de "Administración":
  [Selector: Administración ▼]  ← su propia caja por defecto
    → Ve/abre/cierra caja de Administración
  [Selector: Berazategui]
    → Ve/abre/cierra caja de Berazategui
  [Selector: Todas (historial)]
    → Ve historial consolidado

Operador de "Berazategui":
  Sin selector → solo ve su propia caja
```

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Cash.tsx` | Agregar `selectedSucursalId`, selector UI, filtrar queries/mutaciones por sucursal |

