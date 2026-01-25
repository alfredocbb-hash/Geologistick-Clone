import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, Store, DollarSign, Wallet, TrendingUp, ArrowRight, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

interface OrdersByStatus {
  pending: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  activeSellers: number;
  pendingSettlement: number;
  ordersByStatus: OrdersByStatus;
}

interface TopSeller {
  id: string;
  nombre: string;
  count: number;
  total: number;
}

interface SellerBalance {
  id: string;
  nombre: string;
  saldo: number;
}

interface RecentOrder {
  id: string;
  external_order_number: string | null;
  buyer_name: string;
  total: number;
  fulfillment_status: string | null;
  created_at: string;
  seller: { nombre: string } | null;
}

const FULFILLMENT_COLORS: Record<string, string> = {
  pending: 'hsl(var(--chart-1))',
  shipped: 'hsl(var(--chart-2))',
  delivered: 'hsl(var(--chart-3))',
  cancelled: 'hsl(var(--chart-4))',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  pending: 'Pendientes',
  shipped: 'Enviados',
  delivered: 'Entregados',
  cancelled: 'Cancelados',
};

const chartConfig = {
  pending: { label: 'Pendientes', color: 'hsl(var(--chart-1))' },
  shipped: { label: 'Enviados', color: 'hsl(var(--chart-2))' },
  delivered: { label: 'Entregados', color: 'hsl(var(--chart-3))' },
  cancelled: { label: 'Cancelados', color: 'hsl(var(--chart-4))' },
};

export default function EcommerceDashboard() {
  const { tenantId } = useTenant();

  // Stats query
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['ecommerce-dashboard-stats', tenantId],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Orders this month
      const { data: orders } = await supabase
        .from('ecommerce_orders')
        .select('total, fulfillment_status')
        .eq('tenant_id', tenantId!)
        .gte('created_at', startOfMonth.toISOString());

      // Active sellers
      const { count: activeSellers } = await supabase
        .from('ecommerce_sellers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId!)
        .eq('activo', true);

      // Pending settlements (negative balances = debt to company)
      const { data: sellers } = await supabase
        .from('ecommerce_sellers')
        .select('saldo_cuenta_corriente')
        .eq('tenant_id', tenantId!)
        .eq('tiene_cuenta_corriente', true)
        .lt('saldo_cuenta_corriente', 0);

      const pendingSettlement = sellers?.reduce(
        (sum, s) => sum + Math.abs(s.saldo_cuenta_corriente || 0), 0
      ) || 0;

      // Count by status
      const ordersByStatus: OrdersByStatus = {
        pending: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
      };

      orders?.forEach(order => {
        const status = order.fulfillment_status || 'pending';
        if (status in ordersByStatus) {
          ordersByStatus[status as keyof OrdersByStatus]++;
        }
      });

      return {
        totalOrders: orders?.length || 0,
        totalRevenue: orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
        activeSellers: activeSellers || 0,
        pendingSettlement,
        ordersByStatus,
      };
    },
    enabled: !!tenantId,
  });

  // Recent orders
  const { data: recentOrders, isLoading: ordersLoading } = useQuery<RecentOrder[]>({
    queryKey: ['ecommerce-recent-orders', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ecommerce_orders')
        .select('id, external_order_number, buyer_name, total, fulfillment_status, created_at, seller:ecommerce_sellers(nombre)')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(5);
      return (data as unknown as RecentOrder[]) || [];
    },
    enabled: !!tenantId,
  });

  // Top sellers
  const { data: topSellers, isLoading: topSellersLoading } = useQuery<TopSeller[]>({
    queryKey: ['ecommerce-top-sellers', tenantId],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('ecommerce_orders')
        .select('seller_id, total, seller:ecommerce_sellers(nombre)')
        .eq('tenant_id', tenantId!)
        .gte('created_at', startOfMonth.toISOString());

      // Group by seller
      const grouped: Record<string, { nombre: string; count: number; total: number }> = {};
      data?.forEach((order: any) => {
        const id = order.seller_id;
        if (!grouped[id]) {
          grouped[id] = { 
            nombre: order.seller?.nombre || 'Sin nombre', 
            count: 0, 
            total: 0 
          };
        }
        grouped[id].count++;
        grouped[id].total += order.total || 0;
      });

      return Object.entries(grouped)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
    enabled: !!tenantId,
  });

  // Seller balances
  const { data: sellerBalances, isLoading: balancesLoading } = useQuery<SellerBalance[]>({
    queryKey: ['ecommerce-seller-balances', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ecommerce_sellers')
        .select('id, nombre, saldo_cuenta_corriente')
        .eq('tenant_id', tenantId!)
        .eq('tiene_cuenta_corriente', true)
        .neq('saldo_cuenta_corriente', 0)
        .order('saldo_cuenta_corriente', { ascending: true })
        .limit(10);
      return data?.map(s => ({
        id: s.id,
        nombre: s.nombre,
        saldo: s.saldo_cuenta_corriente || 0,
      })) || [];
    },
    enabled: !!tenantId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  // Prepare chart data
  const chartData = stats ? Object.entries(stats.ordersByStatus)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({
      name: FULFILLMENT_LABELS[key],
      value,
      fill: FULFILLMENT_COLORS[key],
    })) : [];

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard e-Commerce</h1>
        <p className="text-muted-foreground">
          Resumen del módulo de fulfillment para tiendas online
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos del Mes</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">pedidos recibidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sellers Activos</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.activeSellers || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">tiendas conectadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground">en pedidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendiente Liquidar</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(stats?.pendingSettlement || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">deudas de sellers</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Orders by Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pedidos por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-center h-[250px]">
                <Skeleton className="h-40 w-40 rounded-full" />
              </div>
            ) : chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                <Package className="h-12 w-12 mb-2 opacity-50" />
                <p>Sin pedidos este mes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Últimos Pedidos</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/ecommerce/orders">
                Ver todos <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        #{order.external_order_number || order.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.buyer_name} • {order.seller?.nombre}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-medium text-sm">{formatCurrency(order.total || 0)}</p>
                      <Badge variant="secondary" className="text-xs">
                        {FULFILLMENT_LABELS[order.fulfillment_status || 'pending']}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mb-2 opacity-50" />
                <p>Sin pedidos recientes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Sellers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Top Sellers del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSellersLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : topSellers && topSellers.length > 0 ? (
              <div className="space-y-3">
                {topSellers.map((seller, index) => (
                  <div key={seller.id} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{seller.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {seller.count} pedidos
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatCurrency(seller.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <Store className="h-12 w-12 mb-2 opacity-50" />
                <p>Sin sellers con pedidos</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seller Balances */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Saldos por Seller
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/ecommerce/settlements">
                Ver todos <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {balancesLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sellerBalances && sellerBalances.length > 0 ? (
              <div className="space-y-3">
                {sellerBalances.map((seller) => (
                  <div key={seller.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <p className="font-medium text-sm truncate flex-1">{seller.nombre}</p>
                    <span className={`font-bold text-sm ${seller.saldo < 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {seller.saldo < 0 ? '-' : '+'}{formatCurrency(Math.abs(seller.saldo))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <Wallet className="h-12 w-12 mb-2 opacity-50" />
                <p>Sin saldos pendientes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
