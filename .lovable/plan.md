
# Plan: Actualizar Gestión de Permisos para Super Admin

## Resumen

Completar el sistema de permisos agregando:
1. El rol **Seller e-Commerce** a la página de gestión de roles
2. Nuevos permisos para **Gestión de Tenants** (Super Admin)
3. Nuevos permisos para **Terciarizados** (independientes de sucursales)
4. Crear los registros de permisos en la base de datos para el rol Seller

---

## Cambios en Base de Datos

### 1. Crear permisos para el rol Seller

```sql
INSERT INTO role_permissions (role, permission_key, permission_name, description, enabled)
VALUES
  -- Permisos que el Seller puede tener
  ('seller', 'dashboard.view', 'Ver Dashboard', 'Ver panel principal del vendedor', true),
  ('seller', 'shipments.view', 'Ver Envíos', 'Ver envíos de sus pedidos', true),
  ('seller', 'tracking.view', 'Ver Tracking', 'Ver seguimiento de envíos', true),
  ('seller', 'ecommerce.orders.view', 'Ver Pedidos e-Commerce', 'Ver pedidos de su tienda', true),
  ('seller', 'ecommerce.settlements.view', 'Ver Liq. Sellers', 'Ver sus liquidaciones', true),
  
  -- Permisos deshabilitados por defecto para seller
  ('seller', 'shipments.create', 'Crear Envíos', 'Crear envíos manualmente', false),
  ('seller', 'clients.view', 'Ver Clientes', 'Ver información de clientes', false),
  ('seller', 'commissions.view', 'Ver Mis Comisiones', 'Ver comisiones', false)
ON CONFLICT (role, permission_key) DO NOTHING;
```

### 2. Crear nuevos permisos para Tenants y Terciarizados

```sql
-- Nuevos permisos que se agregan al catálogo
-- Tenants (solo para super_admin)
INSERT INTO role_permissions (role, permission_key, permission_name, description, enabled)
VALUES
  ('super_admin', 'tenants.view', 'Ver Empresas', 'Ver listado de empresas/tenants', true),
  ('super_admin', 'tenants.manage', 'Gestionar Empresas', 'Crear, editar y eliminar empresas', true),
  ('super_admin', 'subscription_plans.manage', 'Gestionar Planes', 'Administrar planes de suscripción', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Terciarizados (para admin y supervisor)
INSERT INTO role_permissions (role, permission_key, permission_name, description, enabled)
SELECT role, 'third_party.view', 'Ver Terciarizados', 'Ver empresas terciarizadas', 
  CASE WHEN role IN ('admin', 'supervisor', 'super_admin') THEN true ELSE false END
FROM unnest(ARRAY['super_admin', 'admin', 'supervisor', 'operador', 'chofer', 'despachador', 'bodega', 'sucursal', 'atencion_cliente', 'cliente']::app_role[]) as role
ON CONFLICT (role, permission_key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key, permission_name, description, enabled)
SELECT role, 'third_party.manage', 'Gestionar Terciarizados', 'Crear y editar empresas terciarizadas',
  CASE WHEN role IN ('admin', 'supervisor', 'super_admin') THEN true ELSE false END
FROM unnest(ARRAY['super_admin', 'admin', 'supervisor', 'operador', 'chofer', 'despachador', 'bodega', 'sucursal', 'atencion_cliente', 'cliente']::app_role[]) as role
ON CONFLICT (role, permission_key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key, permission_name, description, enabled)
SELECT role, 'third_party.settlements', 'Liquidaciones Terciarizados', 'Ver y gestionar liquidaciones de terciarizados',
  CASE WHEN role IN ('admin', 'supervisor', 'super_admin') THEN true ELSE false END
FROM unnest(ARRAY['super_admin', 'admin', 'supervisor', 'operador', 'chofer', 'despachador', 'bodega', 'sucursal', 'atencion_cliente', 'cliente']::app_role[]) as role
ON CONFLICT (role, permission_key) DO NOTHING;
```

---

## Cambios en Código

### 1. Actualizar RolePermissions.tsx

**Archivo:** `src/pages/RolePermissions.tsx`

| Cambio | Descripción |
|--------|-------------|
| Agregar 'seller' a ROLE_ORDER | Incluir el rol en la lista de tabs |
| Actualizar PERMISSION_CATEGORIES | Agregar categorías 'tenants' y 'third_party' |

```typescript
// Agregar 'seller' al array ROLE_ORDER
const ROLE_ORDER: AppRole[] = [
  'super_admin',
  'admin',
  'supervisor',
  'operador',
  'despachador',
  'chofer',
  'bodega',
  'sucursal',
  'atencion_cliente',
  'cliente',
  'seller',  // <-- Nuevo
];

// Agregar nuevas categorías
const PERMISSION_CATEGORIES: Record<string, string> = {
  // ... existentes ...
  'tenants': 'Empresas (Tenants)',
  'third_party': 'Terciarizados',
  'ecommerce': 'e-Commerce',
  'subscription_plans': 'Planes de Suscripción',
};
```

### 2. Actualizar AppSidebar.tsx

**Archivo:** `src/components/layout/AppSidebar.tsx`

| Cambio | Descripción |
|--------|-------------|
| Cambiar permiso de Terciarizados | Usar 'third_party.view' en vez de 'branches.manage' |
| Agregar permisos a Super Admin | Usar permisos específicos para items de Super Admin |

