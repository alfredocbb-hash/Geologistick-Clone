import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trophy, Zap, Clock, Target } from 'lucide-react';
import type { ProductividadChofer } from '@/hooks/useProductividadData';

interface Props {
  data: ProductividadChofer[] | undefined;
  isLoading: boolean;
}

export default function ProductividadTab({ data, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const items = data || [];
  const best = items[0];

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      {best && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mejor Chofer</p>
                  <p className="font-semibold truncate">{best.chofer_nombre}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Mejor Entregas/h</p>
                  <p className="text-2xl font-bold">{best.entregas_por_hora}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Promedio Efectividad</p>
                  <p className="text-2xl font-bold">
                    {items.length > 0 ? Math.round(items.reduce((s, c) => s + c.efectividad, 0) / items.length) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">T. Promedio Global</p>
                  <p className="text-2xl font-bold">
                    {(() => {
                      const withTime = items.filter(i => i.tiempo_promedio_minutos != null);
                      return withTime.length > 0 ? `${Math.round(withTime.reduce((s, c) => s + c.tiempo_promedio_minutos!, 0) / withTime.length)} min` : 'N/A';
                    })()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ranking Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Ranking: Entregas por Hora</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.slice(0, 10).map((row, i) => (
              <div key={row.chofer_id} className="flex items-center gap-3">
                <span className={`text-lg font-bold w-8 text-center ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate">{row.chofer_nombre}</span>
                    <span className="text-sm font-mono">{row.entregas_por_hora} ent/h</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${items[0]?.entregas_por_hora ? (row.entregas_por_hora / items[0].entregas_por_hora) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <Badge variant={row.efectividad >= 80 ? 'default' : row.efectividad >= 50 ? 'secondary' : 'destructive'} className="w-14 justify-center">
                  {row.efectividad}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {items.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Comparativo de Productividad</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={items.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="chofer_nombre" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={80} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="entregas_por_hora" fill="hsl(var(--primary))" name="Entregas/hora" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="entregados" fill="hsl(var(--chart-2, 160 60% 45%))" name="Total Entregados" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Chofer</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Entregados</TableHead>
                <TableHead className="text-right">Efectividad</TableHead>
                <TableHead className="text-right">Horas Reparto</TableHead>
                <TableHead className="text-right">Entregas/h</TableHead>
                <TableHead className="text-right">T. Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row, i) => (
                <TableRow key={row.chofer_id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{row.chofer_nombre}</TableCell>
                  <TableCell className="text-right">{row.total}</TableCell>
                  <TableCell className="text-right">{row.entregados}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={row.efectividad >= 80 ? 'default' : row.efectividad >= 50 ? 'secondary' : 'destructive'}>
                      {row.efectividad}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.horas_reparto}h</TableCell>
                  <TableCell className="text-right font-mono font-bold">{row.entregas_por_hora}</TableCell>
                  <TableCell className="text-right">{row.tiempo_promedio_minutos != null ? `${row.tiempo_promedio_minutos} min` : '-'}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No hay datos para el período seleccionado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
