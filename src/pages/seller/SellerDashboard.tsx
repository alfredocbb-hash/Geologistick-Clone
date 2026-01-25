import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSellerData } from '@/hooks/useSellerData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, Package, Wallet, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  pendiente: '#f59e0b',
  en_transito: '#3b82f6',
  en_reparto: '#8b5cf6',
  entregado: '#22c55e',
  devuelto: '#ef4444',
  cancelado: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_transito: 'En tránsito',
  en_reparto: 'En reparto',
  entregado: 'Entregado',
  devuelto: 'Devuelto',
  cancelado: 'Cancelado',
};

export default function SellerDashboard() {
  const { seller, ordersCount, shipmentsInTransit, movements, isLoading } = useSellerData();

  // Get recent orders
  const { data: recentOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['seller-recent-orders', seller?.id],
    queryFn: async () => {
      if (!seller?.id) return [];
      
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select('id, external_order_number, buyer_name, total, fulfillment_status, created_at')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!seller?.id,
  });

  // Get shipment stats by status
  const { data: shipmentStats } = useQuery({
    queryKey: ['seller-shipment-stats', seller?.id],
    queryFn: async () => {
      if (!seller?.id) return [];
      
      const { data, error } = await supabase
        .from('envios')
        .select('estado')
        .eq('remitente_id', seller.id);
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach((e) => {
        const status = e.estado || 'pendiente';
        counts[status] = (counts[status] || 0) + 1;
      });
      
      return Object.entries(counts).map(([name, value]) => ({
        name: STATUS_LABELS[name] || name,
        value,
        color: STATUS_COLORS[name] || '#6b7280',
      }));
    },
    enabled: !!seller?.id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const lastMovement = movements[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">¡Hola, {seller?.nombre}!</h1>
        <p className="text-muted-foreground">
          Resumen de tu actividad logística
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pendientes</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordersCount.pending}</div>
            <p className="text-xs text-muted-foreground">
              {ordersCount.total} este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Envíos en Tránsito</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shipmentsInTransit}</div>
            <p className="text-xs text-muted-foreground">
              En camino a destino
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo Cuenta</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {seller?.tiene_cuenta_corriente 
                ? formatCurrency(seller.saldo_cuenta_corriente)
                : '-'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {seller?.saldo_cuenta_corriente && seller.saldo_cuenta_corriente > 0 
                ? 'A tu favor' 
                : seller?.saldo_cuenta_corriente && seller.saldo_cuenta_corriente < 0 
                  ? 'Deuda pendiente' 
                  : 'Sin movimientos'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Último Movimiento</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastMovement ? formatCurrency(Math.abs(lastMovement.monto)) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {lastMovement 
                ? format(new Date(lastMovement.created_at), 'dd MMM', { locale: es })
                : 'Sin movimientos'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shipment Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Estado de Envíos</CardTitle>
            <CardDescription>Distribución por estado actual</CardDescription>
          </CardHeader>
          <CardContent>
            {shipmentStats && shipmentStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={shipmentStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {shipmentStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Sin envíos registrados
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Últimos Pedidos</CardTitle>
              <CardDescription>Pedidos recientes de tu tienda</CardDescription>
            </div>
            <Link 
              to="/seller/orders" 
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        #{order.external_order_number || order.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">{order.buyer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatCurrency(order.total)}</p>
                      <Badge 
                        variant={order.fulfillment_status === 'shipped' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {order.fulfillment_status === 'pending' ? 'Pendiente' :
                         order.fulfillment_status === 'shipped' ? 'Enviado' :
                         order.fulfillment_status === 'delivered' ? 'Entregado' :
                         order.fulfillment_status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sin pedidos recientes
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
