import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ProductividadChofer } from '@/hooks/useProductividadData';
import type { UseQueryResult } from '@tanstack/react-query';

interface Props {
  data: UseQueryResult<ProductividadChofer[], Error>;
}

export function ProductividadTab({ data }: Props) {
  if (data.isLoading) return <Skeleton className="h-64 w-full" />;

  const items = data.data || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Ranking de Productividad</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={items.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="chofer_nombre" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="entregados" fill="hsl(var(--primary))" name="Entregados" radius={[4, 4, 0, 0]} />
              <Bar dataKey="entregas_por_hora" fill="hsl(var(--chart-2, 160 60% 45%))" name="Entregas/hora" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Conductor</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Entregados</TableHead>
                <TableHead className="text-right">Entregas/h</TableHead>
                <TableHead className="text-right">Tasa Éxito</TableHead>
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
                  <TableCell className="text-right">{row.entregas_por_hora}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={row.tasa_exito >= 80 ? 'default' : row.tasa_exito >= 50 ? 'secondary' : 'destructive'}>
                      {row.tasa_exito}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {row.tiempo_promedio_min != null ? `${row.tiempo_promedio_min} min` : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No hay datos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
