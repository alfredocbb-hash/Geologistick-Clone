import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Loader2, FileText, Printer, Download, Building2, Truck, User, Calendar, DollarSign, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateString } from '@/lib/dateUtils';
import { downloadDriverSettlementPDF, downloadBranchSettlementPDF, downloadSellerSettlementPDF } from '@/lib/generateSettlementPDF';
import { toast } from 'sonner';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-warning/10 text-warning border-warning' },
  generada: { label: 'Generada', className: 'bg-warning/10 text-warning border-warning' },
  aprobada: { label: 'Aprobada', className: 'bg-blue-500/10 text-blue-600 border-blue-500' },
  pagada: { label: 'Pagada', className: 'bg-success/10 text-success border-success' },
  rechazada: { label: 'Rechazada', className: 'bg-destructive/10 text-destructive border-destructive' },
  cancelada: { label: 'Cancelada', className: 'bg-destructive/10 text-destructive border-destructive' },
};

export default function PrintSettlement() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const type = (searchParams.get('type') || 'driver') as 'branch' | 'driver' | 'seller' | 'third-party';

  // Fetch settlement based on type
  const { data: settlement, isLoading } = useQuery({
    queryKey: ['print-settlement', id, type],
    queryFn: async () => {
      if (!id) return null;

      if (type === 'driver') {
        const { data, error } = await supabase
          .from('liquidaciones')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;

        // Get chofer name
        const { data: profile } = await supabase
          .from('profiles')
          .select('nombre, apellido')
          .eq('user_id', data.chofer_id)
          .single();

        return { ...data, chofer: profile, _type: 'driver' as const };
      }

      if (type === 'branch') {
        const { data, error } = await supabase
          .from('liquidaciones_sucursal')
          .select('*, sucursal:sucursales(nombre)')
          .eq('id', id)
          .single();
        if (error) throw error;
        return { ...data, _type: 'branch' as const };
      }

      if (type === 'seller') {
        const { data, error } = await supabase
          .from('liquidaciones_seller')
          .select('*, seller:ecommerce_sellers(nombre)')
          .eq('id', id)
          .single();
        if (error) throw error;
        return { ...data, _type: 'seller' as const };
      }

      if (type === 'third-party') {
        const { data, error } = await supabase
          .from('liquidaciones_terciarizado')
          .select('*, empresa:empresas_terciarizadas(nombre, cuit)')
          .eq('id', id)
          .single();
        if (error) throw error;
        return { ...data, _type: 'third-party' as const };
      }

      return null;
    },
    enabled: !!id,
  });

  // Fetch items based on type
  const { data: items = [] } = useQuery({
    queryKey: ['print-settlement-items', id, type],
    queryFn: async () => {
      if (!id) return [];

      if (type === 'driver') {
        const { data } = await supabase
          .from('comisiones')
          .select(`
            *,
            envio:envios(tracking_number, created_at, precio_total, 
              clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
          `)
          .eq('liquidacion_id', id)
          .order('created_at', { ascending: false });
        return data || [];
      }

      if (type === 'branch') {
        const { data } = await supabase
          .from('liquidacion_sucursal_detalles')
          .select(`
            *,
            envio:envios(tracking_number, created_at, estado, tipo_pago,
              clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
          `)
          .eq('liquidacion_id', id)
          .order('created_at', { ascending: false });
        return data || [];
      }

      if (type === 'seller') {
        const { data } = await supabase
          .from('seller_cuenta_corriente')
          .select('*')
          .eq('liquidacion_id', id)
          .order('created_at', { ascending: true });
        return data || [];
      }

      if (type === 'third-party') {
        const { data } = await (supabase
          .from('liquidacion_terciarizado_detalles') as any)
          .select(`
            *,
            envio:envios(tracking_number, tracking_externo, nombre_destinatario, created_at, estado, fecha_entrega, precio_total,
              clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
          `)
          .eq('liquidacion_id', id)
          .order('created_at', { ascending: true });
        return data || [];
      }

      return [];
    },
    enabled: !!id,
  });

  // Fetch branding
  const tenantId = settlement && 'tenant_id' in settlement ? (settlement as any).tenant_id : null;
  const { data: branding } = useQuery({
    queryKey: ['print-settlement-branding', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('tenant_branding')
        .select('logo_light, nombre_app, color_primario')
        .eq('tenant_id', tenantId)
        .single();
      return data;
    },
    enabled: !!tenantId,
  });

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!settlement) return;
    try {
      const brandingData = branding
        ? { logo_light: branding.logo_light, nombre_app: branding.nombre_app, color_primario: (branding as any).color_primario }
        : undefined;
      if (type === 'driver') {
        await downloadDriverSettlementPDF(settlement as any, brandingData);
      } else if (type === 'branch') {
        await downloadBranchSettlementPDF(settlement as any, brandingData);
      } else if (type === 'seller') {
        await downloadSellerSettlementPDF(settlement as any, brandingData);
      }
      toast.success('PDF descargado');
    } catch (e) {
      toast.error('Error al descargar el PDF');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Liquidación no encontrada</p>
        <Button asChild variant="outline">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Link>
        </Button>
      </div>
    );
  }

  const entityName = type === 'driver'
    ? `${(settlement as any).chofer?.nombre || ''} ${(settlement as any).chofer?.apellido || ''}`.trim()
    : type === 'branch'
      ? (settlement as any).sucursal?.nombre || 'N/A'
      : type === 'third-party'
        ? (settlement as any).empresa?.nombre || 'N/A'
        : (settlement as any).seller?.nombre || 'N/A';

  const TypeIcon = type === 'driver' ? Truck : type === 'branch' ? Building2 : type === 'third-party' ? Building2 : User;
  const titleLabel = type === 'driver' ? 'LIQUIDACIÓN DE CHOFER' : type === 'branch' ? 'LIQUIDACIÓN DE SUCURSAL' : type === 'third-party' ? 'LIQUIDACIÓN DE TERCIARIZADO' : 'LIQUIDACIÓN DE SELLER';
  const estado = settlement.estado || 'pendiente';
  const estadoConfig = ESTADO_CONFIG[estado] || ESTADO_CONFIG.pendiente;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link to={type === 'seller' ? '/ecommerce/settlements' : type === 'branch' ? '/settlements/branches' : type === 'third-party' ? '/settlements/third-party' : '/settlements/drivers'}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
          </div>
        </div>

        {/* Settlement Preview */}
        <Card className="shadow-lg print:shadow-none print:border-0 bg-white text-black [&_*]:text-black [&_.text-muted-foreground]:!text-gray-500">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {branding?.logo_light ? (
                  <img src={branding.logo_light} alt="Logo" className="h-12 w-auto object-contain" />
                ) : (
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <TypeIcon className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">{branding?.nombre_app || 'Geologistick'}</p>
                  <CardTitle className="text-lg">{titleLabel}</CardTitle>
                </div>
              </div>
              <Badge variant="outline" className={estadoConfig.className}>
                {estadoConfig.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Info general */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TypeIcon className="h-3 w-3" />
                  {type === 'driver' ? 'Chofer' : type === 'branch' ? 'Sucursal' : 'Seller'}
                </p>
                <p className="font-medium">{entityName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Período
                </p>
                <p className="font-medium">
                  {format(parseDateString(settlement.periodo_inicio), 'dd/MM/yy')} - {format(parseDateString(settlement.periodo_fin), 'dd/MM/yy')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Items</p>
                <p className="font-medium">{items.length}</p>
              </div>
              {settlement.fecha_pago && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Pago
                  </p>
                  <p className="font-medium">
                    {format(new Date(settlement.fecha_pago), 'dd/MM/yy')}
                    {settlement.metodo_pago && ` • ${settlement.metodo_pago}`}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Totals */}
            {type === 'driver' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Envíos liquidados</p>
                  <p className="text-2xl font-bold">{(settlement as any).cantidad_envios || items.length}</p>
                </div>
                <div className="border rounded-lg p-4 bg-success/5 border-success/20">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Monto Total
                  </p>
                  <p className="text-2xl font-bold text-success">{formatCurrency((settlement as any).monto_total)}</p>
                </div>
              </div>
            )}

            {type === 'branch' && (
              <div className="grid grid-cols-3 gap-4">
                <div className="border rounded-lg p-4 bg-success/5 border-success/20">
                  <p className="text-xs text-muted-foreground mb-1">Total Cobrado</p>
                  <p className="text-2xl font-bold text-success">{formatCurrency((settlement as any).total_cobrado || 0)}</p>
                </div>
                <div className="border rounded-lg p-4 bg-warning/5 border-warning/20">
                  <p className="text-xs text-muted-foreground mb-1">Comisiones</p>
                  <p className="text-2xl font-bold text-warning">{formatCurrency((settlement as any).total_comisiones || 0)}</p>
                </div>
                <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Saldo a Transferir</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency((settlement as any).saldo || 0)}</p>
                </div>
              </div>
            )}

            {type === 'seller' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Movimientos</p>
                  <p className="text-2xl font-bold">{(settlement as any).cantidad_movimientos || items.length}</p>
                </div>
                <div className="border rounded-lg p-4 bg-orange-500/5 border-orange-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Total Envíos</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency((settlement as any).total_cargos || 0)}</p>
                </div>
                <div className="border rounded-lg p-4 bg-success/5 border-success/20">
                  <p className="text-xs text-muted-foreground mb-1">Total Pagos</p>
                  <p className="text-2xl font-bold text-success">{formatCurrency((settlement as any).total_pagos || 0)}</p>
                </div>
                <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Saldo Período</p>
                  <p className={`text-2xl font-bold ${((settlement as any).saldo_periodo || 0) > 0 ? 'text-orange-600' : 'text-success'}`}>
                    {formatCurrency((settlement as any).saldo_periodo || 0)}
                  </p>
                </div>
              </div>
            )}

            {type === 'third-party' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Envíos</p>
                  <p className="text-2xl font-bold">{(settlement as any).cantidad_envios || items.length}</p>
                </div>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Monto Neto</p>
                  <p className="text-2xl font-bold">{formatCurrency((settlement as any).monto_neto || 0)}</p>
                </div>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">IVA</p>
                  <p className="text-2xl font-bold text-muted-foreground">{formatCurrency((settlement as any).monto_iva || 0)}</p>
                </div>
                <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">Total</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency((settlement as any).monto_total || 0)}</p>
                </div>
              </div>
            )}

            {/* Detail Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {type === 'seller' ? (
                      <>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Tracking</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Destinatario</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        {type === 'driver' && <TableHead className="text-right">Comisión</TableHead>}
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Sin registros
                      </TableCell>
                    </TableRow>
                  ) : type === 'seller' ? (
                    items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">
                          {item.created_at ? format(new Date(item.created_at), 'dd/MM/yy HH:mm') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.tipo === 'cargo' ? 'default' : 'secondary'} className="text-xs">
                            {item.tipo === 'cargo' ? 'Cargo' : item.tipo === 'pago' ? 'Pago' : 'Ajuste'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.descripcion || item.referencia || '-'}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${item.tipo === 'cargo' ? 'text-orange-600' : 'text-success'}`}>
                          {item.tipo === 'cargo' ? '+' : '-'}{formatCurrency(Math.abs(item.monto))}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    items.map((item: any) => {
                      const envio = item.envio;
                      const dest = envio?.clientes;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{envio?.tracking_externo || envio?.tracking_number || '-'}</TableCell>
                          <TableCell className="text-sm">
                            {envio?.created_at ? format(new Date(envio.created_at), 'dd/MM/yy') : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {dest ? `${dest.nombre || ''} ${dest.apellido || ''}`.trim() : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {type === 'branch'
                              ? formatCurrency(item.monto_envio || 0)
                              : formatCurrency(envio?.precio_total || 0)}
                          </TableCell>
                          {type === 'driver' && (
                            <TableCell className="text-right font-medium text-success">
                              {formatCurrency(item.monto || 0)}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Notas */}
            {settlement.notas && (
              <div className="border rounded-lg p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-1">NOTAS</p>
                <p className="text-sm">{settlement.notas}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center text-xs text-muted-foreground pt-4 border-t">
              <span>Generado el {format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}</span>
              <Badge variant="secondary" className="text-xs print:hidden">VISTA PREVIA</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
