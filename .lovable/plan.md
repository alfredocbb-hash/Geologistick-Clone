
# Plan: Super Admin puede asignar empresa a usuarios

## Resumen

Agregar la funcionalidad para que el Super Admin pueda asignar o cambiar la empresa (tenant) de cualquier usuario desde la página de Usuarios.

## Cambios Necesarios

### 1. Actualizar Política RLS de Profiles (UPDATE)

La política actual solo permite `is_admin()`, pero necesitamos agregar `is_super_admin()` para que pueda modificar el `tenant_id`:

| Política Actual | Política Nueva |
|-----------------|----------------|
| `is_admin(auth.uid())` | `is_admin(auth.uid()) OR is_super_admin(auth.uid())` |

### 2. Modificar Interfaz de Usuarios (Users.tsx)

Agregar un selector de empresa visible **solo para Super Admins**:

```text
┌─────────────────────────────────────────┐
│ Editar Usuario                          │
├─────────────────────────────────────────┤
│ Nombre: [___________]                   │
│ Apellido: [___________]                 │
│ Teléfono: [___________]                 │
│                                         │
│ 🏢 Empresa: [Beraexpress ▼]  ← NUEVO    │
│    (Solo visible para Super Admin)      │
│                                         │
│ Sucursal: [Administración ▼]            │
│ Roles: [admin] [operador] [+]           │
│                                         │
│ [Cancelar] [Guardar]                    │
└─────────────────────────────────────────┘
```

## Detalles Técnicos

### Migración SQL

```sql
DROP POLICY IF EXISTS "Usuario puede actualizar su perfil" ON profiles;

CREATE POLICY "Usuario puede actualizar su perfil" ON profiles
FOR UPDATE
USING (
  (user_id = auth.uid()) 
  OR is_admin(auth.uid()) 
  OR is_super_admin(auth.uid())
);
```

### Cambios en Users.tsx

1. **Nuevo Query**: Cargar lista de tenants (solo si es super_admin)
2. **Nuevo Campo en FormData**: `tenant_id`
3. **Nuevo Selector**: Mostrar dropdown de empresas antes de sucursales
4. **Lógica de Sucursales**: Filtrar sucursales según el tenant seleccionado
5. **Actualización**: Incluir `tenant_id` en el update cuando cambie

### Flujo de Datos

```text
Super Admin abre editar usuario
        ↓
Se cargan los tenants disponibles
        ↓
Usuario cambia el tenant
        ↓
Las sucursales se filtran por el nuevo tenant
        ↓
Se guarda el nuevo tenant_id en profiles
```

## Consideraciones de Seguridad

- Solo Super Admins pueden ver y cambiar el tenant
- Los admins normales NO ven este campo
- La RLS en la base de datos valida que solo super_admin puede modificar tenant_id de otros usuarios
- Las sucursales se filtran dinámicamente para evitar asignar sucursales de otro tenant

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/` | Nueva migración para RLS |
| `src/pages/Users.tsx` | Agregar selector de tenant |

## Resultado Esperado

1. Super Admin abre la página de Usuarios
2. Hace clic en "Editar" en cualquier usuario
3. Ve un nuevo campo "Empresa" con todas las empresas disponibles
4. Puede cambiar la empresa del usuario
5. Al guardar, el usuario queda asociado al nuevo tenant
6. Las sucursales disponibles se actualizan según la empresa seleccionada
