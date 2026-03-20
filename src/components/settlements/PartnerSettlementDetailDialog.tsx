import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Calendar, DollarSign, FileText, Package, Handshake } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateString } from '@/lib/dateUtils';
import { downloadPartnerSettlementPDF } from '@/lib/generateSettlementPDF';
import { useState } from 'react';

interface PartnerLiquidacion {
  id: string;
  partnership_id: string;
  partner_tenant_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  monto_total: number;
  monto_comision: number;
  cantidad_envios: number;
  estado: string;
  notas: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  fecha_pago: string | null;
  created_at: string;
  partner_name?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liquidacion: PartnerLiquidacion | null;
}

export function PartnerSettlementDetailDialog({ open, onOpenChange, liquidacion }: Props) {
  const [activeTab, setActiveTab] = useState('resumen');

  const { data: detalles, isLoading } = useQuery({
    queryKey: ['partner-liquidacion-detalles', liquidacion?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('liquidacion_partner_detalles') as any)
        .select(`
          id, envio_id, concepto_id, nombre_concepto, monto_envio, porcentaje_comision, monto_comision, tipo_pago,
          envio:envios(tracking_number, tracking_externo, nombre_destinatario, fecha_entrega)
        `)
        .eq('liquidacion_id', liquidacion?.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open && !!liquidacion?.id,
  });

  if (!liquidacion) return null;

  // Group detalles by envio for display
  const envioMap = new Map<string, { tracking: string; destinatario: string; fecha: string; conceptos: any[]; total_monto: number; total_comision: number }>();
  (detalles || []).forEach((d: any) => {
    const key = d.envio_id || d.id;
    if (!envioMap.has(key)) {
      envioMap.set(key, {
        tracking: d.envio?.tracking_number || '-',
        destinatario: d.envio?.nombre_destinatario || '-',
        fecha: d.envio?.fecha_entrega ? format(new Date(d.envio.fecha_entrega), 'dd/MM/yy', { locale: es }) : '-',
        conceptos: [],
        total_monto: 0,
        total_comision: 0,
      });
    }
    const entry = envioMap.get(key)!;
    entry.conceptos.push(d);
    entry.total_monto += Number(d.monto_envio) || 0;
    entry.total_comision += Number(d.monto_comision) || 0;
  });

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'generada': return <Badge variant="secondary">Generada</Badge>;
      case 'pagada': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pagada</Badge>;
      default: return <Badge variant="outline">{estado}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5" />
              Liquidación de Partner
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={() => downloadPartnerSettlementPDF(liquidacion)}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Partner</p>
              <p className="font-semibold">{liquidacion.partner_name || 'Empresa'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Período</p>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseDateString(liquidacion.periodo_inicio), 'dd/MM/yyyy')} - {format(parseDateString(liquidacion.periodo_fin), 'dd/MM/yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              {getEstadoBadge(liquidacion.estado)}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="envios">
                <Package className="mr-1 h-3 w-3" />
                Envíos ({envioMap.size})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Envíos</p>
                    <p className="text-2xl font-bold">{liquidacion.cantidad_envios}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Monto Total</p>
                    <p className="text-2xl font-bold">${liquidacion.monto_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Comisión Partner</p>
                    <p className="text-2xl font-bold text-primary">${liquidacion.monto_comision?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </CardContent>
                </Card>
              </div>

              {liquidacion.estado === 'pagada' && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Información de Pago
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Fecha de Pago</p>
                        <p className="font-medium">
                          {liquidacion.fecha_pago ? format(new Date(liquidacion.fecha_pago), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Método</p>
                        <p className="font-medium capitalize">{liquidacion.metodo_pago || '-'}</p>
                      </div>
                      {liquidacion.referencia_pago && (
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">Referencia</p>
                          <p className="font-medium">{liquidacion.referencia_pago}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {liquidacion.notas && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Notas</CardTitle></CardHeader>
                  <CardContent><p className="text-muted-foreground">{liquidacion.notas}</p></CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="envios" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-6 space-y-4">
                      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tracking</TableHead>
                          <TableHead>Destinatario</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Concepto</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead className="text-right">Comisión</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detalles || []).map((d: any) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono text-sm">{d.envio?.tracking_number || '-'}</TableCell>
                            <TableCell className="text-sm">{d.envio?.nombre_destinatario || '-'}</TableCell>
                            <TableCell className="text-sm">
                              {d.envio?.fecha_entrega ? format(new Date(d.envio.fecha_entrega), 'dd/MM/yy', { locale: es }) : '-'}
                            </TableCell>
                            <TableCell className="text-sm">{d.nombre_concepto || '-'}</TableCell>
                            <TableCell className="text-right">${Number(d.monto_envio || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">{Number(d.porcentaje_comision || 0).toFixed(1)}%</TableCell>
                            <TableCell className="text-right font-medium text-primary">
                              ${Number(d.monto_comision || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!detalles || detalles.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No hay detalles
                            </TableCell>
                          </TableRow>
                        )}
                        {detalles && detalles.length > 0 && (
                          <TableRow className="bg-muted/50 font-semibold">
                            <TableCell colSpan={6} className="text-right">Total Comisión:</TableCell>
                            <TableCell className="text-right text-primary">
                              ${liquidacion.monto_comision?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
