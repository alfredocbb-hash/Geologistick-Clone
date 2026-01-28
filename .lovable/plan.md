
# Plan: Super Admin puede asignar empresa a usuarios

## ✅ COMPLETADO

### Resumen

Se agregó la funcionalidad para que el Super Admin pueda asignar o cambiar la empresa (tenant) de cualquier usuario desde la página de Usuarios.

### Cambios Realizados

#### 1. Migración RLS ✅
- Actualizada la política `"Usuario puede actualizar su perfil"` para incluir `is_super_admin(auth.uid())`

#### 2. Modificaciones en Users.tsx ✅
- Agregado query para cargar lista de tenants (solo si es super_admin)
- Agregado campo `tenant_id` en formData
- Agregado selector de empresa visible solo para Super Admins
- Implementada lógica de filtrado dinámico de sucursales según el tenant seleccionado
- Actualizado handleSave para incluir tenant_id cuando cambie

### Flujo Implementado

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

### Consideraciones de Seguridad

- ✅ Solo Super Admins pueden ver y cambiar el tenant
- ✅ Los admins normales NO ven este campo
- ✅ La RLS en la base de datos valida los permisos
- ✅ Las sucursales se filtran dinámicamente para evitar asignar sucursales de otro tenant
