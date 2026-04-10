import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Truck, DollarSign, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getTodayString, formatDateString } from '@/lib/dateUtils';
import { subDays } from 'date-fns';

interface Props {
  tenantId: string | null;
}

export default function DashboardStatsCards({ tenantId }: Props) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', tenantId, 'v3'],
    queryFn: async () => {
      if (!tenantId) return null;

      const today = getTodayString();
      const yesterday = formatDateString(subDays(new Date(), 1));

      const [
        { count: todayShipments },
        { count: yesterdayShipments },
        { count: inTransit },
        { data: revenueResult },
        { data: revenueYesterdayResult },
        { data: activeDrivers },
      ] = await Promise.all([
        supabase
          .from('envios')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', today)
          .not('estado', 'in', '(cancelado,devuelto)'),
        supabase
          .from('envios')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', yesterday)
          .lt('created_at', today)
          .not('estado', 'in', '(cancelado,devuelto)'),
        supabase
          .from('envios')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('estado', ['en_transito', 'en_reparto']),
        (supabase.rpc as any)('get_daily_revenue', {
          p_tenant_id: tenantId,
          p_date: today,
        }),
        (supabase.rpc as any)('get_daily_revenue', {
          p_tenant_id: tenantId,
          p_date: yesterday,
        }),
        supabase
          .from('rutas_planificadas')
          .select('chofer_id')
          .eq('tenant_id', tenantId)
          .eq('fecha', today)
          .eq('estado', 'en_curso'),
      ]);

      const revenue = Number(revenueResult) || 0;
      const revenueYesterday = Number(revenueYesterdayResult) || 0;
      const uniqueDrivers = new Set(activeDrivers?.map((r) => r.chofer_id).filter(Boolean)).size;

      return {
        todayShipments: todayShipments || 0,
        yesterdayShipments: yesterdayShipments || 0,
        inTransit: inTransit || 0,
        revenue,
        revenueYesterday,
        activeDrivers: uniqueDrivers,
      };
    },
    enabled: !!tenantId,
  });

  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const shipmentTrend = stats ? calcTrend(stats.todayShipments, stats.yesterdayShipments) : 0;
  const revenueTrend = stats ? calcTrend(stats.revenue, stats.revenueYesterday) : 0;

  const TrendBadge = ({ value }: { value: number }) => {
    if (value === 0) return (
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
    const isUp = value > 0;
    return (
      <span className={`flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-success' : 'text-destructive'}`}>
        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isUp ? '+' : ''}{value}%
      </span>
    );
  };

  const statsConfig = [
    {
      title: 'Envíos Hoy',
      value: stats?.todayShipments ?? 0,
      icon: Package,
      gradient: 'from-[hsl(var(--envios))] to-[hsl(var(--geo-cyan))]',
      trend: shipmentTrend,
      hasTrend: true,
    },
    {
      title: 'En Tránsito',
      value: stats?.inTransit ?? 0,
      icon: Truck,
      gradient: 'from-[hsl(var(--chofer))] to-[hsl(160,84%,39%)]',
      hasTrend: false,
    },
    {
      title: 'Ingresos del Día',
      value: `$${(stats?.revenue ?? 0).toLocaleString()}`,
      icon: DollarSign,
      gradient: 'from-[hsl(var(--caja))] to-[hsl(var(--tarifas))]',
      trend: revenueTrend,
      hasTrend: true,
    },
    {
      title: 'Choferes Activos',
      value: stats?.activeDrivers ?? 0,
      icon: Users,
      gradient: 'from-[hsl(var(--comisiones))] to-[hsl(var(--pagos))]',
      hasTrend: false,
    },
  ];

  const delayClasses = ['', 'animate-slide-up-delay-1', 'animate-slide-up-delay-2', 'animate-slide-up-delay-3'];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statsConfig.map((stat, idx) => (
        <Card
          key={stat.title}
          variant="glass"
          className={`overflow-hidden glow-hover animate-slide-up ${delayClasses[idx]}`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} icon-glow`}>
              <stat.icon className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold tracking-tight">{stat.value}</span>
                {stat.hasTrend && <TrendBadge value={stat.trend ?? 0} />}
              </div>
            )}
            {stat.hasTrend && !isLoading && (
              <p className="text-xs text-muted-foreground mt-1">vs. ayer</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
