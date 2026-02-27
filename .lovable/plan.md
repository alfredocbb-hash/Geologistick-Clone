
# Fix: Error de seguridad al enviar notificaciones

## Problema

La politica RLS de INSERT en la tabla `notifications` solo permite insertar si `tenant_id = current_user_tenant()`. El super admin no pertenece al tenant destino, por lo que la insercion es rechazada.

## Solucion

Agregar una politica RLS que permita a los super admins insertar notificaciones para cualquier tenant.

## Cambio

| Archivo | Cambio |
|---|---|
| Migracion SQL | Agregar politica INSERT para super_admin en `notifications` |

### SQL

```sql
CREATE POLICY "Super admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_is_super_admin());
```

Esto permite al super admin enviar notificaciones a administradores de cualquier empresa sin modificar la politica existente (que sigue funcionando para usuarios normales dentro de su propio tenant).
