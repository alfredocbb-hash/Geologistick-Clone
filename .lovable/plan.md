

# Plan: Dashboard Métricas e-Commerce

## Resumen

Crear una pagina de dashboard especifica para el modulo e-Commerce que muestre metricas clave para administradores: pedidos del mes, sellers activos, ingresos totales, pedidos pendientes de envio, y montos pendientes de liquidar.

## Arquitectura de la Pagina

```text
+----------------------------------------------------------+
|  Dashboard e-Commerce                                      |
+----------------------------------------------------------+
|                                                           |
|  [Stats Cards - 4 columnas]                               |
|  +-----------+ +-----------+ +-----------+ +-----------+ |
|  | Pedidos   | | Sellers   | | Ingresos  | | Pendiente | |
|  | del Mes   | | Activos   | | del Mes   | | Liquidar  | |
|  |    156    | |    12     | | $485,230  | | $42,500   | |
|  +-----------+ +-----------+ +-----------+ +-----------+ |
|                                                           |
|  [Contenido Principal - 2 columnas]                       |
|  +-------------------------+ +---------------------------+ |
|  | Pedidos por Estado      | | Ultimos Pedidos           | |
|  | [Pie Chart]             | | - Orden #1234 - $2,500   | |
|  | - Pendientes: 45        | | - Orden #1235 - $1,800   | |
|  | - Enviados: 89          | | - Orden #1236 - $3,200   | |
|  | - Entregados: 22        | | [Ver todos ->]           | |
|  +-------------------------+ +---------------------------+ |
|                                                           |
|  +-------------------------+ +---------------------------+ |
|  | Top Sellers del Mes     | | Saldos por Seller         | |
|  | 1. Tienda A - 45 pedidos| | - Tienda A: -$15,000     | |
|  | 2. Tienda B - 38 pedidos| | - Tienda B: +$8,500      | |
|  | 3. Tienda C - 25 pedidos| | - Tienda C: -$12,000     | |
|  +-------------------------+ +---------------------------+ |
+----------------------------------------------------------+
```

---

## Componentes del Dashboard

### 1. Stats Cards (4 tarjetas principales)

| Metrica | Icono | Descripcion |
|---------|-------|-------------|
| Pedidos del Mes | ShoppingBag | Total de pedidos `ecommerce_orders` del mes actual |
| Sellers Activos | Store | Cantidad de `ecommerce_sellers` con `activo = true` |
| Ingresos del Mes | DollarSign | Suma de `total` de todos los pedidos del mes |
| Pendiente Liquidar | Wallet | Suma de saldos negativos de sellers (deudas) |

### 2. Grafico de Pedidos por Estado

- Grafico de dona/pie mostrando distribucion de `fulfillment_status`:
  - `pending` - Pendientes de envio
  - `shipped` - Enviados
  - `delivered` - Entregados
  - `cancelled` - Cancelados

### 3. Ultimos Pedidos

- Lista de los 5 pedidos mas recientes
- Mostrar: numero de orden, seller, comprador, monto, estado
- Link "Ver todos" que lleva a `/ecommerce/orders`

### 4. Top Sellers del Mes

- Ranking de los 5 sellers con mas pedidos en el mes
- Mostrar: nombre, cantidad de pedidos, monto total

### 5. Saldos por Seller

- Lista de sellers con cuenta corriente
- Mostrar saldo actual (positivo = a favor, negativo = deuda)
- Ordenados por monto absoluto (mayores primero)

---

## Queries de Datos

### Stats del Mes

```typescript
const { data: monthStats } = useQuery({
  queryKey: ['ecommerce-dashboard-stats', tenantId],
  queryFn: async () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Pedidos del mes
    const { data: orders } = await supabase
      .from('ecommerce_orders')
      .select('total, fulfillment_status')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth.toISOString());

    // Sellers activos
    const { count: activeSellers } = await supabase
      .from('ecommerce_sellers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('activo', true);

    // Saldos pendientes (deudas)
    const { data: sellers } = await supabase
      .from('ecommerce_sellers')
      .select('saldo_cuenta_corriente')
      .eq('tenant_id', tenantId)
      .eq('tiene_cuenta_corriente', true)
      .lt('saldo_cuenta_corriente', 0);

    const pendingSettlement = sellers?.reduce(
      (sum, s) => sum + Math.abs(s.saldo_cuenta_corriente), 0
    ) || 0;

    return {
      totalOrders: orders?.length || 0,
      totalRevenue: orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
      activeSellers: activeSellers || 0,
      pendingSettlement,
      ordersByStatus: countByStatus(orders),
    };
  },
});
```

