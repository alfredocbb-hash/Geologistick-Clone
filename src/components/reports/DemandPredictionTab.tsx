import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useDemandPrediction } from '@/hooks/useDemandPrediction';

const tendenciaConfig = {
  creciendo: { icon: TrendingUp, label: 'Creciendo', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  estable: { icon: Minus, label: 'Estable', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  bajando: { icon: TrendingDown, label: 'Bajando', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

export default function DemandPredictionTab() {
  const { data, isLoading, error, fetchPrediction } = useDemandPrediction();

  const chartData = (data?.predicciones || []).slice(0, 10).map((p) => ({
    zona: p.zona.length > 12 ? p.zona.slice(0, 12) + '…' : p.zona,
    'Promedio histórico': p.promedio_historico,
    'Día 1': p.dia1,
    'Día 2': p.dia2,
    'Día 3': p.dia3,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">
            Predicción de demanda basada en IA usando datos de los últimos 90 días
          </span>
        </div>
        <Button onClick={fetchPrediction} disabled={isLoading} size="sm">
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {data ? 'Actualizar predicción' : 'Generar predicción'}
        </Button>
      </div>

      {/* Empty state */}
      {!data && !isLoading && !error && (
        <Card>
          <CardContent className="py-16 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Predicción de Demanda por Zona</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              Analiza los datos históricos de tus envíos con IA para predecir el volumen esperado por zona en los próximos 3 días.
            </p>
            <Button onClick={fetchPrediction}>
              <Brain className="h-4 w-4 mr-2" />
              Generar predicción
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {data && !isLoading && (
        <>
          {/* Summary */}
          {data.resumen && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground italic">{data.resumen}</p>
                {data.generado_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Generado: {new Date(data.generado_at).toLocaleString('es-AR')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Predicción vs Promedio Histórico (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="zona" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={70} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Promedio histórico" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Día 1" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Día 2" fill="hsl(var(--chart-2, 160 60% 45%))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Día 3" fill="hsl(var(--chart-3, 30 80% 55%))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle por Zona</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zona</TableHead>
                    <TableHead className="text-right">Prom. Histórico</TableHead>
                    <TableHead className="text-right">
                      {data.dias?.[0]?.name} {data.dias?.[0]?.date?.slice(5)}
                    </TableHead>
                    <TableHead className="text-right">
                      {data.dias?.[1]?.name} {data.dias?.[1]?.date?.slice(5)}
                    </TableHead>
                    <TableHead className="text-right">
                      {data.dias?.[2]?.name} {data.dias?.[2]?.date?.slice(5)}
                    </TableHead>
                    <TableHead>Tendencia</TableHead>
                    <TableHead className="text-right">Confianza</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.predicciones.map((p, i) => {
                    const t = tendenciaConfig[p.tendencia] || tendenciaConfig.estable;
                    const Icon = t.icon;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{p.zona}</TableCell>
                        <TableCell className="text-right">{p.promedio_historico}</TableCell>
                        <TableCell className="text-right font-medium">{p.dia1}</TableCell>
                        <TableCell className="text-right font-medium">{p.dia2}</TableCell>
                        <TableCell className="text-right font-medium">{p.dia3}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`gap-1 ${t.className}`}>
                            <Icon className="h-3 w-3" />
                            {t.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={p.confianza >= 0.7 ? 'default' : 'secondary'}>
                            {Math.round(p.confianza * 100)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {data.predicciones.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No hay predicciones disponibles
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
