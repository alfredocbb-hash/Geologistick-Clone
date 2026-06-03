import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Download, FileText, Printer, Building2, Calendar, DollarSign, CreditCard, User, Receipt, Wallet, FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '@/lib/exportExcel';
 import { AlertTriangle } from 'lucide-react';
 import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateString } from '@/lib/dateUtils';
import jsPDF from 'jspdf';
import { ConceptBreakdownTable, type ResumenPorTipoPago } from './ConceptBreakdownTable';
import { rebuildResumenFromDetalles, resumenHasRoleSeparation } from '@/lib/rebuildResumenConceptos';

interface BranchSettlement {
  id: string;
  sucursal_id: string;
  sucursal?: { nombre: string };
  periodo_inicio: string;
  periodo_fin: string;
  total_cobrado: number | null;
  total_comisiones: number | null;
  saldo: number | null;
  estado: string | null;
  notas: string | null;
  created_at: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  resumen_conceptos?: ResumenPorTipoPago | null;
   remitos_cancelados?: {
     cantidad: number;
     totalCobrado: number;
   } | null;
   conceptos_sin_config?: Array<{
     concepto: string;
     tipoPago: string;
     rol: string;
   }> | null;
}

interface DriverSettlement {
  id: string;
  chofer_id: string;
  chofer?: { nombre: string; apellido: string | null };
  periodo_inicio: string;
  periodo_fin: string;
  monto_total: number;
  cantidad_envios: number | null;
  estado: string | null;
  notas: string | null;
  created_at: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
}

interface SettlementDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settlementId: string | null;
  type: 'branch' | 'driver';
  settlement?: BranchSettlement | DriverSettlement | null;
}