```typescript
// Sección Terciarizados - cambiar permisos
{
  label: 'Terciarizados',
  items: [{
    title: 'Empresas',
    url: '/admin/third-party-companies',
    icon: Truck,
    permissionKey: 'third_party.view',  // Cambiar de 'branches.manage'
  }],
  permissionKeys: ['third_party.view', 'third_party.manage']
},

// Agregar Liq. Terciarizados a Finanzas con su propio permiso
{
  title: 'Liq. Terciarizados',
  url: '/settlements/third-party',
  icon: FileText,
  permissionKey: 'third_party.settlements'  // Cambiar de 'settlements.branch.view'
},

// Sección Super Admin con permisos específicos
{
  label: 'Super Admin',
  items: [{
    title: 'Empresas',
    url: '/admin/tenants',
    icon: Building2,
    permissionKey: 'tenants.view',  // Agregar permiso específico
  }, {
    title: 'Planes',
    url: '/admin/subscription-plans',
    icon: Crown,
    permissionKey: 'subscription_plans.manage',
  }],
  superAdminOnly: true
},
```

---

## Estructura de Permisos Resultante

### Nuevos Permisos Agregados

| Permission Key | Nombre | Roles con acceso |
|---------------|--------|------------------|
| `tenants.view` | Ver Empresas | super_admin |
| `tenants.manage` | Gestionar Empresas | super_admin |
| `subscription_plans.manage` | Gestionar Planes | super_admin |
| `third_party.view` | Ver Terciarizados | admin, supervisor, super_admin |
| `third_party.manage` | Gestionar Terciarizados | admin, supervisor, super_admin |
| `third_party.settlements` | Liq. Terciarizados | admin, supervisor, super_admin |

### Permisos del Rol Seller

| Permission Key | Estado Default |
|---------------|----------------|
| `dashboard.view` | Activo |
| `shipments.view` | Activo |
| `tracking.view` | Activo |
| `ecommerce.orders.view` | Activo |
| `ecommerce.settlements.view` | Activo |
| `shipments.create` | Inactivo |
| `clients.view` | Inactivo |
| `commissions.view` | Inactivo |

---

## Diagrama de Categorías de Permisos

```text
+----------------------+     +----------------------+     +----------------------+
|   Panel Principal    |     |       Envíos         |     |    Operaciones       |
|----------------------|     |----------------------|     |----------------------|
| dashboard.view       |     | shipments.view       |     | shipments.scan       |
|                      |     | shipments.create     |     | routes.plan          |
|                      |     | shipments.edit       |     | route_sheets.view    |
|                      |     | tracking.view        |     | route_sheets.create  |
|                      |     |                      |     | live_map.view        |
|                      |     |                      |     | drivers.manage       |
|                      |     |                      |     | vehicles.manage      |
|                      |     |                      |     | my_routes.view       |
+----------------------+     +----------------------+     +----------------------+

+----------------------+     +----------------------+     +----------------------+
|      Finanzas        |     |      Clientes        |     |    e-Commerce        |
|----------------------|     |----------------------|     |----------------------|
| cash.manage          |     | clients.view         |     | ecommerce.orders.view|
| settlements.branch.* |     | clients.manage       |     | ecommerce.orders.manage|
| settlements.driver.* |     |                      |     | ecommerce.sellers.view|
| settlements.client.* |     |                      |     | ecommerce.sellers.manage|
| commissions.view     |     |                      |     | ecommerce.settlements.view|
+----------------------+     +----------------------+     +----------------------+

+----------------------+     +----------------------+     +----------------------+
|   Terciarizados      |     |   Administración     |     |     Super Admin      |
|----------------------|     |----------------------|     |----------------------|
| third_party.view     |     | branches.manage      |     | tenants.view         |
| third_party.manage   |     | rates.manage         |     | tenants.manage       |
| third_party.settlements|   | users.manage         |     | subscription_plans.manage|
|                      |     | roles.manage         |     |                      |
|                      |     | integrations.manage  |     |                      |
|                      |     | invoicing.*          |     |                      |
+----------------------+     +----------------------+     +----------------------+
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/RolePermissions.tsx` | Agregar 'seller' a ROLE_ORDER y nuevas categorías |
| `src/components/layout/AppSidebar.tsx` | Actualizar permisos de Terciarizados y Super Admin |

## Archivos NO Modificados (solo SQL)

| Tabla | Registros Agregados |
|-------|---------------------|
| `role_permissions` | ~20 nuevos registros para seller y nuevos permisos |

---

## Orden de Implementación

1. **Ejecutar migración SQL** para crear los nuevos permisos en `role_permissions`
2. **Actualizar `RolePermissions.tsx`** para incluir seller y nuevas categorías
3. **Actualizar `AppSidebar.tsx`** con los nuevos permission keys
4. **Probar** que el rol Seller aparece en la gestión de permisos
5. **Verificar** que los permisos de Terciarizados y Tenants funcionan correctamente

---

## Resultado Esperado

Después de implementar:

- El rol **Seller e-Commerce** aparece en la página de Gestión de Permisos con 8 permisos configurables
- Los permisos de **Terciarizados** son independientes de Sucursales
- Los **Super Admins** tienen permisos específicos para gestión de Empresas y Planes
- Todas las categorías de permisos están organizadas y son configurables
- El sistema de permisos queda completo y listo para escalar

