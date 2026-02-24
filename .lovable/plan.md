

# Fix: Quitar visibilidad de envíos por `created_by` para usuarios de sucursal

## Problema

La politica RLS de `envios` tiene la condicion `created_by = auth.uid()` como fallback. Esto hace que un usuario que creo envios en una sucursal anterior (ej: Berazategui) los siga viendo despues de ser reasignado a otra sucursal (ej: Bahia Blanca).

## Solucion

Eliminar la condicion `created_by = auth.uid()` de la politica. Los usuarios de sucursal solo deben ver envios donde su sucursal actual es origen o destino. Los roles con acceso completo (admin, supervisor, chofer, operador, bodega) no se ven afectados.

## Cambio tecnico

Una migracion SQL que reemplaza la politica:

```text
Antes:
  ...
  OR (sucursal_origen_id = get_user_sucursal(auth.uid()))
  OR (sucursal_destino_id = get_user_sucursal(auth.uid()))
  OR (chofer_id = auth.uid())
  OR (created_by = auth.uid())    <-- CAUSA DEL PROBLEMA

Despues:
  ...
  OR (sucursal_origen_id = get_user_sucursal(auth.uid()))
  OR (sucursal_destino_id = get_user_sucursal(auth.uid()))
  OR (chofer_id = auth.uid())
  -- created_by eliminado
```

## Archivo

| Archivo | Accion | Descripcion |
|---|---|---|
| Migracion SQL | Crear | Actualizar politica RLS de envios quitando la condicion `created_by = auth.uid()` |

No se requieren cambios en el frontend.

