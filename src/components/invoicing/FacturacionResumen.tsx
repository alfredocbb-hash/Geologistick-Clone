import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Receipt, Wallet, FileText, ShoppingCart } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip, CartesianGrid,
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { format, differenceInCalendarDays, startOfWeek, startOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  tenantId?: string;
  fechaDesde: string;
  fechaHasta: string;
  onChangeDesde: (v: string) => void;
  onChangeHasta: (v: string) => void;
  onReset: () => void;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const chartConfig = {
  ingresos: { label: 'Ingresos', color: 'hsl(var(--chart-1))' },
  gastos: { label: 'Gastos', color: 'hsl(var(--chart-2))' },
};

export function FacturacionResumen({ tenantId, fechaDesde, fechaHasta, onChangeDesde, onChangeHasta, onReset }: Props) {
  const rangeKey = `${fechaDesde}|${fechaHasta}`;

  const { data: facturas = [], isLoading: loadingF } = useQuery({
    queryKey: ['resumen-facturas', tenantId, rangeKey],
    queryFn: async () => {
      if (!tenantId || !fechaDesde || !fechaHasta) return [];
      const { data, error } = await supabase
        .from('facturas')
        .select('importe_neto, importe_iva, importe_total, tipo_comprobante, es_nota_credito, fecha_emision, estado')
        .eq('tenant_id', tenantId)
        .gte('fecha_emision', fechaDesde)
        .lte('fecha_emision', fechaHasta)
        .in('estado', ['emitida']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!fechaDesde && !!fechaHasta,
  });

  const { data: facturasCompra = [], isLoading: loadingFC } = useQuery({
    queryKey: ['resumen-facturas-compra', tenantId, rangeKey],
    queryFn: async () => {
      if (!tenantId || !fechaDesde || !fechaHasta) return [];
      const { data, error } = await supabase
        .from('facturas_compra')
        .select('importe_neto, importe_iva, importe_total, fecha_emision')
        .eq('tenant_id', tenantId)
        .gte('fecha_emision', fechaDesde)
        .lte('fecha_emision', fechaHasta);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!fechaDesde && !!fechaHasta,
  });

  const { data: gastos = [], isLoading: loadingG } = useQuery({
    queryKey: ['resumen-gastos', tenantId, rangeKey],
    queryFn: async () => {
      if (!tenantId || !fechaDesde || !fechaHasta) return [];
      const { data, error } = await supabase
        .from('gastos')
        .select('categoria, total, iva, fecha')
        .eq('tenant_id', tenantId)
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!fechaDesde && !!fechaHasta,
  });

  const { data: pagos = [], isLoading: loadingP } = useQuery({
    queryKey: ['resumen-pagos', tenantId, rangeKey],
    queryFn: async () => {
      if (!tenantId || !fechaDesde || !fechaHasta) return [];
      const { data, error } = await supabase
        .from('pagos')
        .select('monto, estado, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', `${fechaDesde}T00:00:00`)
        .lte('created_at', `${fechaHasta}T23:59:59`)
        .in('estado', ['cobrado_chofer', 'rendido', 'pagado']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!fechaDesde && !!fechaHasta,
  });

  const loading = loadingF || loadingFC || loadingG || loadingP;

  const totals = useMemo(() => {
    const facturadoBruto = facturas.filter((f: any) => !f.es_nota_credito).reduce((s: number, f: any) => s + Number(f.importe_total || 0), 0);
    const notasCredito = facturas.filter((f: any) => f.es_nota_credito).reduce((s: number, f: any) => s + Number(f.importe_total || 0), 0);
    const ivaDebito = facturas.reduce((s: number, f: any) => s + Number(f.importe_iva || 0) * (f.es_nota_credito ? -1 : 1), 0);
    const netoEmitido = facturas.reduce((s: number, f: any) => s + Number(f.importe_neto || 0) * (f.es_nota_credito ? -1 : 1), 0);
    const ingresosFacturados = facturadoBruto - notasCredito;
    const cobrado = pagos.reduce((s: number, p: any) => s + Number(p.monto || 0), 0);
    const gastosTotal = gastos.reduce((s: number, g: any) => s + Number(g.total || 0), 0);
    const comprasTotal = facturasCompra.reduce((s: number, f: any) => s + Number(f.importe_total || 0), 0);
    const ivaCredito = facturasCompra.reduce((s: number, f: any) => s + Number(f.importe_iva || 0), 0)
      + gastos.reduce((s: number, g: any) => s + Number(g.iva || 0), 0);
    const resultado = ingresosFacturados - gastosTotal - comprasTotal;
    return {
      facturadoBruto, notasCredito, ingresosFacturados, cobrado, gastosTotal, comprasTotal,
      ivaDebito, ivaCredito, saldoIva: ivaDebito - ivaCredito, resultado, netoEmitido,
    };
  }, [facturas, facturasCompra, gastos, pagos]);

  const chartData = useMemo(() => {
    if (!fechaDesde || !fechaHasta) return [];
    const days = differenceInCalendarDays(parseISO(fechaHasta), parseISO(fechaDesde));
    const groupBy: 'week' | 'month' = days <= 45 ? 'week' : 'month';
    const bucket = (dateStr: string) => {
      const d = parseISO(dateStr);
      if (groupBy === 'week') {
        const s = startOfWeek(d, { weekStartsOn: 1 });
        return { key: format(s, 'yyyy-MM-dd'), label: format(s, "d 'de' MMM", { locale: es }) };
      }
      const s = startOfMonth(d);
      return { key: format(s, 'yyyy-MM'), label: format(s, 'MMM yyyy', { locale: es }) };
    };
    const map = new Map<string, { key: string; label: string; ingresos: number; gastos: number }>();
    facturas.forEach((f: any) => {
      if (!f.fecha_emision) return;
      const { key, label } = bucket(f.fecha_emision);
      const cur = map.get(key) || { key, label, ingresos: 0, gastos: 0 };
      cur.ingresos += Number(f.importe_total || 0) * (f.es_nota_credito ? -1 : 1);
      map.set(key, cur);
    });
    gastos.forEach((g: any) => {
      if (!g.fecha) return;
      const { key, label } = bucket(g.fecha);
      const cur = map.get(key) || { key, label, ingresos: 0, gastos: 0 };
      cur.gastos += Number(g.total || 0);
      map.set(key, cur);
    });
    facturasCompra.forEach((f: any) => {
      if (!f.fecha_emision) return;
      const { key, label } = bucket(f.fecha_emision);
      const cur = map.get(key) || { key, label, ingresos: 0, gastos: 0 };
      cur.gastos += Number(f.importe_total || 0);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [facturas, gastos, facturasCompra, fechaDesde, fechaHasta]);

  const topCategorias = useMemo(() => {
    const map = new Map<string, number>();
    gastos.forEach((g: any) => {
      const cat = g.categoria || 'Sin categoría';
      map.set(cat, (map.get(cat) || 0) + Number(g.total || 0));
    });
    return Array.from(map.entries())
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [gastos]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Desde</Label>
            <Input type="date" value={fechaDesde} onChange={e => onChangeDesde(e.target.value)} className="w-[160px]" />
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Hasta</Label>
            <Input type="date" value={fechaHasta} onChange={e => onChangeHasta(e.target.value)} className="w-[160px]" />
            <Button variant="ghost" size="sm" onClick={onReset}>Mes actual</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Ingresos facturados" value={totals.ingresosFacturados} icon={<FileText className="h-4 w-4" />} loading={loading} subtitle={`NC: -${formatCurrency(totals.notasCredito)}`} />
        <KpiCard title="Ingresos cobrados" value={totals.cobrado} icon={<Wallet className="h-4 w-4" />} loading={loading} subtitle="COD + otros pagos" />
        <KpiCard title="Gastos" value={totals.gastosTotal} icon={<Receipt className="h-4 w-4" />} loading={loading} negative />
        <KpiCard title="Facturas de compra" value={totals.comprasTotal} icon={<ShoppingCart className="h-4 w-4" />} loading={loading} negative />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {totals.resultado >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
            Resultado del período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${totals.resultado >= 0 ? 'text-green-600' : 'text-destructive'}`}>
            {formatCurrency(totals.resultado)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ingresos facturados − Gastos − Facturas de compra
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">IVA Débito Fiscal</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totals.ivaDebito)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">IVA Crédito Fiscal</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totals.ivaCredito)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo IVA</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.saldoIva > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {formatCurrency(totals.saldoIva)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.saldoIva > 0 ? 'A pagar' : 'A favor'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Ingresos vs Gastos</CardTitle></CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                Sin datos para el período seleccionado
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="ingresos" fill="hsl(var(--chart-1))" name="Ingresos" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gastos" fill="hsl(var(--chart-2))" name="Gastos" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top categorías de gasto</CardTitle></CardHeader>
          <CardContent>
            {topCategorias.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                Sin gastos en el período
              </div>
            ) : (
              <div className="space-y-3">
                {topCategorias.map((c, i) => {
                  const pct = totals.gastosTotal > 0 ? (c.total / totals.gastosTotal) * 100 : 0;
                  return (
                    <div key={c.categoria} className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                          <span className="capitalize truncate">{c.categoria}</span>
                        </span>
                        <span className="font-medium">{formatCurrency(c.total)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, loading, subtitle, negative }: {
  title: string; value: number; icon: React.ReactNode; loading?: boolean; subtitle?: string; negative?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <div className={`text-2xl font-bold ${negative ? 'text-destructive' : ''}`}>{formatCurrency(value)}</div>
        )}
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
