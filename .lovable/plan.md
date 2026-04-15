

## Plan: Revisar y Corregir Permisos por Rol

### Análisis actual
Se revisaron los 47 permission_keys existentes y la asignación para los 11 roles. Se encontraron las siguientes inconsistencias:

### Problemas detectados

**1. Permisos faltantes en roles que deberían tenerlos:**

| Rol | Permiso faltante | Justificación |
|-----|------------------|---------------|
| `operador` | `incidents.report` | Operadores gestionan incidentes |
| `operador` | `delivery.confirm` | Operadores confirman entregas |
| `operador` | `drivers.manage` | Operadores asignan choferes |
| `operador` | `settlements.driver.view` | Operadores ven liquidaciones |
| `operador` | `vehicles.manage` | Operadores gestionan vehículos |
| `supervisor` | `incidents.report` | Supervisores reportan incidentes |
| `supervisor` | `rates.manage` | Supervisores gestionan tarifas |
| `supervisor` | `reports.view` | Supervisores ven reportes |
| `supervisor` | `users.manage` | Supervisores gestionan usuarios |
| `bodega` | `route_sheets.create` | Bodega crea hojas de ruta |
| `bodega` | `shipments.create` | Bodega ingresa paquetes |
| `bodega` | `delivery.confirm` | Bodega confirma entregas en suc |
| `despachador` | `incidents.report` | Despachadores reportan incidentes |
| `despachador` | `routes.plan` | Despachadores planifican despachos |
| `chofer` | `dashboard.view` | Choferes ven su home/dashboard |
| `sucursal` | `routes.plan` | Sucursales planifican rutas locales |
| `sucursal` | `live_map.view` | Sucursales ven el mapa |
| `atencion_cliente` | `incidents.report` | At. Cliente reporta incidentes |
| `atencion_cliente` | `ecommerce.orders.view` | At. Cliente ve pedidos e-commerce |

**2. Permisos que deberían estar deshabilitados:**

| Rol | Permiso | Justificación |
|-----|---------|---------------|
| `seller` | `third_party.manage` | Sellers no gestionan terciarizados |
| `seller` | `third_party.settlements` | Sellers no ven liq. terciarizados |
| `seller` | `third_party.view` | Sellers no ven terciarizados |

**3. Nuevos permission_keys a crear (no existen aún):**

| Key | Nombre | Descripción |
|-----|--------|-------------|
| `fiscal.view` | Ver Panel Fiscal | Acceso al dashboard fiscal |
| `gastos.manage` | Gestionar Gastos | ABM de gastos operativos |
| `partners.view` | Ver Partners | Ver empresas asociadas |
| `partners.manage` | Gestionar Partners | ABM de partnerships |

### Cambios a realizar

**1. SQL INSERT para nuevos permission_keys** (para todos los roles, con enabled apropiado):
- `fiscal.view`: enabled para admin, super_admin, supervisor
- `gastos.manage`: enabled para admin, super_admin, supervisor, operador
- `partners.view`: enabled para admin, super_admin, supervisor
- `partners.manage`: enabled para admin, super_admin

**2. SQL UPDATE para corregir permisos existentes** (activar/desactivar según tabla arriba)

**3. Actualizar `AppSidebar.tsx`**:
- Facturación: `invoicing.view` (en vez de `cash.manage`)
- Gastos: `gastos.manage` (en vez de `cash.manage`)
- Panel Fiscal: `fiscal.view` (en vez de `cash.manage`)
- Partners: `partners.view`

**4. Actualizar `PERMISSION_CATEGORIES` en `RolePermissions.tsx`**:
- Agregar `'fiscal': 'Panel Fiscal'`
- Agregar `'gastos': 'Gastos'`
- Agregar `'partners': 'Partners / Asociados'`

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | INSERT nuevos permission_keys + UPDATE correcciones |
| `src/components/layout/AppSidebar.tsx` | Corregir permissionKeys de finanzas |
| `src/pages/RolePermissions.tsx` | Agregar categorías faltantes |

