

## Plan: Página de API Keys para Super Admin con selector de tenant

### Concepto
Crear una nueva página `/admin/api-docs` accesible solo por super admins, donde se selecciona un tenant y se muestra el panel completo de API Keys + documentación de los endpoints públicos (Tracking, Cotización, Sucursales). Reutiliza el componente `TenantApiKeysDialog` existente pero embebido en una página completa en vez de un dialog.

### Cambios

| Archivo | Cambio |
|---------|--------|
| `src/pages/TenantApiDocs.tsx` | Nueva página: selector de tenant + `TenantApiKeysDialog` content embebido |
| `src/components/layout/AppSidebar.tsx` | Agregar item "API Pública" al grupo Super Admin |
| `src/App.tsx` | Agregar ruta `/admin/api-docs` |

### Detalle

**1. `src/pages/TenantApiDocs.tsx`**
- Gate de acceso: solo `super_admin`, redirige a `/dashboard` si no lo es
- Selector de tenant (dropdown con tenants activos)
- Al seleccionar tenant, muestra:
  - Gestión de API Keys (generar, activar/desactivar, eliminar) — misma lógica del dialog existente
  - Documentación de los 3 endpoints (Tracking, Cotización, Sucursales) con la Base URL
- Layout dentro de `DashboardLayout`

**2. `src/components/layout/AppSidebar.tsx`**
- Agregar `{ title: 'API Pública', url: '/admin/api-docs', icon: Key, permissionKey: 'tenants.manage' }` al grupo Super Admin

**3. `src/App.tsx`**
- Import + ruta `<Route path="/admin/api-docs" element={<DashboardLayout><TenantApiDocs /></DashboardLayout>} />`

### No requiere migraciones de base de datos

