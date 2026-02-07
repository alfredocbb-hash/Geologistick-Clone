import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Printer, Download, Calendar, DollarSign, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { downloadSellerSettlementPDF } from '@/lib/generateSettlementPDF';

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

  // Fetch movimientos vinculados a esta liquidación
  const { data: movimientos, isLoading } = useQuery({
    queryKey: ['seller-liquidacion-movimientos', liquidacion?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_cuenta_corriente')
        .select('*')
        .eq('liquidacion_id', liquidacion?.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: open && !!liquidacion?.id,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Liquidación de Seller
            </DialogTitle>
            <div className="flex gap-2">
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
                {format(new Date(liquidacion.periodo_inicio), 'dd/MM/yyyy')} - {format(new Date(liquidacion.periodo_fin), 'dd/MM/yyyy')}
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
              <TabsTrigger value="detalle">Detalle de Movimientos</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4 mt-4">
              {/* Totales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Movimientos</p>
                    <p className="text-2xl font-bold">{liquidacion.cantidad_movimientos || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Cargos</p>
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
                      <span className="text-muted-foreground">Cargos del Período</span>
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

            <TabsContent value="detalle" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
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
                          <TableHead>Tipo</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimientos?.map((mov) => (
                          <TableRow key={mov.id}>
                            <TableCell className="text-sm">
                              {format(new Date(mov.created_at), 'dd/MM/yy HH:mm')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={mov.tipo === 'cargo' ? 'default' : mov.tipo === 'pago' ? 'secondary' : 'outline'}>
                                {mov.tipo === 'cargo' ? 'Cargo' : mov.tipo === 'pago' ? 'Pago' : 'Ajuste'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {mov.descripcion || mov.referencia || '-'}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${mov.tipo === 'cargo' ? 'text-orange-600' : 'text-green-600'}`}>
                              {mov.tipo === 'cargo' ? '+' : '-'}${Math.abs(mov.monto).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                        {movimientos?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              No hay movimientos en esta liquidación
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
