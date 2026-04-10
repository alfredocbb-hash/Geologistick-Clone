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

      const dayIndices = [6, 5, 4, 3, 2, 1, 0];
      const queries = dayIndices.flatMap((i) => {
        const dateStr = formatDateString(subDays(new Date(), i));
        const nextDateStr = formatDateString(subDays(new Date(), i - 1));

        return [
          supabase
            .from('envios')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .gte('created_at', dateStr)
            .lt('created_at', nextDateStr)
            .not('estado', 'in', '(cancelado,devuelto)'),
          supabase
            .from('envios')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('estado', 'entregado')
            .gte('fecha_entrega', dateStr)
            .lt('fecha_entrega', nextDateStr),
        ];
      });

      const results = await Promise.all(queries);

      return dayIndices.map((i, idx) => {
        const date = subDays(new Date(), i);
        return {
          day: format(date, 'EEE', { locale: es }),
          date: format(date, 'dd/MM'),
          envios: results[idx * 2].count || 0,
          entregados: results[idx * 2 + 1].count || 0,
        };
      });
    },
    enabled: !!tenantId,
  });

  return (
    <Card variant="glass" className="glow-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))]">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
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
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="colorEntregados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card) / 0.9)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid hsl(var(--border) / 0.5)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  boxShadow: '0 8px 32px hsl(var(--foreground) / 0.1)',
                }}
              />
              <Area
                type="monotone"
                dataKey="envios"
                name="Creados"
                stroke="hsl(var(--primary))"
                fill="url(#colorEnvios)"
                strokeWidth={2.5}
              />
              <Area
                type="monotone"
                dataKey="entregados"
                name="Entregados"
                stroke="hsl(var(--success))"
                fill="url(#colorEntregados)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
