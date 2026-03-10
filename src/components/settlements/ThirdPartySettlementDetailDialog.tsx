import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, Download, Calendar, DollarSign, FileText, Package, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateString } from '@/lib/dateUtils';
import { downloadThirdPartySettlementPDF } from '@/lib/generateSettlementPDF';
import { InvoiceDataDialog } from '@/components/invoicing/InvoiceDataDialog';

interface ThirdPartyLiquidacion {
  id: string;
  empresa_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  monto_neto: number;
  monto_iva: number;
  monto_total: number;
  cantidad_envios: number;
  estado: string;
  notas: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  fecha_pago: string | null;
  factura_id: string | null;
  created_at: string;
  empresa?: { nombre: string; cuit: string | null };
}

interface ThirdPartySettlementDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liquidacion: ThirdPartyLiquidacion | null;
}

export function ThirdPartySettlementDetailDialog({
  open,
  onOpenChange,
  liquidacion,
}: ThirdPartySettlementDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch detalles (envíos vinculados)
  const { data: detalles, isLoading: isLoadingDetalles } = useQuery({
    queryKey: ['third-party-liquidacion-detalles', liquidacion?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('liquidacion_terciarizado_detalles') as any)
        .select(`
          id, monto, created_at,
          envio:envios(id, tracking_number, tracking_externo, nombre_destinatario, precio_total, estado, fecha_entrega, requiere_retiro,
            clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
        `)
        .eq('liquidacion_id', liquidacion?.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: open && !!liquidacion?.id,
  });

  // Fetch factura if exists
  const { data: factura } = useQuery({
    queryKey: ['third-party-liquidacion-factura', liquidacion?.factura_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facturas')
        .select('*')
        .eq('id', liquidacion?.factura_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!liquidacion?.factura_id,
  });

  if (!liquidacion) return null;

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'generada':
        return <Badge variant="secondary">Generada</Badge>;
      case 'pagada':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pagada</Badge>;
      case 'cancelada':
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const handlePrint = () => {
    window.open(`/print-settlement?id=${liquidacion.id}&type=third-party`, '_blank');
  };

  const handleDownloadPDF = () => {
    downloadThirdPartySettlementPDF(liquidacion);
  };

  const handleInvoiceSuccess = async (facturaData: any) => {
    if (facturaData.factura_id) {
      await (supabase
        .from('liquidaciones_terciarizado') as any)
        .update({ factura_id: facturaData.factura_id })
        .eq('id', liquidacion.id);

      queryClient.invalidateQueries({ queryKey: ['third-party-liquidaciones'] });
      queryClient.invalidateQueries({ queryKey: ['third-party-liquidacion-factura', facturaData.factura_id] });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Liquidación de Terciarizado
              </DialogTitle>
              <div className="flex gap-2">
                {!liquidacion.factura_id && liquidacion.estado !== 'cancelada' && (
                  <Button variant="outline" size="sm" onClick={() => setInvoiceDialogOpen(true)}>
                    <Receipt className="mr-2 h-4 w-4" />
                    Facturar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header Info */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Empresa</p>
                <p className="font-semibold">{liquidacion.empresa?.nombre || 'N/A'}</p>
              </div>
              {liquidacion.empresa?.cuit && (
                <div>
                  <p className="text-sm text-muted-foreground">CUIT</p>
                  <p className="font-medium">{liquidacion.empresa.cuit}</p>
                </div>
              )}
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
              {factura && (
                <div>
                  <p className="text-sm text-muted-foreground">Factura</p>
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                    {factura.tipo_comprobante} {factura.punto_venta ? `${String(factura.punto_venta).padStart(4, '0')}-${String(factura.numero_comprobante).padStart(8, '0')}` : 'Pendiente'}
                  </Badge>
                </div>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="envios">
                  <Package className="mr-1 h-3 w-3" />
                  Envíos ({detalles?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="resumen" className="space-y-4 mt-4">
                {/* Totales */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Envíos</p>
                      <p className="text-2xl font-bold">{liquidacion.cantidad_envios}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Monto Neto</p>
                      <p className="text-2xl font-bold">
                        ${liquidacion.monto_neto.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">IVA</p>
                      <p className="text-2xl font-bold text-muted-foreground">
                        ${liquidacion.monto_iva.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold text-primary">
                        ${liquidacion.monto_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Factura Info */}
                {factura && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        Factura Emitida
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Tipo</p>
                          <p className="font-medium">Factura {factura.tipo_comprobante}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Número</p>
                          <p className="font-medium">
                            {factura.punto_venta ? `${String(factura.punto_venta).padStart(4, '0')}-${String(factura.numero_comprobante).padStart(8, '0')}` : 'Pendiente'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Estado</p>
                          <Badge variant={factura.estado === 'emitida' ? 'default' : 'secondary'}>
                            {factura.estado}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Importe</p>
                          <p className="font-medium">${factura.importe_total?.toLocaleString()}</p>
                        </div>
                        {factura.cae && (
                          <div className="col-span-2">
                            <p className="text-sm text-muted-foreground">CAE</p>
                            <p className="font-mono text-sm">{factura.cae}</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/print-invoice?factura_id=${factura.id}`, '_blank')}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Imprimir Factura
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Info de Pago */}
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
                            {liquidacion.fecha_pago
                              ? format(new Date(liquidacion.fecha_pago), 'dd/MM/yyyy HH:mm', { locale: es })
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Método de Pago</p>
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

                {/* Notas */}
                {liquidacion.notas && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Notas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{liquidacion.notas}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="envios" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    {isLoadingDetalles ? (
                      <div className="p-6 space-y-4">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tracking</TableHead>
                            <TableHead>Destinatario</TableHead>
                            <TableHead>Fecha Entrega</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detalles?.map((det: any) => {
                            const envio = det.envio;
                            const destName = envio?.clientes
                              ? `${envio.clientes.nombre || ''} ${envio.clientes.apellido || ''}`.trim()
                              : envio?.nombre_destinatario || '-';
                            return (
                              <TableRow key={det.id}>
                                <TableCell className="font-mono text-sm">
                                  {envio?.tracking_externo || envio?.tracking_number || '-'}
                                </TableCell>
                                <TableCell className="text-sm">{destName}</TableCell>
                                <TableCell className="text-sm">
                                  {envio?.fecha_entrega
                                    ? format(new Date(envio.fecha_entrega), 'dd/MM/yy', { locale: es })
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">{envio?.estado || '-'}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  ${det.monto?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {(!detalles || detalles.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                No hay envíos en esta liquidación
                              </TableCell>
                            </TableRow>
                          )}
                          {detalles && detalles.length > 0 && (
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell colSpan={4} className="text-right">Total:</TableCell>
                              <TableCell className="text-right text-primary">
                                ${liquidacion.monto_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

      {/* Invoice Dialog */}
      <InvoiceDataDialog
        open={invoiceDialogOpen}
        onClose={() => setInvoiceDialogOpen(false)}
        onSuccess={handleInvoiceSuccess}
        liquidacionTerciarizadoId={liquidacion.id}
        importeTotal={liquidacion.monto_total}
      />
    </>
  );
}
