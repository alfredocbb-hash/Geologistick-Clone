
# Plan: Mejoras en Gestión de Usuarios para Super Admin

## Problemas Identificados

1. **Usuario admin de empresa nueva no visible**
   - El usuario SÍ existe en la base de datos
   - El query de profiles no está filtrando correctamente para super admin
   - Posible problema de cache o timing al crear la empresa

2. **No hay opción para eliminar usuarios**
   - El componente `Users.tsx` solo tiene acciones de "Editar" y "Reiniciar contraseña"
   - Falta el botón y la lógica de eliminación
   - La política RLS ya existe: `Super admin can delete profiles`

3. **Usuarios no agrupados por empresa**
   - La tabla muestra usuarios de forma plana
   - No hay indicador visual de a qué empresa pertenece cada usuario
   - Dificulta la administración cuando hay múltiples empresas

---

## Solución Propuesta

### 1. Agrupar Usuarios por Empresa (Super Admin)

Modificar la vista de usuarios para mostrar usuarios agrupados por empresa cuando el usuario es super admin:

```text
┌─────────────────────────────────────────────────────────────────┐
│  USUARIOS                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ▼ Beraexpress (6 usuarios)                                    │
│  ├─ Alfredo Bernard - admin - alfredo@beraexpress.com          │
│  ├─ Kevin Bernard - chofer - kevin@beraexpress.com             │
│  └─ Lucas Galarza - operador - lucas@beraexpress.com           │
│                                                                 │
│  ▼ BlackBox Cargas (1 usuario)                                 │
│  └─ Blackbox Admin - admin - julian@blackbox.com               │
│                                                                 │
│  ▼ PlataBus Cargas (1 usuario)                                 │
│  └─ Pablo Rios - admin - pablo@platabus.com                    │
│                                                                 │
│  ▼ Sin Empresa Asignada (0 usuarios)                           │
│  └─ (vacío)                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Agregar Botón Eliminar Usuario

Agregar un botón de eliminar con confirmación para super admins:

- Ícono de papelera rojo junto a editar
- Diálogo de confirmación con el nombre del usuario
- Validar que no se pueda eliminar a sí mismo
- Eliminar: roles, ubicaciones, y profile (el usuario en auth queda)

### 3. Mejorar Query de Perfiles

Incluir la información del tenant en el query para poder agrupar:

```typescript
const { data, error } = await supabase
  .from('profiles')
  .select(`
    *,
    tenant:tenants(id, nombre)
  `)
  .order('created_at', { ascending: false });
```

---

## Cambios por Archivo

| Archivo | Cambio |
|---------|--------|
| `src/pages/Users.tsx` | - Agregar join con tenants en query<br>- Vista agrupada por empresa (Collapsible)<br>- Botón eliminar usuario<br>- Diálogo de confirmación eliminación<br>- Filtro por empresa |

---

## Funcionalidades Nuevas

### Vista Agrupada (Solo Super Admin)

- Los usuarios se agrupan por empresa (tenant)
- Cada grupo es colapsable/expandible
- Muestra contador de usuarios por empresa
- Los admins normales siguen viendo la tabla plana (solo su empresa)

### Eliminar Usuario

```typescript
const deleteUserMutation = useMutation({
  mutationFn: async (userId: string) => {
    // 1. Eliminar roles
    await supabase.from('user_roles').delete().eq('user_id', userId);
    
    // 2. Eliminar ubicaciones (si es chofer)
    await supabase.from('driver_locations').delete().eq('chofer_id', userId);
    
    // 3. Eliminar perfil
    const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['profiles'] });
    toast.success('Usuario eliminado');
  },
});
```

### Filtro por Empresa

Agregar un select para filtrar usuarios por empresa específica:

```typescript
<Select value={filterTenant} onValueChange={setFilterTenant}>
  <SelectItem value="all">Todas las empresas</SelectItem>
  {tenants.map(t => (
    <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
  ))}
</Select>
```

---

## UI Propuesta

### Header con Filtros (Super Admin)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Usuarios                                    [Nuevo Usuario]    │
│  Administra usuarios y roles del sistema                        │
├─────────────────────────────────────────────────────────────────┤
│  [🔍 Buscar...]  [📦 Todas las empresas ▼]  [Vista: Agrupada ▼]│
└─────────────────────────────────────────────────────────────────┘
```

### Fila de Usuario con Eliminar

```text
┌─────────────────────────────────────────────────────────────────┐
│  👤 Juan Pérez       📧 juan@ejemplo.com    [Admin] [Operador]  │
│     juan@ejemplo.com  📞 +54 11 1234        📍 Sucursal Central │
│                                              [🔑] [✏️] [🗑️]    │
└─────────────────────────────────────────────────────────────────┘
```

### Diálogo de Confirmación

```text
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Eliminar Usuario                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ¿Estás seguro de que deseas eliminar a:                       │
│                                                                 │
│  👤 Juan Pérez (juan@ejemplo.com)                              │
│                                                                 │
│  Esta acción no se puede deshacer.                             │
│  Se eliminarán sus roles y datos asociados.                    │
│                                                                 │
│  Nota: El acceso de autenticación permanecerá activo.          │
│  Para eliminarlo completamente, contacta al soporte.           │
│                                                                 │
│                      [Cancelar]  [🗑️ Eliminar Usuario]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Consideraciones Técnicas

1. **Eliminación parcial**: Solo se elimina el profile y roles, no el usuario en auth (requiere service role key)

2. **Protecciones**:
   - No permitir eliminar al usuario actual
   - No permitir eliminar super admins (solo otro super admin)
   - Confirmación obligatoria

3. **Rendimiento**: 
   - La vista agrupada usa un `useMemo` para organizar usuarios
   - El fetch incluye el tenant en una sola query (join)

4. **Permisos**:
   - Solo super admin puede ver/eliminar usuarios de otras empresas
   - Admins normales solo ven usuarios de su empresa
