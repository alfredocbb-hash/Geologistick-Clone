

# Fix: Envíos no se actualizan al recibir Hoja de Ruta

## Problema

La política RLS de **UPDATE** en `envios` solo permite actualizar si `sucursal_origen_id`, `sucursal_destino_id` o `sucursal_entrega_id` coincide con la sucursal del usuario. Cuando Mar del Plata recibe una hoja de ruta de Rosario, ninguno de esos campos apunta a Mar del Plata (el campo `sucursal_destino_id` del envío es el destino final del paquete, no necesariamente Mar del Plata).

Resultado: la tabla `hoja_ruta_envios` se actualiza correctamente a "recibido", pero el `UPDATE` sobre `envios` falla silenciosamente (0 rows). El estado queda en `en_transito` y no se dispara el trigger de historial.

## Solución

### 1. Migración SQL: Actualizar política UPDATE de `envios`

Agregar la misma cláusula `EXISTS` que ya agregamos a SELECT, para que usuarios de sucursal puedan actualizar envíos vinculados a hojas de ruta donde su sucursal es origen o destino:

```sql
DROP POLICY "Actualizar envíos de su tenant" ON public.envios;

CREATE POLICY "Actualizar envíos de su tenant" ON public.envios
FOR UPDATE TO public
USING (
  (
    (tenant_id = current_user_tenant()) AND (
      is_admin(auth.uid())
      OR (chofer_id = auth.uid())
      OR (current_user_has_role('sucursal'::app_role) AND (
        sucursal_origen_id = current_user_sucursal()
        OR sucursal_destino_id = current_user_sucursal()
        OR sucursal_entrega_id = current_user_sucursal()
      ))
      OR (current_user_has_role('operador'::app_role) AND (
        sucursal_origen_id = current_user_sucursal()
        OR sucursal_destino_id = current_user_sucursal()
        OR sucursal_entrega_id = current_user_sucursal()
      ))
      OR (current_user_has_role('despachador'::app_role) AND (
        sucursal_origen_id = current_user_sucursal()
        OR sucursal_destino_id = current_user_sucursal()
        OR sucursal_entrega_id = current_user_sucursal()
      ))
      OR EXISTS (
        SELECT 1 FROM hoja_ruta_envios hre
        JOIN hojas_ruta hr ON hr.id = hre.hoja_ruta_id
        WHERE hre.envio_id = envios.id
        AND (hr.sucursal_destino_id = current_user_sucursal()
          OR hr.sucursal_origen_id = current_user_sucursal())
      )
    )
  )
  OR is_super_admin(auth.uid())
);
```

### 2. `ReceiveRouteSheetDialog.tsx`: Limpiar `chofer_id` al recibir

Al recibir envíos, además de cambiar estado y `sucursal_entrega_id`, limpiar `chofer_id` para que el envío quede disponible para re-despacho:

```tsx
const updateData: Record<string, any> = { 
  estado: "en_sucursal",
  chofer_id: null 
};
```

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Agregar cláusula EXISTS a política UPDATE de envíos |
| `src/components/scan/ReceiveRouteSheetDialog.tsx` | Limpiar `chofer_id` al recibir |

