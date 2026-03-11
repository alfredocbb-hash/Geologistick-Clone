

# Notificaciones del Super Admin: envío global y por rol

## Situación actual

El diálogo `SendBranchNotificationDialog` está diseñado para admins de tenant: filtra usuarios por `tenant_id` y opcionalmente por sucursal. Un super admin necesita poder enviar a **todos los usuarios del sistema** (cross-tenant) o solo a **administradores de todos los tenants**.

## Plan

### Archivo: `src/components/notifications/SendBranchNotificationDialog.tsx`

Detectar si el usuario es `super_admin` y adaptar el diálogo:

1. **Importar `useAuth`** y verificar `isSuperAdmin()`
2. **Si es super admin**, mostrar un selector de destinatarios con opciones:
   - "Todos los usuarios del sistema"
   - "Solo administradores"
   - "Empresa específica" → muestra un selector de tenants, y luego opcionalmente sucursal
3. **Lógica de envío adaptada**:
   - "Todos los usuarios": query a `profiles` sin filtro de tenant
   - "Solo administradores": query a `user_roles` donde `role in ('admin', 'super_admin')` para obtener `user_id`s
   - "Empresa específica": comportamiento actual (filtra por tenant_id y opcionalmente sucursal)
4. **Fetch de tenants**: query a `tenants` para el selector de empresa (solo cuando es super admin y elige "Empresa específica")

### Archivo: `src/pages/Dashboard.tsx`

Sin cambios necesarios — el botón ya se muestra para `super_admin` (ya incluido en `isAdmin`).

### Sin cambios de base de datos
Las tablas `notifications`, `profiles`, `user_roles` y `tenants` ya existen con los campos necesarios. Las RLS de `notifications` ya permiten inserción por super admin cross-tenant.

