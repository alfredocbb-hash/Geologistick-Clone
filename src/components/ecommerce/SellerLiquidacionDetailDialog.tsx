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
import { downloadSellerSettlementPDF } from '@/lib/generateSettlementPDF';
import { InvoiceDataDialog } from '@/components/invoicing/InvoiceDataDialog';

interface SellerLiquidacion {
  id: string;
  seller_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  total_cargos: number | null;
  total_pagos: number | null;
  saldo_periodo: number | null;
  saldo_anterior: number | null;
  saldo_final: number | null;
  cantidad_movimientos: number | null;
  estado: string | null;
  notas: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  fecha_pago: string | null;
  factura_id: string | null;
  seller?: { nombre: string };
}

interface SellerLiquidacionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liquidacion: SellerLiquidacion | null;
}

export function SellerLiquidacionDetailDialog({
  open,
  onOpenChange,
  liquidacion,
}: SellerLiquidacionDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('resumen');
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch envíos vinculados a esta liquidación
  const { data: envios, isLoading: isLoadingEnvios } = useQuery({
    queryKey: ['seller-liquidacion-envios', liquidacion?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('envios') as any)
        .select('id, tracking_number, nombre_destinatario, direccion_entrega, precio_total, estado, created_at')
        .eq('liquidacion_seller_id', liquidacion?.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: open && !!liquidacion?.id,
  });

  // Fetch factura if exists
  const { data: factura } = useQuery({
    queryKey: ['seller-liquidacion-factura', liquidacion?.factura_id],
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

  const getEstadoBadge = (estado: string | null) => {
    switch (estado) {
      case 'generada':
        return <Badge variant="secondary">Generada</Badge>;
      case 'aprobada':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Aprobada</Badge>;
      case 'pagada':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pagada</Badge>;
      case 'cancelada':
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{estado || 'Pendiente'}</Badge>;
    }
  };

  const handlePrint = () => {
    window.open(`/print-settlement?id=${liquidacion.id}&type=seller`, '_blank');
  };

  const handleDownloadPDF = () => {
    downloadSellerSettlementPDF(liquidacion);
  };

  const handleInvoiceSuccess = async (facturaData: any) => {
    // Link factura to liquidacion
    if (facturaData.factura_id) {
      await (supabase
        .from('liquidaciones_seller') as any)
        .update({ factura_id: facturaData.factura_id })
        .eq('id', liquidacion.id);
      
      queryClient.invalidateQueries({ queryKey: ['seller-liquidaciones'] });
      queryClient.invalidateQueries({ queryKey: ['seller-liquidacion-factura', facturaData.factura_id] });
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
                Liquidación de Seller
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
                <p className="text-sm text-muted-foreground">Seller</p>
                <p className="font-semibold">{liquidacion.seller?.nombre || 'N/A'}</p>
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
                  Envíos ({envios?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="resumen" className="space-y-4 mt-4">
                {/* Totales */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Items Totales</p>
                      <p className="text-2xl font-bold">{liquidacion.cantidad_movimientos || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Cargos + Envíos</p>
                      <p className="text-2xl font-bold text-orange-600">
                        ${(liquidacion.total_cargos || 0).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Pagos</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${(liquidacion.total_pagos || 0).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Saldo Período</p>
                      <p className={`text-2xl font-bold ${(liquidacion.saldo_periodo || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        ${(liquidacion.saldo_periodo || 0).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Saldos */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Detalle de Saldos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Saldo Anterior</span>
                        <span className="font-medium">${(liquidacion.saldo_anterior || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Cargos + Envíos del Período</span>
                        <span className="font-medium text-orange-600">+${(liquidacion.total_cargos || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Pagos del Período</span>
                        <span className="font-medium text-green-600">-${(liquidacion.total_pagos || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 font-bold text-lg">
                        <span>Saldo Final</span>
                        <span className={(liquidacion.saldo_final || 0) > 0 ? 'text-orange-600' : 'text-green-600'}>
                          ${(liquidacion.saldo_final || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

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
                        <div>
                          <p className="text-sm text-muted-foreground">Receptor</p>
                          <p className="font-medium">{factura.receptor_nombre}</p>
                        </div>
                        {factura.receptor_cuit && (
                          <div>
                            <p className="text-sm text-muted-foreground">CUIT</p>
                            <p className="font-medium">{factura.receptor_cuit}</p>
                          </div>
                        )}
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
                    {isLoadingEnvios ? (
                      <div className="p-6 space-y-4">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tracking</TableHead>
                            <TableHead>Destinatario</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Precio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {envios?.map((envio) => (
                            <TableRow key={envio.id}>
                              <TableCell className="text-sm">
                                {format(new Date(envio.created_at), 'dd/MM/yy HH:mm')}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{envio.tracking_number}</TableCell>
                              <TableCell className="text-sm">{envio.nombre_destinatario || '-'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{envio.estado || '-'}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium text-orange-600">
                                ${envio.precio_total?.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                          {envios?.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                No hay envíos en esta liquidación
                              </TableCell>
                            </TableRow>
                          )}
                          {envios && envios.length > 0 && (
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell colSpan={4} className="text-right">Total Envíos:</TableCell>
                              <TableCell className="text-right text-orange-600">
                                ${envios.reduce((sum, e) => sum + (e.precio_total || 0), 0).toLocaleString()}
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
        envioId={liquidacion.id}
        importeTotal={Math.abs(liquidacion.saldo_periodo || 0)}
      />
    </>
  );
}
