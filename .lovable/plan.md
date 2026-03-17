

# Plan: Permitir al super_admin eliminar envíos

## Qué se hará
Agregar un botón "Eliminar" visible solo para super_admin en la tabla de envíos. Al confirmar, se eliminan el envío y todos sus registros relacionados (historial, pagos, movimientos de caja, paradas de ruta, etc.) con un dialog de confirmación con doble verificación.

## Cambios

### 1. `src/pages/Shipments.tsx`
- Importar `useAuth` → extraer `isSuperAdmin` (ya tiene `isAdmin`).
- Importar `Trash2` de lucide-react.
- Agregar estado `deleteDialogOpen` + `envioToDelete`.
- Crear `deleteMutation` que elimina en cascada:
  1. `envio_historial` donde `envio_id`
  2. `pagos` donde `envio_id`
  3. `movimientos_caja` donde `envio_id`
  4. `ruta_paradas` donde `envio_id`
  5. `hoja_ruta_envios` donde `envio_id`
  6. `partner_shipments` donde `envio_origen_id` o `envio_destino_id`
  7. `ecommerce_orders` → set `envio_id = null` donde `envio_id`
  8. `envios` → delete por `id`
- Agregar botón Trash2 en la columna de acciones, visible solo cuando `isSuperAdmin()`.
- Agregar AlertDialog de confirmación con warning destructivo que muestra el tracking number.

### 2. Migración SQL — Policy DELETE para super_admin
Crear una RLS policy que permita DELETE en `envios` solo a super_admins:

```sql
CREATE POLICY "Super admins can delete envios"
ON public.envios
FOR DELETE
TO authenticated
USING (public.current_user_is_super_admin());
```

Y policies similares para las tablas relacionadas (`envio_historial`, `pagos`, `movimientos_caja`, `ruta_paradas`, `hoja_ruta_envios`) para que el DELETE en cascada funcione.

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `src/pages/Shipments.tsx` | Botón eliminar + mutation + dialog |
| Nueva migración SQL | Policies DELETE para super_admin |

