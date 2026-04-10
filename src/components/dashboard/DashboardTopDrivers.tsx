import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { subDays } from 'date-fns';
import { formatDateString } from '@/lib/dateUtils';

interface Props {
  tenantId: string | null;
}

interface DriverPerf {
  nombre: string;
  entregados: number;
  total: number;
  porcentaje: number;
}

export default function DashboardTopDrivers({ tenantId }: Props) {
  const { data: drivers, isLoading } = useQuery({
    queryKey: ['dashboard-top-drivers', tenantId],
    queryFn: async (): Promise<DriverPerf[]> => {
      if (!tenantId) return [];

      const weekAgo = formatDateString(subDays(new Date(), 7));

      const { data: shipments } = await supabase
        .from('envios')
        .select('chofer_id, estado')
        .eq('tenant_id', tenantId)
        .not('chofer_id', 'is', null)
        .gte('created_at', weekAgo)
        .limit(1000);

      if (!shipments || shipments.length === 0) return [];

      const driverMap = new Map<string, { entregados: number; total: number }>();
      for (const s of shipments) {
        if (!s.chofer_id) continue;
        const existing = driverMap.get(s.chofer_id) || { entregados: 0, total: 0 };
        existing.total++;
        if (s.estado === 'entregado') existing.entregados++;
        driverMap.set(s.chofer_id, existing);
      }

      const driverIds = Array.from(driverMap.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nombre, apellido')
        .in('user_id', driverIds);

      const nameMap = new Map<string, string>();
      profiles?.forEach((p) => {
        nameMap.set(p.user_id, [p.nombre, p.apellido].filter(Boolean).join(' ') || 'Sin nombre');
      });

      return Array.from(driverMap.entries())
        .map(([id, stats]) => ({
          nombre: nameMap.get(id) || 'Chofer',
          entregados: stats.entregados,
          total: stats.total,
          porcentaje: stats.total > 0 ? Math.round((stats.entregados / stats.total) * 100) : 0,
        }))
        .sort((a, b) => b.entregados - a.entregados)
        .slice(0, 5);
    },
    enabled: !!tenantId,
  });

  return (
    <Card variant="glass" className="glow-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-[hsl(var(--comisiones))] to-[hsl(var(--pagos))]">
            <Users className="h-4 w-4 text-white" />
          </div>
          Top Choferes
        </CardTitle>
        <CardDescription>Rendimiento últimos 7 días</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : drivers && drivers.length > 0 ? (
          <div className="space-y-3">
            {drivers.map((driver, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--primary)/0.2)] to-[hsl(var(--accent)/0.2)] text-primary text-xs font-bold">
                    {driver.nombre.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium truncate">{driver.nombre}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {driver.entregados}/{driver.total}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--success))] transition-all duration-500"
                      style={{ width: `${driver.porcentaje}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-bold text-success w-12 text-right">
                  {driver.porcentaje}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin actividad de choferes</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
