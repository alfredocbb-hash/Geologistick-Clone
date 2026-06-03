
## Objetivo

Permitir al super admin filtrar la vista de cualquier módulo administrativo por tenant (ej. "Black Box"), para ver y gestionar (deshabilitar/eliminar) sus sucursales, usuarios y demás recursos cuando se le baja el plan.

## Enfoque

Filtro **híbrido**: un selector global persistente en el header + un selector local en cada página (que respeta el global pero permite override).

### 1. Estado global del tenant seleccionado

Nuevo contexto `SuperAdminTenantFilterProvider` (`src/components/providers/SuperAdminTenantFilterProvider.tsx`):
- Estado: `selectedTenantId: string | 'all'`, default `'all'`.
- Persiste en `localStorage` (`sa_selected_tenant`) para recordar entre recargas.
- Expone `setSelectedTenantId`, `selectedTenant` (objeto con nombre/slug), `tenants[]`.
- Solo activo si `isSuperAdmin()`. Se monta dentro de `AuthProvider` en `App.tsx`.
- Hook helper: `useSuperAdminTenantFilter()`.

### 2. Selector global en el header

Nuevo componente `SuperAdminTenantSelector.tsx` insertado en `AppHeader.tsx`:
- Solo visible para super admin.
- Dropdown buscable con todos los tenants + opción "Todos los tenants" + "Sin tenant".
- Muestra badge con nombre del tenant activo.
- Al cambiar, invalida las queries afectadas (`queryClient.invalidateQueries()` por keys clave).

### 3. Filtro reutilizable por página

Nuevo componente `<TenantFilterChip />` en la barra de filtros de cada módulo:
- Solo visible para super admin.
- Permite override local (no persiste): "Usar global" / elegir otro tenant.
- Devuelve el `effectiveTenantId` aplicado.

### 4. Aplicación en módulos

Hook único `useEffectiveTenantId(localOverride?)`:
- Devuelve el `tenant_id` efectivo a usar en queries.
- Retorna `null` cuando es "Todos".

Páginas a actualizar para que sus queries usen `useEffectiveTenantId`, agreguen la clave al `queryKey`, y muestren `<TenantFilterChip />` cuando es super admin:

- **Administración**: `Branches.tsx`, `Users.tsx` (ya tiene local, unificar), `Drivers.tsx`, `Vehicles.tsx`, `Clients.tsx`, `Rates.tsx`, `Partners.tsx`, `ThirdPartyCompanies.tsx`.
- **Operaciones**: `Shipments.tsx`, `Routes.tsx`, `RouteSheets.tsx`, `RoutePlanner.tsx`, `Incidents.tsx`, `ScanQR.tsx`.
- **Finanzas**: `Cash.tsx`, `Gastos.tsx`, `Payments.tsx`, `Facturacion.tsx`, `FiscalDashboard.tsx`, `DriverSettlements.tsx`, `ClientSettlements.tsx`, `BranchSettlements.tsx`, `ThirdPartySettlements.tsx`.
- **E-commerce**: `ecommerce/Orders.tsx`, `ecommerce/Sellers.tsx`, `ecommerce/Settlements.tsx`, `ecommerce/Dashboard.tsx`.
- **Sistema**: `IntegrationSettings.tsx`, `BrandingSettings.tsx`, `SystemSettings.tsx`, `UserActivityAdmin.tsx`, `TenantApiDocs.tsx`, `Reports.tsx`, `LiveMap.tsx`, `Dashboard.tsx`.

Patrón:
```ts
const effectiveTenantId = useEffectiveTenantId();
const { data } = useQuery({
  queryKey: ['branches', effectiveTenantId],
  queryFn: async () => {
    let q = supabase.from('sucursales').select('*');
    if (effectiveTenantId) q = q.eq('tenant_id', effectiveTenantId);
    return (await q).data;
  },
});
```

### 5. Acciones de eliminación / desactivación

Los botones de eliminar/desactivar sucursales y usuarios ya existen para admin. Habilitarlos también para super admin cuando hay un tenant seleccionado:
- `Branches.tsx`: agregar botones "Desactivar" y "Eliminar" visibles para super admin (delete con confirmación + cascada existente).
- `Users.tsx`: ya soporta eliminar para super admin; verificar que funcione sobre cualquier tenant.

### 6. RLS / Backend

No requiere migraciones: el rol `super_admin` ya bypassa RLS por `is_super_admin()` en las policies existentes. Solo se ajusta el filtro del lado cliente.

## Detalles técnicos

- Archivos nuevos:
  - `src/components/providers/SuperAdminTenantFilterProvider.tsx`
  - `src/components/layout/SuperAdminTenantSelector.tsx`
  - `src/components/common/TenantFilterChip.tsx`
  - `src/hooks/useEffectiveTenantId.ts`
- Modificados: `App.tsx` (montar provider), `AppHeader.tsx` (selector), y todas las páginas listadas.
- `queryKey` debe incluir `effectiveTenantId` para refetch automático al cambiar.
- Mutaciones de creación (ej. nueva sucursal) usan `selectedTenantId` cuando hay uno fijo; si es "Todos", se pide elegir tenant en el formulario (campo extra solo super admin).

## QA

1. Login como super admin → header muestra selector "Todos los tenants".
2. Elegir Black Box → todos los módulos filtran por ese tenant.
3. Ir a Sucursales → ver solo las de Black Box, eliminar una.
4. Ir a Usuarios → ver solo los de Black Box, eliminar uno.
5. Cambiar override local en una página → solo afecta esa vista.
6. Cambiar a "Todos" → vuelve la vista agregada.
7. Crear sucursal con tenant fijo seleccionado → se crea con ese `tenant_id`.
