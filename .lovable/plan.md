

## Plan: Mostrar todos los usuarios en Actividad y Logs (cross-tenant)

### Problema actual
La tabla `user_activity_logs` se creó hoy y solo tiene registros de 3 usuarios que iniciaron sesión desde entonces. El super_admin **sí ve** esos 3 usuarios correctamente (el RLS funciona bien), pero espera ver los 24 usuarios del sistema. No es un problema de permisos, sino de que no hay registros de login para los demás usuarios.

### Solución
Agregar una sección/tab **"Usuarios"** que muestre **todos los perfiles del sistema** agrupados por tenant, con su último login registrado (si existe). Esto da visibilidad completa al super_admin.

### Cambios

**`src/pages/UserActivityAdmin.tsx`**

1. **Nuevo tab "Usuarios"** con icono `Users`:
   - Query a `profiles` (todos, sin filtro de tenant — el RLS ya permite al super_admin ver todos)
   - Join con `user_activity_logs` para obtener el último login de cada usuario (`MAX(created_at)`)
   - Join con `user_roles` para mostrar roles
   - Join con `tenants` para mostrar nombre del tenant

2. **Tabla con columnas**: Nombre, Email, Tenant, Roles, Último acceso, Estado (activo/inactivo)

3. **KPI cards**: Total usuarios, Usuarios activos hoy (de activity_logs), Tenants

4. **Filtro** por tenant y búsqueda por nombre/email

### Detalle técnico
- Query principal: `profiles` con `select('*, tenant:tenants(nombre)')`
- Query secundaria: `user_activity_logs` agrupada por `user_id` para obtener `MAX(created_at)` como último login — esto se hará en el frontend agrupando los logs existentes
- No requiere cambios de DB ni RLS

### Archivo a modificar
- `src/pages/UserActivityAdmin.tsx`

