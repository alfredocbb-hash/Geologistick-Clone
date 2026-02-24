

# Fix: Error de clave duplicada al asignar sucursales a tarifas

## Problema

Al guardar la asignacion de sucursales a una tarifa, aparece el error:
**"duplicate key value violates unique constraint 'sucursal_tarifas_sucursal_id_tarifa_id_key'"**

## Causa

El codigo actual busca registros existentes solo en los datos que ya tiene cargados en memoria (`sucursalTarifas`). Si un registro fue creado previamente pero no esta en esa lista (por ejemplo, fue creado por otro usuario o en otra sesion), el sistema intenta hacer un INSERT que choca con la restriccion de unicidad de la base de datos.

## Solucion

Reemplazar la logica de INSERT separado por un **upsert** (insertar o actualizar si ya existe). Esto le dice a la base de datos: "si ya existe un registro con esta combinacion de sucursal + tarifa, simplemente actualizalo en vez de fallar".

El mismo problema existe en el dialogo de asignacion de sucursales a **conceptos** (`ConceptBranchesDialog.tsx`), asi que se corregira en ambos archivos.

## Cambio tecnico

| Archivo | Accion | Descripcion |
|---|---|---|
| `src/components/rates/TarifaBranchesDialog.tsx` | Modificar | Reemplazar INSERT por upsert con `onConflict: 'sucursal_id,tarifa_id'` en la mutacion de guardado |
| `src/components/rates/ConceptBranchesDialog.tsx` | Modificar | Reemplazar INSERT por upsert con `onConflict: 'sucursal_id,concepto_id'` en la mutacion de guardado |

En ambos casos, la logica cambia de:

```text
if (existing) update else insert
```

A:

```text
upsert con onConflict para que la base de datos maneje duplicados automaticamente
```

No se requieren cambios en la base de datos.
