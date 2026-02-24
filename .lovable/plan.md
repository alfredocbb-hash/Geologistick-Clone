

# Fix: Usuarios de sucursales no pueden ver todos los envíos

## Problema

La política de seguridad de la tabla `envios` para lectura (SELECT) solo permite ver todos los envíos del tenant a estos roles:
- admin, supervisor, chofer, operador, bodega

Los roles **sucursal**, **despachador** y **atencion_cliente** quedan excluidos. Esos usuarios solo pueden ver envíos donde su sucursal es origen o destino, lo que significa que no ven envíos que están en tránsito entre otras sucursales o que fueron creados por otra sucursal.

## Solución

Actualizar la política RLS de `envios` para SELECT, agregando los roles `sucursal`, `despachador` y `atencion_cliente` a la lista de roles que pueden ver todos los envíos de su tenant.

## Cambio técnico

Una migración SQL que reemplaza la política existente:

```text
Antes:
  admin, supervisor, chofer, operador, bodega -> ven todo el tenant
  sucursal, despachador, atencion_cliente -> solo ven envíos de su sucursal

Después:
  admin, supervisor, chofer, operador, bodega, sucursal, despachador, atencion_cliente -> ven todo el tenant
```

La política actualizada quedará:

```sql
DROP POLICY IF EXISTS "Ver envíos de su tenant" ON envios;

CREATE POLICY "Ver envíos de su tenant" ON envios
FOR SELECT
USING (
  (
    (tenant_id = current_user_tenant())
    AND (
      is_admin(auth.uid())
      OR has_role(auth.uid(), 'supervisor')
      OR has_role(auth.uid(), 'chofer')
      OR has_role(auth.uid(), 'operador')
      OR has_role(auth.uid(), 'bodega')
      OR has_role(auth.uid(), 'sucursal')
      OR has_role(auth.uid(), 'despachador')
      OR has_role(auth.uid(), 'atencion_cliente')
      OR (sucursal_origen_id = get_user_sucursal(auth.uid()))
      OR (sucursal_destino_id = get_user_sucursal(auth.uid()))
      OR (chofer_id = auth.uid())
      OR (created_by = auth.uid())
    )
  )
  OR is_super_admin(auth.uid())
);
```

Las condiciones de sucursal_origen/destino, chofer_id y created_by se mantienen como fallback para cualquier otro caso.

## Archivo a modificar

| Archivo | Acción | Descripción |
|---|---|---|
| Migración SQL | Crear | Actualizar política RLS de envios para incluir roles sucursal, despachador y atencion_cliente |

No se requieren cambios en el frontend ya que la página de Gestión de Envíos ya consulta todos los envíos sin filtro de sucursal en el código. El problema es exclusivamente de permisos en la base de datos.

