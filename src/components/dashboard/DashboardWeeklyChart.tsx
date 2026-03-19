import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { subDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDateString } from '@/lib/dateUtils';

interface Props {
  tenantId: string | null;
}

export default function DashboardWeeklyChart({ tenantId }: Props) {
  const { data: weeklyData, isLoading } = useQuery({
    queryKey: ['dashboard-weekly', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = formatDateString(date);
        const nextDateStr = formatDateString(subDays(new Date(), i - 1));

        const { count: envios } = await supabase
          .from('envios')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('created_at', dateStr)
          .lt('created_at', i === 0 ? formatDateString(subDays(new Date(), -1)) : nextDateStr)
          .not('estado', 'in', '(cancelado,devuelto)');

        const { count: entregados } = await supabase
          .from('envios')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('estado', 'entregado')
          .gte('fecha_entrega', dateStr)
          .lt('fecha_entrega', i === 0 ? formatDateString(subDays(new Date(), -1)) : nextDateStr);

        days.push({
          day: format(date, 'EEE', { locale: es }),
          date: format(date, 'dd/MM'),
          envios: envios || 0,
          entregados: entregados || 0,
        });
      }
      return days;
    },
    enabled: !!tenantId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Evolución Semanal
        </CardTitle>
        <CardDescription>Envíos creados vs entregados, últimos 7 días</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="colorEnvios" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorEntregados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="envios"
                name="Creados"
                stroke="hsl(var(--primary))"
                fill="url(#colorEnvios)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="entregados"
                name="Entregados"
                stroke="hsl(var(--success))"
                fill="url(#colorEntregados)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
