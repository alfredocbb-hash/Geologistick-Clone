

## Plan: Asignar super_admin a alfredocbb@gmail.com

### Situación actual
- El usuario existe en `auth.users` (ID: `7b3b3c33-8c30-4903-9459-d092d598f658`)
- **No tiene registro en `profiles`** ni en `user_roles` (datos perdidos en el remix)

### Pasos

#### 1. Migración SQL
Ejecutar dos operaciones:

1. **Crear perfil** en `profiles`:
   - `user_id`: `7b3b3c33-8c30-4903-9459-d092d598f658`
   - `email`: `alfredocbb@gmail.com`
   - `nombre`: `Alfredo`
   - `tenant_id`: se necesita determinar a qué tenant asignarlo (el primer tenant activo, o uno específico)

2. **Asignar rol `super_admin`** en `user_roles`

#### 2. Determinar tenant
Antes de ejecutar, necesito verificar qué tenants existen para asignar el correcto.

### Archivos a modificar
Solo migración SQL, sin cambios en código.

