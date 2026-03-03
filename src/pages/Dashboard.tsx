import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useTenant } from '@/hooks/useTenant';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Package, Truck, DollarSign, Users, TrendingUp, Clock, CheckCircle, AlertCircle, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getTodayString } from '@/lib/dateUtils';
import SendBranchNotificationDialog from '@/components/notifications/SendBranchNotificationDialog';

export default function Dashboard() {
  const { profile, roles } = useAuth();
  const { tenantId } = useTenant();
  const [notifDialogOpen, setNotifDialogOpen] = useState(false);
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');

  // Fetch real stats - v2 forces cache invalidation
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', tenantId, 'v2'],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const today = getTodayString();
      
      // Envíos de hoy (excluir cancelados/devueltos)
      const { count: todayShipments } = await supabase
        .from('envios')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', today)
        .not('estado', 'in', '(cancelado,devuelto)');

      // En tránsito
      const { count: inTransit } = await supabase
        .from('envios')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('estado', ['en_transito', 'en_reparto']);

      // Ingresos del día (excluir cancelados/devueltos)
      const { data: todayRevenue } = await supabase
        .from('envios')
        .select('precio_total')
        .eq('tenant_id', tenantId)
        .gte('created_at', today)
        .not('estado', 'in', '(cancelado,devuelto)');
      
      const revenue = todayRevenue?.reduce((sum, e) => sum + (e.precio_total || 0), 0) || 0;

      // Choferes activos (con rutas hoy)
      const { data: activeDrivers } = await supabase
        .from('rutas_planificadas')
        .select('chofer_id')
        .eq('tenant_id', tenantId)
        .eq('fecha', today)
        .eq('estado', 'en_curso');
      
      const uniqueDrivers = new Set(activeDrivers?.map(r => r.chofer_id).filter(Boolean)).size;

      return {
        todayShipments: todayShipments || 0,
        inTransit: inTransit || 0,
        revenue,
        activeDrivers: uniqueDrivers,
      };
    },
    enabled: !!tenantId,
  });

  // Fetch recent shipments - v2 forces cache invalidation
  const { data: recentShipments, isLoading: shipmentsLoading } = useQuery({
    queryKey: ['recent-shipments', tenantId, 'v2'],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data } = await supabase
        .from('envios')
        .select('tracking_number, estado, direccion_entrega, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch daily summary - v2 forces cache invalidation
  const { data: dailySummary } = useQuery({
    queryKey: ['daily-summary', tenantId, 'v2'],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const today = getTodayString();
      
      // Entregas completadas hoy
      const { count: deliveredToday } = await supabase
        .from('envios')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('estado', 'entregado')
        .gte('fecha_entrega', today);

      // Pendientes
      const { count: pending } = await supabase
        .from('envios')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('estado', 'pendiente');

      // Incidencias
      const { count: incidents } = await supabase
        .from('incidentes')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('estado', 'abierto');

      return {
        delivered: deliveredToday || 0,
        pending: pending || 0,
        incidents: incidents || 0,
      };
    },
    enabled: !!tenantId,
  });

  const statsConfig = [
    {
      title: 'Envíos Hoy',
      value: stats?.todayShipments ?? 0,
      icon: Package,
      color: 'bg-shipments',
    },
    {
      title: 'En Tránsito',
      value: stats?.inTransit ?? 0,
      icon: Truck,
      color: 'bg-drivers',
    },
    {
      title: 'Ingresos del Día',
      value: `$${(stats?.revenue ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-cash',
    },
    {
      title: 'Choferes Activos',
      value: stats?.activeDrivers ?? 0,
      icon: Users,
      color: 'bg-commissions',
    },
  ];

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pendiente: { label: 'Pendiente', variant: 'secondary' },
      en_transito: { label: 'En Tránsito', variant: 'default' },
      en_reparto: { label: 'En Reparto', variant: 'outline' },
      entregado: { label: 'Entregado', variant: 'default' },
    };
    const { label, variant } = config[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            ¡Hola, {profile?.nombre || 'Usuario'}! 👋
          </h1>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setNotifDialogOpen(true)}>
              <Bell className="h-4 w-4 mr-2" />
              Enviar Notificación
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          Aquí está el resumen de tu operación logística de hoy.
        </p>
        <div className="flex gap-2 mt-2">
          {roles.map((role) => (
            <Badge key={role} variant="outline" className="capitalize">
              {role.replace('_', ' ')}
            </Badge>
          ))}
        </div>
      </div>

      <SendBranchNotificationDialog open={notifDialogOpen} onOpenChange={setNotifDialogOpen} />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsConfig.map((stat) => (
          <Card key={stat.title} className="card-hover overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <span className="text-3xl font-bold">{stat.value}</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Shipments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-shipments" />
              Envíos Recientes
            </CardTitle>
            <CardDescription>Los últimos movimientos del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {shipmentsLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentShipments && recentShipments.length > 0 ? (
              <div className="space-y-4">
                {recentShipments.map((shipment) => (
                  <div
                    key={shipment.tracking_number}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-sm font-medium">{shipment.tracking_number}</span>
                      <span className="text-xs text-muted-foreground">{shipment.direccion_entrega}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(shipment.estado || 'pendiente')}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(shipment.created_at), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Sin envíos recientes</p>
                <p className="text-sm">Los envíos aparecerán aquí</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions / Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Resumen del Día
            </CardTitle>
            <CardDescription>Estado general de la operación</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-success/10 border border-success/20">
                <CheckCircle className="h-8 w-8 text-success" />
                <div>
                  <p className="font-semibold text-success">
                    {dailySummary?.delivered ?? 0} Entregas Completadas
                  </p>
                  <p className="text-sm text-muted-foreground">Completadas hoy</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 rounded-lg bg-warning/10 border border-warning/20">
                <Clock className="h-8 w-8 text-warning" />
                <div>
                  <p className="font-semibold text-warning">
                    {dailySummary?.pending ?? 0} Envíos Pendientes
                  </p>
                  <p className="text-sm text-muted-foreground">Esperando asignación</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">
                    {dailySummary?.incidents ?? 0} Incidencias
                  </p>
                  <p className="text-sm text-muted-foreground">Requieren atención</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
