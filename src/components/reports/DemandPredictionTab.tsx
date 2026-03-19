import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { DemandPoint } from '@/hooks/useDemandPrediction';
import type { UseQueryResult } from '@tanstack/react-query';

interface Props {
  data: UseQueryResult<DemandPoint[], Error>;
}

export function DemandPredictionTab({ data }: Props) {
  if (data.isLoading) return <Skeleton className="h-64 w-full" />;

  const points = data.data || [];
  const historicos = points.filter(p => !p.es_prediccion);
  const predicciones = points.filter(p => p.es_prediccion);
  const avgHistorico = historicos.length > 0
    ? Math.round(historicos.reduce((s, p) => s + p.cantidad, 0) / historicos.length)
    : 0;
  const avgPrediccion = predicciones.length > 0
    ? Math.round(predicciones.reduce((s, p) => s + p.cantidad, 0) / predicciones.length)
    : 0;

  // For the chart, split into two series
  const chartData = points.map(p => ({
    fecha: p.fecha.substring(5), // MM-DD
    historico: !p.es_prediccion ? p.cantidad : undefined,
    prediccion: p.es_prediccion ? p.cantidad : undefined,
    cantidad: p.cantidad,
  }));

  // Add bridge point: last historic = first prediction
  let lastHistIdx = -1;
  for (let i = chartData.length - 1; i >= 0; i--) {
    if (chartData[i].historico !== undefined) { lastHistIdx = i; break; }
  }
  if (lastHistIdx >= 0 && lastHistIdx + 1 < chartData.length) {
    chartData[lastHistIdx + 1].prediccion = chartData[lastHistIdx].historico;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">Promedio diario (30 días)</p>
            <p className="text-3xl font-bold">{avgHistorico}</p>
            <p className="text-xs text-muted-foreground">envíos/día</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">Predicción próx. 7 días</p>
            <p className="text-3xl font-bold text-primary">{avgPrediccion}</p>
            <p className="text-xs text-muted-foreground">envíos/día estimados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">Tendencia</p>
            <p className="text-3xl font-bold">
              {avgPrediccion > avgHistorico ? '📈' : avgPrediccion < avgHistorico ? '📉' : '➡️'}
            </p>
            <Badge variant={avgPrediccion >= avgHistorico ? 'default' : 'destructive'}>
              {avgPrediccion >= avgHistorico ? 'Crecimiento' : 'Descenso'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Demanda histórica + Predicción
            <Badge variant="outline" className="text-xs">Promedio móvil 7 días</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <ReferenceLine y={avgHistorico} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" label={{ value: `Prom: ${avgHistorico}`, position: 'right', fontSize: 11 }} />
              <Line type="monotone" dataKey="historico" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Histórico" connectNulls={false} />
              <Line type="monotone" dataKey="prediccion" stroke="hsl(var(--chart-2, 160 60% 45%))" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Predicción" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
