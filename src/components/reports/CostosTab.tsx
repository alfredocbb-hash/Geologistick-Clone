import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, DollarSign, Navigation, TrendingUp } from 'lucide-react';
import type { CostoRuta, ResumenCostos } from '@/hooks/useCostosData';
import type { UseQueryResult } from '@tanstack/react-query';

interface Props {
  rutas: UseQueryResult<CostoRuta[], Error>;
  resumen: UseQueryResult<ResumenCostos, Error>;
}

export function CostosTab({ rutas, resumen }: Props) {
  if (rutas.isLoading || resumen.isLoading) return <Skeleton className="h-64 w-full" />;

  const r = resumen.data;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Package, label: 'Total Envíos', value: r?.totalEnvios || 0 },
          { icon: DollarSign, label: 'Ingresos', value: `$${(r?.ingresosTotales || 0).toLocaleString()}` },
          { icon: TrendingUp, label: 'Costo Prom./Envío', value: `$${r?.costoPromedioPorEnvio || 0}` },
          { icon: Navigation, label: 'Ingreso/km', value: `$${r?.ingresoPorKm || 0}` },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <kpi.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Ingresos por Sucursal/Ruta</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={(rutas.data || []).slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ruta_nombre" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="ingresos" fill="hsl(var(--primary))" name="Ingresos ($)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sucursal</TableHead>
                <TableHead className="text-right">Envíos</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Distancia (km)</TableHead>
                <TableHead className="text-right">$/Envío</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rutas.data || []).map(row => (
                <TableRow key={row.ruta_id}>
                  <TableCell className="font-medium">{row.ruta_nombre}</TableCell>
                  <TableCell className="text-right">{row.total_envios}</TableCell>
                  <TableCell className="text-right">${row.ingresos.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{row.distancia_km}</TableCell>
                  <TableCell className="text-right">${row.costo_por_envio}</TableCell>
                </TableRow>
              ))}
              {(rutas.data || []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay datos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
