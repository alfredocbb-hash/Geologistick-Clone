

# Fix: Envíos no visibles en recepción de Hoja de Ruta

## Diagnóstico

El problema raíz es **RLS (Row Level Security)** en la tabla `envios`. Cuando la sucursal MAR DEL PLATA intenta recibir una hoja de ruta de ROSARIO, el join a `envios` retorna `null` porque la política de SELECT solo permite ver envíos donde `sucursal_origen_id`, `sucursal_destino_id` o `sucursal_entrega_id` coincida con la sucursal del usuario. Si el envío fue creado en ROSARIO y aún no tiene asignada MAR DEL PLATA en ninguno de esos campos, el usuario no puede leerlo.

**Resultado**: `item.envio` es `null`, lo que causa los 3 problemas:
1. No se ve el tracking number (campo vacío)
2. No se puede seleccionar el checkbox (`item.envio?.id` es `undefined`)
3. Muestra "Sin destinatario" (no hay datos del envío)

## Solución

### 1. Migración SQL: Actualizar RLS de `envios`

Agregar condición OR a la política SELECT de envíos que permita ver envíos que están en hojas de ruta dirigidas a la sucursal del usuario:

```sql
DROP POLICY "Ver envíos de su tenant" ON public.envios;

CREATE POLICY "Ver envíos de su tenant" ON public.envios
FOR SELECT TO public
USING (
  (
    (tenant_id = current_user_tenant()) AND (
      is_admin(auth.uid())
      OR has_role(auth.uid(), 'supervisor'::app_role)
      OR has_role(auth.uid(), 'chofer'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'bodega'::app_role)
      OR (sucursal_origen_id = get_user_sucursal(auth.uid()))
      OR (sucursal_destino_id = get_user_sucursal(auth.uid()))
      OR (sucursal_entrega_id = get_user_sucursal(auth.uid()))
      OR (chofer_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM hoja_ruta_envios hre
        JOIN hojas_ruta hr ON hr.id = hre.hoja_ruta_id
        WHERE hre.envio_id = envios.id
        AND (hr.sucursal_destino_id = get_user_sucursal(auth.uid())
          OR hr.sucursal_origen_id = get_user_sucursal(auth.uid()))
      )
    )
  )
  OR is_super_admin(auth.uid())
);
```

### 2. `ReceiveRouteSheetDialog.tsx`: Usar `envio_id` como fallback

Para mayor robustez, usar `item.envio_id` (siempre disponible desde `hoja_ruta_envios`) como fallback cuando `item.envio?.id` no está disponible:

- Checkbox: `checked={selectedEnvios.includes(item.envio?.id || item.envio_id)}`
- Toggle: `toggleEnvio(item.envio?.id || item.envio_id)`
- SelectAll: usar `e.envio?.id || e.envio_id`

Esto asegura que incluso si hay un edge case donde el join falla, el usuario puede seleccionar y recibir los envíos.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Actualizar RLS de `envios` para incluir envíos en hojas de ruta de la sucursal |
| `src/components/scan/ReceiveRouteSheetDialog.tsx` | Usar `item.envio_id` como fallback en checkboxes y selección |

