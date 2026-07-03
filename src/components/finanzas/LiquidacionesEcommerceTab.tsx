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
import { DollarSign, ShoppingCart, Receipt, ExternalLink } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface Row {
  id: string;
  periodo_inicio: string;
  periodo_fin: string;
  fecha_pago: string | null;
  total_cargos: number | null;
  total_pagos: number | null;
  saldo_periodo: number | null;
  estado: string;
  seller: { nombre: string } | null;
}

export function LiquidacionesEcommerceTab() {
  const { tenantId } = useTenant();
  const [desde, setDesde] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [hasta, setHasta] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery({
    queryKey: ['finanzas-liq-ecommerce', tenantId, desde, hasta],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liquidaciones_seller')
        .select('id, periodo_inicio, periodo_fin, fecha_pago, total_cargos, total_pagos, saldo_periodo, estado, seller:ecommerce_sellers(nombre)')
        .eq('estado', 'pagada')
        .gte('fecha_pago', `${desde}T00:00:00`)
        .lte('fecha_pago', `${hasta}T23:59:59`)
        .order('fecha_pago', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
    enabled: !!tenantId,
  });

  const totals = useMemo(() => {
    const rows = data || [];
    return {
      count: rows.length,
      totalPagado: rows.reduce((s, r) => s + (r.total_pagos || 0), 0),
      totalCargos: rows.reduce((s, r) => s + (r.total_cargos || 0), 0),
    };
  }, [data]);

  const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {/* Filters */}
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
                <Link to="/ecommerce/settlements">
                  <ExternalLink className="h-4 w-4 mr-2" /> Ir a Liquidaciones eCommerce
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><ShoppingCart className="h-5 w-5 text-primary" /></div>
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
            <div className="p-2 rounded-lg bg-orange-500/10"><Receipt className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total cargos del período</p>
              <p className="text-2xl font-bold">{fmt(totals.totalCargos)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
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
                    <TableHead>Seller</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Fecha de pago</TableHead>
                    <TableHead className="text-right">Cargos</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.seller?.nombre || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(r.periodo_inicio), 'dd/MM/yy', { locale: es })} - {format(new Date(r.periodo_fin), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.fecha_pago ? format(new Date(r.fecha_pago), 'dd/MM/yyyy HH:mm', { locale: es }) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{fmt(r.total_cargos || 0)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">{fmt(r.total_pagos || 0)}</TableCell>
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
