
# Plan: Integrar Rutas e-Commerce y Panel Super Admin

## Resumen

Voy a conectar las páginas e-Commerce ya creadas con el resto de la aplicación, agregando:
1. Rutas en App.tsx
2. Sección en el menú lateral (visible solo si el tenant tiene `ecommerce_enabled = true`)
3. Toggle para Super Admin para habilitar el módulo por empresa
4. Permisos nuevos para e-commerce

---

## Fase A: Registrar Rutas en App.tsx

Agregar imports y rutas para las 3 páginas e-commerce:

```typescript
// Imports nuevos
import EcommerceSellers from "./pages/ecommerce/Sellers";
import EcommerceOrders from "./pages/ecommerce/Orders";
import EcommerceSettlements from "./pages/ecommerce/Settlements";

// Rutas nuevas (después de Clientes)
<Route path="/ecommerce/sellers" element={<DashboardLayout><EcommerceSellers /></DashboardLayout>} />
<Route path="/ecommerce/orders" element={<DashboardLayout><EcommerceOrders /></DashboardLayout>} />
<Route path="/ecommerce/settlements" element={<DashboardLayout><EcommerceSettlements /></DashboardLayout>} />
```

---

## Fase B: Agregar Sección e-Commerce en Sidebar

Modificar `AppSidebar.tsx` para incluir una nueva sección "e-Commerce" que:
- Solo se muestra si el tenant tiene `ecommerce_enabled = true`
- Tiene ícono `ShoppingCart` de Lucide
- Contiene: Sellers, Pedidos, Liquidaciones

```typescript
// Nueva sección en navigation[]
{
  label: 'e-Commerce',
  items: [
    { title: 'Tiendas', url: '/ecommerce/sellers', icon: Store, permissionKey: 'ecommerce.sellers.view' },
    { title: 'Pedidos', url: '/ecommerce/orders', icon: ShoppingBag, permissionKey: 'ecommerce.orders.view' },
    { title: 'Liquidaciones', url: '/ecommerce/settlements', icon: Receipt, permissionKey: 'ecommerce.settlements.view' },
  ],
  permissionKeys: ['ecommerce.sellers.view', 'ecommerce.orders.view'],
  requiresEcommerce: true  // Nueva propiedad
}
```

El hook `useTenantContext()` ya existe y provee info del tenant. Agregaremos lógica para filtrar por `ecommerce_enabled`.

---

## Fase C: Crear Permisos para e-Commerce

Migración SQL para insertar permisos en `role_permissions`:

```sql
-- Permisos e-commerce para admin y super_admin
INSERT INTO role_permissions (role, permission_key, permission_name, description, enabled)
VALUES 
  ('admin', 'ecommerce.sellers.view', 'Ver Sellers e-Commerce', 'Consultar tiendas conectadas', true),
  ('admin', 'ecommerce.sellers.manage', 'Gestionar Sellers', 'Crear y editar sellers', true),
  ('admin', 'ecommerce.orders.view', 'Ver Pedidos e-Commerce', 'Consultar pedidos importados', true),
  ('admin', 'ecommerce.orders.manage', 'Gestionar Pedidos', 'Crear envíos desde pedidos', true),
  ('admin', 'ecommerce.settlements.view', 'Ver Liq. Sellers', 'Consultar cuenta corriente', true),
  ('super_admin', 'ecommerce.sellers.view', 'Ver Sellers e-Commerce', 'Consultar tiendas conectadas', true),
  -- ... (mismo para super_admin y supervisor)
ON CONFLICT DO NOTHING;
```

---

## Fase D: Toggle e-Commerce en Panel Super Admin

Modificar `EditTenantDialog.tsx` (usado por Super Admin) para agregar:
- Switch "Habilitar Módulo e-Commerce"
- Vinculado a `tenants.ecommerce_enabled`

```typescript
<div className="flex items-center justify-between">
  <div>
    <Label>Módulo e-Commerce</Label>
    <p className="text-sm text-muted-foreground">
      Habilita gestión de sellers y sincronización con plataformas
    </p>
  </div>
  <Switch 
    checked={ecommerceEnabled} 
    onCheckedChange={setEcommerceEnabled} 
  />
</div>
```

---

## Fase E: Agregar Tiendanube a IntegrationSettings

Agregar nueva entrada en `INTEGRATIONS_CONFIG`:

```typescript
tiendanube: {
  name: 'Tiendanube',
  description: 'Sincronización de pedidos con Tiendanube',
  icon: Store,
  docsUrl: 'https://tiendanube.github.io/api-documentation',
  fields: [
    { key: 'client_id', label: 'Client ID', type: 'text', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
  ],
  webhookUrl: '/functions/v1/tiendanube-webhook',
}
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Agregar imports y rutas e-commerce |
| `src/components/layout/AppSidebar.tsx` | Nueva sección e-Commerce con filtro por tenant |
| `src/pages/IntegrationSettings.tsx` | Agregar config Tiendanube |
| `src/components/tenants/EditTenantDialog.tsx` | Toggle ecommerce_enabled |
| Migración SQL | Insertar permisos ecommerce.* |

---

## Diagrama de Flujo de Permisos

```text
Super Admin
    │
    ├── Accede a /admin/tenants
    │       │
    │       └── Edita Tenant → Toggle "ecommerce_enabled"
    │
    └── Si ecommerce_enabled = true para el tenant:
            │
            ├── Sidebar muestra sección "e-Commerce"
            │       │
            │       ├── /ecommerce/sellers (admins con permiso)
            │       ├── /ecommerce/orders
            │       └── /ecommerce/settlements
            │
            └── IntegrationSettings muestra tab "Tiendanube"
```

---

## Orden de Implementación

1. **Migración SQL** - Permisos ecommerce.*
2. **App.tsx** - Registrar rutas
3. **AppSidebar.tsx** - Sección e-Commerce con lógica condicional
4. **EditTenantDialog.tsx** - Toggle para Super Admin
5. **IntegrationSettings.tsx** - Tab Tiendanube

---

## Notas Técnicas

- El `useTenantContext()` ya provee datos del tenant incluyendo `ecommerce_enabled`
- Los tipos en `types.ts` ya incluyen las nuevas tablas (auto-generados)
- Las páginas ya manejan permisos internamente con checks de rol
- Edge Functions se implementarán en una fase posterior (Tiendanube OAuth/Webhooks)
