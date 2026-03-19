import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Fuel, Route, DollarSign, TrendingDown } from 'lucide-react';
import type { CostosResumen } from '@/hooks/useCostosData';

interface Props {
  data: CostosResumen | undefined;
  isLoading: boolean;
}

export default function CostosTab({ data, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const costos = data;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Route className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Km Totales</p>
                <p className="text-2xl font-bold">{costos?.km_totales || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Fuel className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Combustible Est.</p>
                <p className="text-2xl font-bold">${(costos?.combustible_total || 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Costo/Entrega</p>
                <p className="text-2xl font-bold">${costos?.costo_promedio_entrega || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entregas Totales</p>
                <p className="text-2xl font-bold">{costos?.total_entregas || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
        💡 Estimaciones basadas en consumo promedio de 12L/100km y $1.200/litro. Los valores reales pueden variar.
      </div>

      {/* Chart */}
      {(costos?.por_chofer || []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Costo por Entrega por Chofer</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={(costos?.por_chofer || []).slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="chofer_nombre" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
                <Bar dataKey="costo_por_entrega" fill="hsl(var(--destructive))" name="Costo/Entrega" radius={[4, 4, 0, 0]} />
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
                <TableHead>Chofer</TableHead>
                <TableHead className="text-right">Km</TableHead>
                <TableHead className="text-right">Entregas</TableHead>
                <TableHead className="text-right">Combustible Est.</TableHead>
                <TableHead className="text-right">Costo/Entrega</TableHead>
                <TableHead className="text-right">Costo/Km</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(costos?.por_chofer || []).map(row => (
                <TableRow key={row.chofer_id}>
                  <TableCell className="font-medium">{row.chofer_nombre}</TableCell>
                  <TableCell className="text-right">{row.km_totales}</TableCell>
                  <TableCell className="text-right">{row.entregas}</TableCell>
                  <TableCell className="text-right">${row.combustible_estimado.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">${row.costo_por_entrega.toLocaleString()}</TableCell>
                  <TableCell className="text-right">${row.costo_por_km}</TableCell>
                </TableRow>
              ))}
              {(costos?.por_chofer || []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay datos de rutas/distancias para el período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
