import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { getTodayString } from '@/lib/dateUtils';

interface Props {
  tenantId: string | null;
}

export default function DashboardDaySummary({ tenantId }: Props) {
  const { data: dailySummary } = useQuery({
    queryKey: ['daily-summary', tenantId, 'v2'],
    queryFn: async () => {
      if (!tenantId) return null;
      const today = getTodayString();

      const { count: deliveredToday } = await supabase
        .from('envios')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('estado', 'entregado')
        .gte('fecha_entrega', today);

      const { count: pending } = await supabase
        .from('envios')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('estado', 'pendiente');

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

  const items = [
    {
      icon: CheckCircle,
      label: 'Entregas Completadas',
      sublabel: 'Completadas hoy',
      value: dailySummary?.delivered ?? 0,
      gradient: 'from-[hsl(var(--success))] to-[hsl(160,84%,39%)]',
      bgClass: 'bg-success/5 border-success/20 hover:bg-success/10',
    },
    {
      icon: Clock,
      label: 'Envíos Pendientes',
      sublabel: 'Esperando asignación',
      value: dailySummary?.pending ?? 0,
      gradient: 'from-[hsl(var(--warning))] to-[hsl(var(--tarifas))]',
      bgClass: 'bg-warning/5 border-warning/20 hover:bg-warning/10',
    },
    {
      icon: AlertCircle,
      label: 'Incidencias',
      sublabel: 'Requieren atención',
      value: dailySummary?.incidents ?? 0,
      gradient: 'from-[hsl(var(--destructive))] to-[hsl(var(--pagos))]',
      bgClass: 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10',
    },
  ];

  return (
    <Card variant="glass" className="glow-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(160,84%,39%)]">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          Resumen del Día
        </CardTitle>
        <CardDescription>Estado general de la operación</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${item.bgClass}`}>
              <div className={`p-2 rounded-lg bg-gradient-to-br ${item.gradient}`}>
                <item.icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {item.value} {item.label}
                </p>
                <p className="text-sm text-muted-foreground">{item.sublabel}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
