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
      colorClass: 'text-success',
      bgClass: 'bg-success/10 border-success/20',
    },
    {
      icon: Clock,
      label: 'Envíos Pendientes',
      sublabel: 'Esperando asignación',
      value: dailySummary?.pending ?? 0,
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10 border-warning/20',
    },
    {
      icon: AlertCircle,
      label: 'Incidencias',
      sublabel: 'Requieren atención',
      value: dailySummary?.incidents ?? 0,
      colorClass: 'text-destructive',
      bgClass: 'bg-destructive/10 border-destructive/20',
    },
  ];

  return (
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
          {items.map((item) => (
            <div key={item.label} className={`flex items-center gap-4 p-4 rounded-lg border ${item.bgClass}`}>
              <item.icon className={`h-8 w-8 ${item.colorClass}`} />
              <div>
                <p className={`font-semibold ${item.colorClass}`}>
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
