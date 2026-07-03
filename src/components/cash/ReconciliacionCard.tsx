import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, RefreshCw, Scale, FileText, Wallet } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type Metodo = 'efectivo' | 'transferencia' | 'mercado_pago' | 'tarjeta';

const METODO_LABELS: Record<Metodo, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercado_pago: 'Mercado Pago',
  tarjeta: 'Tarjeta',
};

const METODOS: Metodo[] = ['efectivo', 'transferencia', 'mercado_pago', 'tarjeta'];

interface Props {
  session: { id: string; fecha_apertura: string | null } | null;
  cajaPorMetodo: Record<string, { ingresos: number; egresos: number }>;
  formatCurrency: (n: number) => string;
}

export function ReconciliacionCard({ session, cajaPorMetodo, formatCurrency }: Props) {
  const [open, setOpen] = useState(false);

  const desde = session?.fecha_apertura || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const hasta = new Date().toISOString();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cash-reconciliation', session?.id, open],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('cash-reconciliation', {
        body: { desde, hasta },
      });
      if (error) throw error;
      return data as {
        pagos_por_metodo: Record<Metodo, number>;
        facturas: {
          total_bruto: number;
          notas_credito: number;
          total_neto: number;
          count: number;
          por_metodo: Record<string, number>;
        };
        mp_balance: { available: number; currency: string; nickname: string | null } | null;
        mp_cobros_dia: { total: number; count: number } | null;
        mp_error: string | null;
      };
    },
    enabled: !!session && open,
    staleTime: 30_000,
  });

  const diff = (a: number, b: number) => Math.abs(a - b) > 0.01;

  return (
    <Card className="glass">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Conciliación del día
                <Badge variant="outline" className="ml-2 text-xs">
                  {open ? 'ocultar' : 'mostrar'}
                </Badge>
              </CardTitle>
              {open && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); refetch(); }}
                  disabled={isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {isLoading || !data ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                {/* Cobros por método: Caja vs pagos */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Cobros por método — Caja vs. Sistema</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b">
                          <th className="text-left py-2">Método</th>
                          <th className="text-right">En Caja (ingresos)</th>
                          <th className="text-right">En pagos (aprobados)</th>
                          <th className="text-right">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {METODOS.map(m => {
                          const caja = cajaPorMetodo[m]?.ingresos || 0;
                          const sistema = data.pagos_por_metodo[m] || 0;
                          const d = caja - sistema;
                          const hay = diff(caja, sistema);
                          return (
                            <tr key={m} className="border-b last:border-0">
                              <td className="py-2 font-medium">{METODO_LABELS[m]}</td>
                              <td className="text-right">{formatCurrency(caja)}</td>
                              <td className="text-right">{formatCurrency(sistema)}</td>
                              <td className={`text-right font-medium ${hay ? 'text-destructive' : 'text-success'}`}>
                                <span className="inline-flex items-center gap-1 justify-end">
                                  {hay ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                                  {formatCurrency(d)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Facturación */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Facturación del día
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                      <p className="text-xs text-muted-foreground">Total facturado (neto)</p>
                      <p className="text-lg font-bold">{formatCurrency(data.facturas.total_neto)}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{data.facturas.count} comprobante(s)</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                      <p className="text-xs text-muted-foreground">Facturas emitidas</p>
                      <p className="text-lg font-bold text-success">+{formatCurrency(data.facturas.total_bruto)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                      <p className="text-xs text-muted-foreground">Notas de crédito</p>
                      <p className="text-lg font-bold text-destructive">-{formatCurrency(data.facturas.notas_credito)}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2 italic">
                    Método inferido del pago asociado al envío.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b">
                          <th className="text-left py-2">Método</th>
                          <th className="text-right">Facturado</th>
                          <th className="text-right">Cobrado en Caja</th>
                          <th className="text-right">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {METODOS.map(m => {
                          const fact = data.facturas.por_metodo[m] || 0;
                          const caja = cajaPorMetodo[m]?.ingresos || 0;
                          const d = fact - caja;
                          const hay = diff(fact, caja);
                          if (fact === 0 && caja === 0) return null;
                          return (
                            <tr key={m} className="border-b last:border-0">
                              <td className="py-2 font-medium">{METODO_LABELS[m]}</td>
                              <td className="text-right">{formatCurrency(fact)}</td>
                              <td className="text-right">{formatCurrency(caja)}</td>
                              <td className={`text-right font-medium ${hay ? 'text-destructive' : 'text-success'}`}>
                                {formatCurrency(d)}
                              </td>
                            </tr>
                          );
                        })}
                        {(data.facturas.por_metodo.sin_metodo || 0) > 0 && (
                          <tr className="border-b last:border-0 text-muted-foreground">
                            <td className="py-2 italic">Sin método asignado</td>
                            <td className="text-right">{formatCurrency(data.facturas.por_metodo.sin_metodo)}</td>
                            <td className="text-right">—</td>
                            <td className="text-right">—</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* MP */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> Mercado Pago (API)
                  </h3>
                  {data.mp_error ? (
                    <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 text-sm">
                      <p className="text-warning font-medium">{data.mp_error}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Configurá el token en Ajustes → Integraciones.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                        <p className="text-xs text-muted-foreground">Saldo disponible MP</p>
                        <p className="text-lg font-bold text-primary">
                          {data.mp_balance?.available != null
                            ? formatCurrency(data.mp_balance.available)
                            : '—'}
                        </p>
                        {data.mp_balance?.nickname && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Cuenta: {data.mp_balance.nickname}
                          </p>
                        )}
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                        <p className="text-xs text-muted-foreground">Cobros MP aprobados (rango)</p>
                        <p className="text-lg font-bold text-success">
                          +{formatCurrency(data.mp_cobros_dia?.total || 0)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {data.mp_cobros_dia?.count || 0} pagos
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                        <p className="text-xs text-muted-foreground">Diferencia con Caja</p>
                        {(() => {
                          const api = data.mp_cobros_dia?.total || 0;
                          const caja = cajaPorMetodo['mercado_pago']?.ingresos || 0;
                          const d = api - caja;
                          const hay = diff(api, caja);
                          return (
                            <p className={`text-lg font-bold ${hay ? 'text-destructive' : 'text-success'}`}>
                              {formatCurrency(d)}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
