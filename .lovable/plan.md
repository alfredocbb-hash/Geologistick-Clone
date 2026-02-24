

# Fix: Error de RLS al guardar sucursales en tarifas

## Problema

Al guardar la asignacion de sucursales a una tarifa, aparece:
**"new row violates row-level security policy (USING expression) for table sucursal_tarifas"**

## Causa raiz

Existe un registro en `sucursal_tarifas` con un `tenant_id` incorrecto (`a0000000...` en vez de `81be07a7...`). Las reglas de seguridad impiden que el usuario vea o actualice ese registro. Cuando el upsert intenta insertar un nuevo registro para la misma combinacion sucursal+tarifa, la base de datos lo rechaza porque ya existe uno (que el usuario no puede ver).

Este problema puede repetirse si algun proceso futuro crea registros con tenant_id incorrecto.

## Solucion

1. **Corregir el dato corrupto** via migracion SQL
2. **Crear una funcion SECURITY DEFINER** para manejar el upsert de sucursal_tarifas, que siempre fuerce el tenant_id correcto y evite conflictos futuros
3. **Hacer lo mismo para sucursal_conceptos** para prevenir el mismo problema

## Cambios tecnicos

| Tipo | Accion | Descripcion |
|---|---|---|
| Migracion SQL | Crear | Corregir el registro con tenant_id incorrecto en sucursal_tarifas |
| Migracion SQL | Crear | Funcion `upsert_sucursal_tarifas` (SECURITY DEFINER) que hace el upsert interno sin restricciones de RLS, validando tenant_id internamente |
| Migracion SQL | Crear | Funcion `upsert_sucursal_conceptos` (SECURITY DEFINER) equivalente |
| `src/components/rates/TarifaBranchesDialog.tsx` | Modificar | Llamar a la funcion RPC `upsert_sucursal_tarifas` en vez de hacer upsert directo |
| `src/components/rates/ConceptBranchesDialog.tsx` | Modificar | Llamar a la funcion RPC `upsert_sucursal_conceptos` en vez de hacer upsert directo |

### Detalle de las funciones SQL

Las funciones SECURITY DEFINER recibiran un array de objetos con `sucursal_id` y `habilitada/habilitado`, el `tarifa_id` o `concepto_id`, y el `tenant_id`. Internamente haran:

```text
1. Validar que el usuario sea admin o super_admin
2. Validar que el tenant_id coincida con el del usuario (o que sea super_admin)
3. Hacer DELETE + INSERT o UPDATE directo sin restricciones de RLS
4. Retornar resultado
```

Esto evita el problema de "registros fantasma" que el usuario no puede ver pero que bloquean la operacion.