export function SettlementDetailDialog({
  open,
  onOpenChange,
  settlementId,
  type,
  settlement,
}: SettlementDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('resumen');

  // Fetch detalles for branch settlements
  const { data: branchDetalles = [] } = useQuery({
    queryKey: ['liquidacion-sucursal-detalles', settlementId],
    queryFn: async () => {
      if (!settlementId || type !== 'branch') return [];
      const { data, error } = await supabase
        .from('liquidacion_sucursal_detalles')
        .select(`
          *,
          envio:envios(tracking_number, tracking_externo, estado, created_at, nombre_destinatario, ciudad_entrega, direccion_entrega, destinatario_id, clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
        `)
        .eq('liquidacion_id', settlementId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!settlementId && type === 'branch',
  });

  // Fetch comisiones for driver settlements
  const { data: driverComisiones = [] } = useQuery({
    queryKey: ['liquidacion-chofer-comisiones', settlementId],
    queryFn: async () => {
      if (!settlementId || type !== 'driver') return [];
      const { data, error } = await supabase
        .from('comisiones')
        .select(`
          *,
          envio:envios(tracking_number, tracking_externo, estado, created_at, precio_total, pago_contra_entrega, nombre_destinatario, ciudad_entrega, direccion_entrega, destinatario_id, clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
        `)
        .eq('liquidacion_id', settlementId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!settlementId && type === 'driver',
  });

  if (!settlement) return null;

  const isBranch = type === 'branch';
  const branchData = settlement as BranchSettlement;
  const driverData = settlement as DriverSettlement;

  // Driver COD derived totals
  const driverTotalComisiones = !isBranch
    ? (driverComisiones as any[]).reduce((s, c) => s + (Number(c.monto) || 0), 0)
    : 0;
  const driverTotalCobradoDestino = !isBranch
    ? (driverComisiones as any[]).reduce((s, c) => s + (c.envio?.pago_contra_entrega ? (Number(c.envio?.precio_total) || 0) : 0), 0)
    : 0;
  const driverTotalDescontado = !isBranch
    ? Math.max(0, driverTotalComisiones - (driverData.monto_total || 0))
    : 0;
  const driverHasCOD = !isBranch && (driverComisiones as any[]).some((c: any) => c.envio?.pago_contra_entrega);

  const getEstadoBadge = (estado: string | null) => {
    const config: Record<string, { label: string; className: string }> = {
      pendiente: { label: 'Pendiente', className: 'bg-warning/10 text-warning border-warning' },
      aprobada: { label: 'Aprobada', className: 'bg-success/10 text-success border-success' },
      generada: { label: 'Generada', className: 'bg-warning/10 text-warning border-warning' },
      pagada: { label: 'Pagada', className: 'bg-success/10 text-success border-success' },
      rechazada: { label: 'Rechazada', className: 'bg-destructive/10 text-destructive border-destructive' },
    };
    const c = config[estado || 'pendiente'] || { label: estado || 'Desconocido', className: '' };
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(isBranch ? 'LIQUIDACIÓN DE SUCURSAL' : 'LIQUIDACIÓN DE CHOFER', pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Info general
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    if (isBranch) {
      doc.text(`Sucursal: ${branchData.sucursal?.nombre || 'N/A'}`, 20, y);
    } else {
      doc.text(`Chofer: ${driverData.chofer?.nombre || ''} ${driverData.chofer?.apellido || ''}`, 20, y);
    }
    y += 7;

    doc.text(`Período: ${format(parseDateString(settlement.periodo_inicio), 'dd/MM/yyyy')} - ${format(parseDateString(settlement.periodo_fin), 'dd/MM/yyyy')}`, 20, y);
    y += 7;

    doc.text(`Estado: ${settlement.estado || 'Pendiente'}`, 20, y);
    y += 7;

    if (settlement.fecha_pago) {
      doc.text(`Fecha de Pago: ${format(new Date(settlement.fecha_pago), 'dd/MM/yyyy HH:mm')}`, 20, y);
      y += 7;
    }

    if (settlement.metodo_pago) {
      doc.text(`Método de Pago: ${settlement.metodo_pago}`, 20, y);
      y += 7;
    }

    if (settlement.referencia_pago) {
      doc.text(`Referencia: ${settlement.referencia_pago}`, 20, y);
      y += 7;
    }

    y += 5;

    // Totales
    doc.setFillColor(245, 245, 245);
    doc.rect(20, y, pageWidth - 40, 25, 'F');
    y += 8;

    doc.setFont('helvetica', 'bold');
    if (isBranch) {
      doc.text(`Total Cobrado: $${(branchData.total_cobrado || 0).toFixed(2)}`, 25, y);
      y += 7;
      doc.text(`Total Comisiones: $${(branchData.total_comisiones || 0).toFixed(2)}`, 25, y);
      y += 7;
      doc.setFontSize(13);
      doc.text(`SALDO A TRANSFERIR: $${(branchData.saldo || 0).toFixed(2)}`, 25, y);
    } else {
      doc.text(`Cantidad de Envíos: ${driverData.cantidad_envios || 0}`, 25, y);
      y += 7;
      doc.text(`Comisiones: $${driverTotalComisiones.toFixed(2)}`, 25, y);
      y += 7;
      if (driverHasCOD) {
        doc.text(`Cobrado en Destino: $${driverTotalCobradoDestino.toFixed(2)}`, 25, y);
        y += 7;
        doc.text(`Descontado al chofer: $${driverTotalDescontado.toFixed(2)}`, 25, y);
        y += 7;
      }
      doc.setFontSize(13);
      doc.text(`MONTO NETO A PAGAR: $${driverData.monto_total.toFixed(2)}`, 25, y);
    }
    y += 15;

    // Detalle de envíos
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DE ENVÍOS', 20, y);
    y += 8;

    // Headers de tabla
    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
    doc.text('Tracking', 22, y);
    doc.text('Fecha', 55, y);
    doc.text('Destinatario', 78, y);
    doc.text('Localidad', 120, y);
    if (!isBranch) {
      doc.text('COD', 150, y);
      doc.text('Cobrado', 162, y);
      doc.text('Comisión', 185, y);
    } else {
      doc.text('Monto', 175, y);
    }
    y += 8;

    doc.setFont('helvetica', 'normal');
    const items = isBranch ? branchDetalles : driverComisiones;

    items.forEach((item: any, index: number) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const envio = item.envio;
      const destinatario = envio?.clientes;
      const tracking = envio?.tracking_externo || envio?.tracking_number || '-';
      const fecha = envio?.created_at ? format(new Date(envio.created_at), 'dd/MM/yy') : '-';
      const nombre = destinatario ? `${destinatario.nombre || ''} ${destinatario.apellido || ''}`.trim() : envio?.nombre_destinatario || '-';
      const localidad = envio?.ciudad_entrega || '-';
      const monto = isBranch 
        ? `$${(item.monto_envio || 0).toFixed(2)}`
        : `$${(item.monto || 0).toFixed(2)}`;

      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(20, y - 4, pageWidth - 40, 7, 'F');
      }

      doc.text(String(tracking).substring(0, 14), 22, y);
      doc.text(fecha, 55, y);
      doc.text(nombre.substring(0, 20), 78, y);
      doc.text(String(localidad).substring(0, 14), 120, y);
      if (!isBranch) {
        const isCOD = !!envio?.pago_contra_entrega;
        doc.text(isCOD ? 'Sí' : '—', 150, y);
        doc.text(isCOD ? `$${(Number(envio?.precio_total) || 0).toFixed(2)}` : '—', 162, y);
        doc.text(`$${(item.monto || 0).toFixed(2)}`, 185, y);
      } else {
        doc.text(monto, 175, y);
      }
      y += 7;
    });

    // Totales del chofer al cierre de la tabla
    if (!isBranch) {
      if (y > 260) { doc.addPage(); y = 20; }
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(20, y, pageWidth - 20, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Total Comisiones: $${driverTotalComisiones.toFixed(2)}`, 22, y);
      y += 6;
      if (driverHasCOD) {
        doc.text(`Total Cobrado en Destino: $${driverTotalCobradoDestino.toFixed(2)}`, 22, y);
        y += 6;
        doc.text(`Total Descontado: $${driverTotalDescontado.toFixed(2)}`, 22, y);
        y += 6;
      }
      doc.text(`Neto a Pagar: $${driverData.monto_total.toFixed(2)}`, 22, y);
    }

    // Footer
    y = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, y, { align: 'center' });

    // Guardar
    const fileName = isBranch 
      ? `liquidacion-sucursal-${branchData.sucursal?.nombre || 'N-A'}-${format(new Date(settlement.periodo_fin), 'yyyy-MM-dd')}.pdf`
      : `liquidacion-chofer-${driverData.chofer?.nombre || 'N-A'}-${format(new Date(settlement.periodo_fin), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const items: any[] = isBranch ? (branchDetalles as any[]) : (driverComisiones as any[]);
    const data = items.map((item: any) => {
      const envio = item.envio;
      const destinatario = envio?.clientes;
      const nombre = destinatario
        ? `${destinatario.nombre || ''} ${destinatario.apellido || ''}`.trim()
        : envio?.nombre_destinatario || '';
      return {
        tracking: envio?.tracking_externo || envio?.tracking_number || '',
        fecha: envio?.created_at ? format(new Date(envio.created_at), 'dd/MM/yyyy', { locale: es }) : '',
        destinatario: nombre,
        localidad: envio?.ciudad_entrega || '',
        direccion: envio?.direccion_entrega || '',
        rol: isBranch ? (item.rol === 'recepcion' ? 'Recepción' : 'Emisión') : '',
        estado: envio?.estado || '',
        cod: isBranch ? '' : (envio?.pago_contra_entrega ? 'Sí' : ''),
        cobrado_destino: isBranch ? 0 : (envio?.pago_contra_entrega ? Number(envio?.precio_total || 0) : 0),
        monto: isBranch ? Number(item.monto_envio || 0) : Number(item.monto || 0),
        comision: isBranch ? Number(item.comision_aplicada || 0) : Number(item.monto || 0),
      };
    });

    const baseCols = [
      { header: 'Tracking', key: 'tracking' as const },
      { header: 'Fecha', key: 'fecha' as const },
      { header: 'Destinatario', key: 'destinatario' as const },
      { header: 'Localidad', key: 'localidad' as const },
      { header: 'Dirección', key: 'direccion' as const },
    ];
    const columns = isBranch
      ? [
          ...baseCols,
          { header: 'Rol', key: 'rol' as const },
          { header: 'Estado', key: 'estado' as const },
          { header: 'Monto Envío', key: 'monto' as const, format: 'currency' as const },
          { header: 'Comisión', key: 'comision' as const, format: 'currency' as const },
        ]
      : [
          ...baseCols,
          { header: 'Estado', key: 'estado' as const },
          { header: 'COD', key: 'cod' as const },
          { header: 'Cobrado en Destino', key: 'cobrado_destino' as const, format: 'currency' as const },
          { header: 'Comisión', key: 'comision' as const, format: 'currency' as const },
        ];

    const periodo = format(new Date(settlement.periodo_fin), 'yyyy-MM-dd');
    const nombreEntidad = isBranch
      ? branchData.sucursal?.nombre || 'sucursal'
      : `${driverData.chofer?.nombre || ''}-${driverData.chofer?.apellido || ''}`.trim() || 'chofer';
    const filename = isBranch
      ? `liquidacion-sucursal-${nombreEntidad}-${periodo}`
      : `liquidacion-chofer-${nombreEntidad}-${periodo}`;

    exportToExcel({
      filename,
      sheetName: 'Detalle de Envíos',
      columns,
      data,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isBranch ? (
                <>
                  <Building2 className="h-5 w-5" />
                  Liquidación de Sucursal
                </>
              ) : (
                <>
                  <User className="h-5 w-5" />
                  Liquidación de Chofer
                </>
              )}
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={`/print-settlement?id=${settlementId}&type=${type}`} target="_blank" rel="noopener noreferrer">
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimir
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={generatePDF}>
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="detalle">Detalle de Envíos</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-4">
            {/* Info Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      {isBranch ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {isBranch ? 'Sucursal' : 'Chofer'}
                    </p>
                    <p className="font-medium">
                      {isBranch 
                        ? branchData.sucursal?.nombre || 'N/A'
                        : `${driverData.chofer?.nombre || ''} ${driverData.chofer?.apellido || ''}`
                      }
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Período
                    </p>
                    <p className="font-medium">
                      {format(new Date(settlement.periodo_inicio), 'dd/MM/yy')} - {format(new Date(settlement.periodo_fin), 'dd/MM/yy')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Estado</p>
                    {getEstadoBadge(settlement.estado)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Envíos
                    </p>
                    <p className="font-medium">
                      {isBranch ? branchDetalles.length : driverData.cantidad_envios || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Totales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {isBranch ? (
                <>
                  <Card className="bg-success/5 border-success/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-success" />
                        <span className="text-sm text-muted-foreground">Total Cobrado</span>
                      </div>
                      <p className="text-2xl font-bold text-success">
                        ${(branchData.total_cobrado || 0).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-warning/5 border-warning/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="h-4 w-4 text-warning" />
                        <span className="text-sm text-muted-foreground">Comisiones</span>
                      </div>
                      <p className="text-2xl font-bold text-warning">
                        ${(branchData.total_comisiones || 0).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Saldo</span>
                      </div>
                      <p className="text-2xl font-bold text-primary">
                        ${(branchData.saldo || 0).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  <Card className="bg-warning/5 border-warning/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-warning" />
                        <span className="text-sm text-muted-foreground">Comisiones</span>
                      </div>
                      <p className="text-2xl font-bold text-warning">
                        ${driverTotalComisiones.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  {driverHasCOD && (
                    <>
                      <Card className="bg-success/5 border-success/20">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Wallet className="h-4 w-4 text-success" />
                            <span className="text-sm text-muted-foreground">Cobrado en Destino</span>
                          </div>
                          <p className="text-2xl font-bold text-success">
                            ${driverTotalCobradoDestino.toFixed(2)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-destructive/5 border-destructive/20">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Receipt className="h-4 w-4 text-destructive" />
                            <span className="text-sm text-muted-foreground">Descontado al chofer</span>
                          </div>
                          <p className="text-2xl font-bold text-destructive">
                            ${driverTotalDescontado.toFixed(2)}
                          </p>
                        </CardContent>
                      </Card>
                    </>
                  )}
                  <Card className="bg-primary/5 border-primary/20 col-span-full">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground">Monto Neto a Pagar</span>
                      </div>
                      <p className="text-3xl font-bold text-primary">
                        ${driverData.monto_total.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Payment info if paid */}
            {isBranch && (() => {
              const stored = branchData.resumen_conceptos;
              const resumen = (stored && resumenHasRoleSeparation(stored))
                ? stored
                : branchDetalles.length > 0
                  ? rebuildResumenFromDetalles(branchDetalles as any)
                  : stored;
              return resumen ? <ConceptBreakdownTable resumen={resumen} /> : null;
            })()}

             {/* Remitos Cancelados section for branch settlements */}
             {isBranch && branchData.remitos_cancelados && branchData.remitos_cancelados.cantidad > 0 && (
               <Card className="bg-blue-500/5 border-blue-500/20">
                 <CardContent className="p-4">
                   <div className="flex items-center gap-2 mb-2">
                     <Receipt className="h-4 w-4 text-blue-500" />
                     <span className="text-sm text-muted-foreground">Cancelación de Remitos</span>
                   </div>
                   <p className="text-2xl font-bold text-blue-500">
                     {branchData.remitos_cancelados.cantidad} remitos
                   </p>
                   <p className="text-sm text-muted-foreground">
                     Total cobrado: ${branchData.remitos_cancelados.totalCobrado.toFixed(2)}
                   </p>
                 </CardContent>
               </Card>
             )}

             {/* Missing configurations warning */}
             {isBranch && branchData.conceptos_sin_config && branchData.conceptos_sin_config.length > 0 && (
               <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
                 <AlertTriangle className="h-4 w-4 text-amber-500" />
                 <AlertTitle className="text-amber-600">Configuración Incompleta</AlertTitle>
                 <AlertDescription className="text-amber-600/80">
                   Los siguientes conceptos no tienen comisión configurada:
                   <ul className="mt-2 list-disc list-inside">
                     {branchData.conceptos_sin_config.map((c, i) => (
                       <li key={i}>{c.concepto} ({c.tipoPago} - {c.rol})</li>
                     ))}
                   </ul>
                 </AlertDescription>
               </Alert>
             )}

            {/* Payment info if paid */}
            {settlement.estado === 'pagada' && settlement.fecha_pago && (
              <Card className="bg-success/5 border-success/20">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Información de Pago
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Fecha de Pago</p>
                      <p className="font-medium">{format(new Date(settlement.fecha_pago), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Método</p>
                      <p className="font-medium capitalize">{settlement.metodo_pago || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Referencia</p>
                      <p className="font-medium">{settlement.referencia_pago || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notas */}
            {settlement.notas && (
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Notas</h4>
                  <p className="text-sm text-muted-foreground">{settlement.notas}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="detalle">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Tracking</TableHead>
                     <TableHead>Fecha</TableHead>
                     <TableHead>Destinatario</TableHead>
                     {isBranch && <TableHead>Rol</TableHead>}
                     <TableHead>Estado</TableHead>
                     {!isBranch && <TableHead>COD</TableHead>}
                     {!isBranch && <TableHead className="text-right">Cobrado en Destino</TableHead>}
                     <TableHead className="text-right">
                       {isBranch ? 'Monto Envío' : 'Comisión'}
                     </TableHead>
                     {isBranch && <TableHead className="text-right">Comisión</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(isBranch ? branchDetalles : driverComisiones).length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={isBranch ? 7 : 7} className="text-center text-muted-foreground py-8">
                        No hay detalles disponibles
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                    {(isBranch ? branchDetalles : driverComisiones).map((item: any) => {
                      const envio = item.envio;
                      const destinatario = envio?.clientes;
                      const isCOD = !isBranch && !!envio?.pago_contra_entrega;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">
                            {envio?.tracking_externo || envio?.tracking_number || '-'}
                          </TableCell>
                          <TableCell>
                            {envio?.created_at ? format(new Date(envio.created_at), 'dd/MM/yy', { locale: es }) : '-'}
                          </TableCell>
                          <TableCell>
                             {destinatario ? `${destinatario.nombre || ''} ${destinatario.apellido || ''}`.trim() : envio?.nombre_destinatario || '-'}
                           </TableCell>
                           {isBranch && (
                             <TableCell>
                               <Badge variant="outline" className={`text-xs ${item.rol === 'recepcion' ? 'bg-success/10 text-success border-success' : 'bg-primary/10 text-primary border-primary'}`}>
                                 {item.rol === 'recepcion' ? 'Recepción' : 'Emisión'}
                               </Badge>
                             </TableCell>
                           )}
                           <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {envio?.estado || '-'}
                            </Badge>
                          </TableCell>
                          {!isBranch && (
                            <TableCell>
                              {isCOD ? (
                                <Badge variant="outline" className="text-xs bg-success/10 text-success border-success">Sí</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}
                          {!isBranch && (
                            <TableCell className="text-right font-medium text-success">
                              {isCOD ? `$${(Number(envio?.precio_total) || 0).toFixed(2)}` : '—'}
                            </TableCell>
                          )}
                          <TableCell className="text-right font-medium">
                            ${isBranch 
                              ? (item.monto_envio || 0).toFixed(2)
                              : (item.monto || 0).toFixed(2)
                            }
                          </TableCell>
                          {isBranch && (
                            <TableCell className="text-right text-warning">
                              ${(item.comision_aplicada || 0).toFixed(2)}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                    {!isBranch && (
                      <TableRow className="bg-muted/40 font-semibold">
                        <TableCell colSpan={3}>Totales</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right text-success">
                          ${driverTotalCobradoDestino.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${driverTotalComisiones.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    )}
                    {!isBranch && driverHasCOD && (
                      <TableRow className="bg-muted/20 text-sm">
                        <TableCell colSpan={5} className="text-right text-muted-foreground">
                          Descontado al chofer:
                        </TableCell>
                        <TableCell className="text-right text-destructive font-semibold">
                          -${driverTotalDescontado.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          Neto: ${driverData.monto_total.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
