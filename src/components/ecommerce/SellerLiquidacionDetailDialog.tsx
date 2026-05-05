import { useState, useMemo, useCallback } from 'react';
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
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Printer, Download, Calendar, DollarSign, FileText, Package, Receipt, Info, Save } from 'lucide-react';
import { toast } from 'sonner';
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
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  // Fetch envíos vinculados a esta liquidación + huérfanos del período
  const { data: envios, isLoading: isLoadingEnvios } = useQuery({
    queryKey: ['seller-liquidacion-envios', liquidacion?.id],
    queryFn: async () => {
      if (!liquidacion?.id) return [];
      const selectCols = 'id, tracking_number, nombre_destinatario, direccion_entrega, precio_total, estado, created_at, liquidacion_seller_id, destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido)';

      const { data: linked, error: e1 } = await (supabase.from('envios') as any)
        .select(selectCols)
        .eq('liquidacion_seller_id', liquidacion.id)
        .neq('estado', 'pendiente');
      if (e1) throw e1;

      // Buscar huérfanos del período (mismo seller, sin liquidación, dentro del rango)
      const sellerId = (liquidacion as any).seller_id;
      let orphans: any[] = [];
      if (sellerId && liquidacion.periodo_inicio && liquidacion.periodo_fin) {
        const { data: orph, error: e2 } = await (supabase.from('envios') as any)
          .select(selectCols)
          .eq('remitente_id', sellerId)
          .is('liquidacion_seller_id', null)
          .neq('estado', 'pendiente')
          .gte('created_at', liquidacion.periodo_inicio)
          .lte('created_at', liquidacion.periodo_fin + 'T23:59:59');
        if (e2) throw e2;
        orphans = orph || [];

        // Auto-link huérfanos a esta liquidación si está en estado 'generada'
        if (orphans.length > 0 && liquidacion.estado === 'generada') {
          const orphanIds = orphans.map((o: any) => o.id);
          await (supabase.from('envios') as any)
            .update({ liquidacion_seller_id: liquidacion.id })
            .in('id', orphanIds);
        }
      }

      const all = [...(linked || []), ...orphans];
      all.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      return all;
    },
    enabled: open && !!liquidacion?.id,
  });

  // Fetch visitas for cancelled envíos
  const { data: enviosConVisitasSet } = useQuery({
    queryKey: ['seller-liquidacion-visitas', liquidacion?.id, envios?.map((e: any) => e.id).join(',')],
    queryFn: async () => {
      const cancelledIds = (envios || [])
        .filter((e: any) => e.estado === 'cancelado')
        .map((e: any) => e.id);
      if (cancelledIds.length === 0) return new Set<string>();

      const { data: visitasData } = await supabase
        .from('envio_historial')
        .select('envio_id')
        .in('envio_id', cancelledIds)
        .in('estado_nuevo', ['en_reparto', 'no_entregado'] as any[]);

      return new Set((visitasData || []).map(v => v.envio_id));
    },
    enabled: open && !!envios && envios.length > 0,
  });

  // Helper: is envio excluded from settlement? (pendiente or cancelado sin visitas)
  const isExcludedFromSettlement = (envio: any) =>
    envio.estado === 'pendiente' ||
    (envio.estado === 'cancelado' && !(enviosConVisitasSet || new Set()).has(envio.id));

  // Adjusted total excluding cancelled without visits
  const adjustedTotal = useMemo(() => {
    if (!envios) return 0;
    return envios.reduce((sum: number, e: any) => {
      if (isExcludedFromSettlement(e)) return sum;
      const edited = editedPrices[e.id];
      const price = edited !== undefined ? parseFloat(edited) || 0 : (e.precio_total || 0);
      return sum + price;
    }, 0);
  }, [envios, enviosConVisitasSet, editedPrices]);

  const isEditable = liquidacion?.estado === 'generada';

  const hasChanges = useMemo(() => {
    if (!envios) return false;
    return Object.entries(editedPrices).some(([id, val]) => {
      const envio = envios.find((e: any) => e.id === id);
      return envio && parseFloat(val) !== (envio.precio_total || 0);
    });
  }, [editedPrices, envios]);

  const handlePriceChange = useCallback((envioId: string, value: string) => {
    setEditedPrices(prev => ({ ...prev, [envioId]: value }));
  }, []);

  const handleSaveChanges = useCallback(async () => {
    if (!liquidacion || !envios) return;
    setIsSaving(true);
    try {
      const updates = Object.entries(editedPrices)
        .filter(([id, val]) => {
          const envio = envios.find((e: any) => e.id === id);
          return envio && parseFloat(val) !== (envio.precio_total || 0);
        });

      for (const [envioId, val] of updates) {
        await (supabase.from('envios') as any)
          .update({ precio_total: parseFloat(val) || 0 })
          .eq('id', envioId);
      }

      // Recalculate totals
      const newTotalCargos = adjustedTotal;
      const saldoAnterior = liquidacion.saldo_anterior || 0;
      const totalPagos = liquidacion.total_pagos || 0;
      const newSaldoPeriodo = newTotalCargos - totalPagos;
      const newSaldoFinal = saldoAnterior + newSaldoPeriodo;

      await (supabase.from('liquidaciones_seller') as any)
        .update({
          total_cargos: newTotalCargos,
          saldo_periodo: newSaldoPeriodo,
          saldo_final: newSaldoFinal,
        })
        .eq('id', liquidacion.id);

      setEditedPrices({});
      queryClient.invalidateQueries({ queryKey: ['seller-liquidacion-envios'] });
      queryClient.invalidateQueries({ queryKey: ['seller-liquidaciones'] });
      toast.success('Precios actualizados correctamente');
    } catch (err) {
      toast.error('Error al guardar los cambios');
    } finally {
      setIsSaving(false);
    }
  }, [liquidacion, envios, editedPrices, adjustedTotal, queryClient]);

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
                      <p className="text-sm text-muted-foreground">Total Envíos</p>
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
                        <span className="text-muted-foreground">Envíos del Período</span>
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
                          {envios?.map((envio) => {
                            const excluded = isExcludedFromSettlement(envio);
                            return (
                            <TableRow key={envio.id} className={excluded ? 'opacity-60' : ''}>
                              <TableCell className="text-sm">
                                {format(new Date(envio.created_at), 'dd/MM/yy HH:mm')}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{envio.tracking_number}</TableCell>
                              <TableCell className="text-sm">{envio.nombre_destinatario || (envio.destinatario ? `${envio.destinatario.nombre || ''} ${envio.destinatario.apellido || ''}`.trim() : '') || '-'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{envio.estado || '-'}</Badge>
                              </TableCell>
                              <TableCell className={`text-right font-medium ${excluded ? 'text-muted-foreground' : 'text-orange-600'}`}>
                                {excluded ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger className="flex items-center justify-end gap-1">
                                        $0
                                        <Info className="h-3 w-3" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{envio.estado === 'pendiente' ? 'Pendiente - no se liquida' : 'Sin visitas - no se cobra'}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : isEditable ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-muted-foreground">$</span>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="w-24 h-8 text-right text-sm"
                                      value={editedPrices[envio.id] !== undefined ? editedPrices[envio.id] : (envio.precio_total || 0)}
                                      onChange={(e) => handlePriceChange(envio.id, e.target.value)}
                                    />
                                    {editedPrices[envio.id] !== undefined && parseFloat(editedPrices[envio.id]) !== (envio.precio_total || 0) && (
                                      <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">Editado</Badge>
                                    )}
                                  </div>
                                ) : (
                                  `$${envio.precio_total?.toLocaleString()}`
                                )}
                              </TableCell>
                            </TableRow>
                            );
                          })}
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
                                ${adjustedTotal.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                    {isEditable && hasChanges && (
                      <div className="p-4 border-t flex justify-end">
                        <Button onClick={handleSaveChanges} disabled={isSaving}>
                          <Save className="mr-2 h-4 w-4" />
                          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                      </div>
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
        liquidacionSellerId={liquidacion.id}
        importeTotal={Math.abs(liquidacion.saldo_periodo || 0)}
      />
    </>
  );
}