### Top Sellers

```typescript
const { data: topSellers } = useQuery({
  queryKey: ['ecommerce-top-sellers', tenantId],
  queryFn: async () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);

    const { data } = await supabase
      .from('ecommerce_orders')
      .select('seller_id, total, seller:ecommerce_sellers(nombre)')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth.toISOString());

    // Agrupar por seller_id
    const grouped = data?.reduce((acc, order) => {
      const id = order.seller_id;
      if (!acc[id]) {
        acc[id] = { 
          nombre: order.seller?.nombre, 
          count: 0, 
          total: 0 
        };
      }
      acc[id].count++;
      acc[id].total += order.total || 0;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
  },
});
```

---

## Navegacion

### Agregar al Sidebar

En `AppSidebar.tsx`, agregar item "Dashboard" al grupo e-Commerce:

```typescript
{
  title: 'Dashboard',
  url: '/ecommerce/dashboard',
  icon: LayoutDashboard,
  permissionKey: 'ecommerce.sellers.view'
},
```

### Nueva Ruta

En `App.tsx`, agregar:

```typescript
<Route 
  path="/ecommerce/dashboard" 
  element={<DashboardLayout><EcommerceDashboard /></DashboardLayout>} 
/>
```

---

## Archivos a Crear

| Archivo | Descripcion |
|---------|-------------|
| `src/pages/ecommerce/Dashboard.tsx` | Pagina principal del dashboard e-commerce |

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Agregar ruta `/ecommerce/dashboard` |
| `src/components/layout/AppSidebar.tsx` | Agregar item "Dashboard" al grupo e-Commerce |

---

## UI Components Utilizados

- `Card`, `CardHeader`, `CardTitle`, `CardContent` - Tarjetas de stats
- `Badge` - Estados de pedidos
- `Skeleton` - Estados de carga
- `PieChart` de Recharts - Grafico de distribucion
- Iconos de Lucide: `ShoppingBag`, `Store`, `DollarSign`, `Wallet`, `TrendingUp`

---

## Seccion Tecnica: Estructura del Componente

```typescript
export default function EcommerceDashboard() {
  const { tenantId } = useTenant();

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({ ... });
  const { data: recentOrders, isLoading: ordersLoading } = useQuery({ ... });
  const { data: topSellers } = useQuery({ ... });
  const { data: sellerBalances } = useQuery({ ... });

  // Formatear moneda
  const formatCurrency = (amount: number) => { ... };

  // Render stats cards
  const statsConfig = [
    { title: 'Pedidos del Mes', value: stats?.totalOrders, icon: ShoppingBag },
    { title: 'Sellers Activos', value: stats?.activeSellers, icon: Store },
    { title: 'Ingresos del Mes', value: formatCurrency(stats?.totalRevenue), icon: DollarSign },
    { title: 'Pendiente Liquidar', value: formatCurrency(stats?.pendingSettlement), icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <Header />
      <StatsGrid statsConfig={statsConfig} loading={statsLoading} />
      <div className="grid lg:grid-cols-2 gap-6">
        <OrdersByStatusChart data={stats?.ordersByStatus} />
        <RecentOrdersList orders={recentOrders} loading={ordersLoading} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <TopSellersCard sellers={topSellers} />
        <SellerBalancesCard balances={sellerBalances} />
      </div>
    </div>
  );
}
```

---

## Consideraciones

1. **Permisos**: El dashboard usa el mismo permiso `ecommerce.sellers.view` que las otras paginas e-commerce
2. **Tenant isolation**: Todas las queries filtran por `tenant_id`
3. **Performance**: Se usan queries separadas para permitir carga progresiva
4. **Responsive**: Grid de 4 columnas en desktop, 2 en tablet, 1 en movil

---

## Resultado Esperado

Despues de implementar:
- Los administradores tendran una vista general del modulo e-commerce
- Podran ver rapidamente metricas clave sin navegar a cada seccion
- El dashboard sera el punto de entrada principal para el modulo e-commerce

