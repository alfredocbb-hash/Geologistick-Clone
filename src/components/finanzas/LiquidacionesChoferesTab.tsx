import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Truck, Package, ExternalLink } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { toLocalISOStart, toLocalISOEnd, parseDateString } from '@/lib/dateUtils';

interface Row {
  id: string;
  chofer_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  fecha_pago: string | null;
  monto_total: number;
  cantidad_envios: number;
  estado: string;
  chofer?: { nombre: string | null; apellido: string | null } | null;
}

export function LiquidacionesChoferesTab() {
  const { tenantId } = useTenant();
  const [desde, setDesde] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [hasta, setHasta] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery({
    queryKey: ['finanzas-liq-choferes', tenantId, desde, hasta],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liquidaciones')
        .select('id, chofer_id, periodo_inicio, periodo_fin, fecha_pago, monto_total, cantidad_envios, estado')
        .eq('estado', 'pagada')
        .gte('fecha_pago', toLocalISOStart(desde))
        .lte('fecha_pago', toLocalISOEnd(hasta))
        .order('fecha_pago', { ascending: false })
        .limit(500);
      if (error) throw error;

      const choferIds = [...new Set((data || []).map((l: any) => l.chofer_id))];
      const { data: profiles } = choferIds.length
        ? await supabase
            .from('profiles')
            .select('user_id, nombre, apellido')
            .in('user_id', choferIds)
        : { data: [] as any[] };

      return (data || []).map((l: any) => ({
        ...l,
        chofer: profiles?.find((p: any) => p.user_id === l.chofer_id) || null,
      })) as Row[];
    },
    enabled: !!tenantId,
  });

  const totals = useMemo(() => {
    const rows = data || [];
    return {
      count: rows.length,
      totalPagado: rows.reduce((s, r) => s + (Number(r.monto_total) || 0), 0),
      envios: rows.reduce((s, r) => s + (Number(r.cantidad_envios) || 0), 0),
    };
  }, [data]);

  const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs">Desde (fecha de pago)</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hasta (fecha de pago)</Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() => {
                  setDesde(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                  setHasta(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                }}
              >
                Mes actual
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" asChild>
                <Link to="/driver-settlements">
                  <ExternalLink className="h-4 w-4 mr-2" /> Ir a Liquidaciones de Choferes
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Truck className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Liquidaciones pagadas</p>
              <p className="text-2xl font-bold">{totals.count}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><DollarSign className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total pagado</p>
              <p className="text-2xl font-bold text-green-600">{fmt(totals.totalPagado)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10"><Package className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Envíos liquidados</p>
              <p className="text-2xl font-bold">{totals.envios}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle de liquidaciones pagadas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (data?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hay liquidaciones pagadas en el rango seleccionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chofer</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Fecha de pago</TableHead>
                    <TableHead className="text-right">Envíos</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.chofer ? `${r.chofer.nombre || ''} ${r.chofer.apellido || ''}`.trim() : '—'}</TableCell>
                      <TableCell className="text-xs">
                        {format(parseDateString(r.periodo_inicio), 'dd/MM/yy', { locale: es })} - {format(parseDateString(r.periodo_fin), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.fecha_pago ? format(new Date(r.fecha_pago), 'dd/MM/yyyy HH:mm', { locale: es }) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{r.cantidad_envios}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">{fmt(Number(r.monto_total) || 0)}</TableCell>
                      <TableCell><Badge variant="secondary">{r.estado}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
