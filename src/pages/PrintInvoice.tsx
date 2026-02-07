import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Package, Printer, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

const TIPO_COMPROBANTE_LABELS: Record<string, string> = {
  'factura_a': 'FACTURA A',
  'factura_b': 'FACTURA B',
  'factura_c': 'FACTURA C',
  'nota_credito_a': 'NOTA DE CRÉDITO A',
  'nota_credito_b': 'NOTA DE CRÉDITO B',
  'nota_credito_c': 'NOTA DE CRÉDITO C',
};

const CONDICION_IVA_LABELS: Record<string, string> = {
  responsable_inscripto: 'IVA Responsable Inscripto',
  monotributista: 'Responsable Monotributo',
  exento: 'IVA Sujeto Exento',
  consumidor_final: 'Consumidor Final',
  no_responsable: 'No Responsable',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatNumeroComprobante(puntoVenta: number, numero: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
}

export default function PrintInvoice() {
  const [searchParams] = useSearchParams();
  const envioId = searchParams.get('id');

  // Fetch factura
  const { data: factura, isLoading: loadingFactura } = useQuery({
    queryKey: ['print-factura', envioId],
    queryFn: async () => {
      if (!envioId) return null;
      const { data, error } = await supabase
        .from('facturas')
        .select('*')
        .eq('envio_id', envioId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!envioId,
  });

  // Fetch envio with relations
  const { data: envio } = useQuery({
    queryKey: ['print-invoice-envio', envioId],
    queryFn: async () => {
      if (!envioId) return null;
      const { data, error } = await supabase
        .from('envios')
        .select(`
          *,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, direccion, ciudad, dni_cuit),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, direccion, ciudad, dni_cuit)
        `)
        .eq('id', envioId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!envioId,
  });

  // Fetch detalles
  const { data: detalles } = useQuery({
    queryKey: ['print-invoice-detalles', envioId],
    queryFn: async () => {
      if (!envioId) return [];
      const { data, error } = await supabase
        .from('envio_detalles')
        .select('nombre_concepto, monto')
        .eq('envio_id', envioId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!envioId,
  });

  // Fetch ARCA config for emisor data
  const { data: arcaConfig } = useQuery({
    queryKey: ['print-invoice-arca', envio?.tenant_id],
    queryFn: async () => {
      if (!envio?.tenant_id) return null;
      const { data, error } = await supabase
        .from('arca_config')
        .select('*')
        .eq('tenant_id', envio.tenant_id)
        .eq('is_active', true)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!envio?.tenant_id,
  });

  // Fetch branding
  const { data: branding } = useQuery({
    queryKey: ['print-invoice-branding', envio?.tenant_id],
    queryFn: async () => {
      if (!envio?.tenant_id) return null;
      const { data, error } = await supabase
        .from('tenant_branding')
        .select('logo_light, nombre_app')
        .eq('tenant_id', envio.tenant_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!envio?.tenant_id,
  });

  const isFacturaA = factura?.tipo_comprobante?.includes('_a');
  const isSandbox = arcaConfig?.environment === 'sandbox';

  // QR data for AFIP (simplified version)
  const qrData = factura ? JSON.stringify({
    ver: 1,
    fecha: factura.fecha_emision,
    cuit: arcaConfig?.cuit || '',
    ptoVta: factura.punto_venta,
    tipoCmp: factura.tipo_comprobante,
    nroCmp: factura.numero_comprobante,
    importe: factura.importe_total,
    cae: factura.cae,
  }) : '';

  // Build conceptos
  const fleteEnDetalles = (detalles || []).find(d => d.nombre_concepto?.toLowerCase() === 'flete');
  const totalConceptos = (detalles || []).reduce((sum, d) => sum + (d.monto || 0), 0);
  const fleteCalculado = (envio?.precio_total || 0) - totalConceptos;
  const conceptosAMostrar = fleteEnDetalles
    ? (detalles || [])
    : [{ nombre_concepto: 'Flete', monto: fleteCalculado > 0 ? fleteCalculado : (envio?.precio_total || 0) }, ...(detalles || [])];

  const handlePrint = () => window.print();

  const handleDownloadPDF = () => {
    if (!factura) return;
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const tipoLabel = TIPO_COMPROBANTE_LABELS[factura.tipo_comprobante] || factura.tipo_comprobante;
    doc.text(tipoLabel, pw / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(12);
    doc.text(`N.o ${formatNumeroComprobante(factura.punto_venta, factura.numero_comprobante)}`, pw / 2, y, { align: 'center' });
    y += 10;

    if (isSandbox) {
      doc.setFontSize(10);
      doc.setTextColor(200, 0, 0);
      doc.text('DOCUMENTO NO FISCAL - SANDBOX', pw / 2, y, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      y += 8;
    }

    doc.setDrawColor(200); doc.line(20, y, pw - 20, y); y += 8;

    // Emisor
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('EMISOR', 20, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Razon Social: ${arcaConfig?.razon_social || '-'}`, 20, y); y += 5;
    doc.text(`CUIT: ${arcaConfig?.cuit || '-'}`, 20, y); y += 5;
    doc.text(`Condicion IVA: ${CONDICION_IVA_LABELS[arcaConfig?.condicion_iva || ''] || '-'}`, 20, y); y += 5;
    if (arcaConfig?.domicilio_comercial) { doc.text(`Domicilio: ${arcaConfig.domicilio_comercial}`, 20, y); y += 5; }
    doc.text(`Fecha: ${factura.fecha_emision ? format(new Date(factura.fecha_emision), 'dd/MM/yyyy') : '-'}`, 20, y); y += 8;

    // Receptor
    doc.setFont('helvetica', 'bold');
    doc.text('RECEPTOR', 20, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`Nombre: ${factura.receptor_nombre || '-'}`, 20, y); y += 5;
    doc.text(`CUIT/DNI: ${factura.receptor_cuit || '-'}`, 20, y); y += 5;
    doc.text(`Condicion IVA: ${CONDICION_IVA_LABELS[factura.receptor_condicion_iva || ''] || '-'}`, 20, y); y += 5;
    if (factura.receptor_domicilio) { doc.text(`Domicilio: ${factura.receptor_domicilio}`, 20, y); y += 5; }
    y += 5;

    doc.setDrawColor(200); doc.line(20, y, pw - 20, y); y += 8;

    // Conceptos
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE', 20, y); y += 7;
    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(20, y - 4, pw - 40, 8, 'F');
    doc.text('Concepto', 22, y);
    doc.text('Importe', 160, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    conceptosAMostrar.forEach((c) => {
      doc.text(c.nombre_concepto || '-', 22, y);
      doc.text(formatCurrency(c.monto || 0), 160, y);
      y += 6;
    });

    y += 4;
    if (isFacturaA && factura.importe_iva) {
      doc.text(`Neto Gravado: ${formatCurrency(factura.importe_neto)}`, 120, y); y += 5;
      doc.text(`IVA (21%): ${formatCurrency(factura.importe_iva)}`, 120, y); y += 5;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`TOTAL: ${formatCurrency(factura.importe_total)}`, 120, y); y += 12;

    // CAE
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`CAE: ${factura.cae || '-'}`, 20, y); y += 5;
    doc.text(`Vto. CAE: ${factura.cae_vencimiento ? format(new Date(factura.cae_vencimiento), 'dd/MM/yyyy') : '-'}`, 20, y);

    // Footer
    const fy = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(8); doc.setTextColor(128);
    doc.text(`Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pw / 2, fy, { align: 'center' });

    const fileName = `factura-${formatNumeroComprobante(factura.punto_venta, factura.numero_comprobante)}-${envio?.tracking_number || ''}.pdf`;
    doc.save(fileName);
    toast.success('Factura descargada');
  };

  if (loadingFactura) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!factura) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Factura no encontrada</p>
        <Button asChild variant="outline">
          <Link to="/shipments">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Envíos
          </Link>
        </Button>
      </div>
    );
  }

  const tipoLabel = TIPO_COMPROBANTE_LABELS[factura.tipo_comprobante] || factura.tipo_comprobante;
  const letraComprobante = factura.tipo_comprobante?.split('_').pop()?.toUpperCase() || '';

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto">
        {/* Header - hidden on print */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link to="/shipments">
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

        {/* Invoice Preview */}
        <Card className="shadow-lg print:shadow-none print:border-0">
          {/* Sandbox Banner */}
          {isSandbox && (
            <div className="bg-red-500/10 border-b border-red-500/20 text-center py-2 print:py-1">
              <p className="text-sm font-bold text-red-600">DOCUMENTO NO FISCAL - SANDBOX</p>
            </div>
          )}

          <CardHeader className="border-b">
            <div className="flex items-start justify-between">
              {/* Left: Logo + Emisor */}
              <div className="flex items-start gap-4 flex-1">
                {branding?.logo_light ? (
                  <img src={branding.logo_light} alt="Logo" className="h-14 w-auto object-contain" />
                ) : (
                  <div className="h-14 w-14 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Package className="h-7 w-7 text-primary" />
                  </div>
                )}
                <div className="text-sm">
                  <p className="font-bold text-lg">{arcaConfig?.razon_social || branding?.nombre_app || 'Geologistick'}</p>
                  <p className="text-muted-foreground">CUIT: {arcaConfig?.cuit || '-'}</p>
                  <p className="text-muted-foreground">{CONDICION_IVA_LABELS[arcaConfig?.condicion_iva || ''] || '-'}</p>
                  {arcaConfig?.domicilio_comercial && (
                    <p className="text-muted-foreground">{arcaConfig.domicilio_comercial}</p>
                  )}
                  {arcaConfig?.inicio_actividades && (
                    <p className="text-muted-foreground text-xs">Inicio Act.: {arcaConfig.inicio_actividades}</p>
                  )}
                </div>
              </div>

              {/* Center: Letra */}
              <div className="flex flex-col items-center mx-4">
                <div className="w-16 h-16 border-2 border-foreground rounded-lg flex items-center justify-center">
                  <span className="text-3xl font-bold">{letraComprobante}</span>
                </div>
                <p className="text-xs mt-1 text-muted-foreground">Cod. {factura.tipo_comprobante === 'factura_a' ? '01' : factura.tipo_comprobante === 'factura_b' ? '06' : '11'}</p>
              </div>

              {/* Right: Número + Fecha */}
              <div className="text-right flex-1">
                <p className="font-bold text-lg">{tipoLabel}</p>
                <p className="text-lg font-mono">
                  Nº {formatNumeroComprobante(factura.punto_venta, factura.numero_comprobante)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Fecha: {factura.fecha_emision ? format(new Date(factura.fecha_emision), "d 'de' MMMM 'de' yyyy", { locale: es }) : '-'}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Receptor */}
            <div className="border rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">DATOS DEL RECEPTOR</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Razón Social: </span>
                  <span className="font-medium">{factura.receptor_nombre || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">CUIT/DNI: </span>
                  <span className="font-medium">{factura.receptor_cuit || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Condición IVA: </span>
                  <span className="font-medium">{CONDICION_IVA_LABELS[factura.receptor_condicion_iva || ''] || '-'}</span>
                </div>
                {factura.receptor_domicilio && (
                  <div>
                    <span className="text-muted-foreground">Domicilio: </span>
                    <span className="font-medium">{factura.receptor_domicilio}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Envío reference */}
            {envio && (
              <div className="text-sm text-muted-foreground">
                Envío asociado: <span className="font-mono font-medium text-foreground">{envio.tracking_number}</span>
              </div>
            )}

            {/* Conceptos */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b">
                <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>CONCEPTO</span>
                  <span>IMPORTE</span>
                </div>
              </div>
              <div className="divide-y">
                {conceptosAMostrar.map((c, i) => (
                  <div key={i} className="flex justify-between px-4 py-3 text-sm">
                    <span>{c.nombre_concepto}</span>
                    <span className="font-medium">{formatCurrency(c.monto || 0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border rounded-lg p-4">
              {isFacturaA && factura.importe_iva ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Neto Gravado:</span>
                    <span>{formatCurrency(factura.importe_neto)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IVA (21%):</span>
                    <span>{formatCurrency(factura.importe_iva)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>TOTAL:</span>
                    <span className="text-primary">{formatCurrency(factura.importe_total)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL:</span>
                  <span className="text-primary">{formatCurrency(factura.importe_total)}</span>
                </div>
              )}
            </div>

            {/* CAE + QR */}
            <div className="border rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-lg border">
                  <QRCodeSVG value={qrData || 'N/A'} size={80} />
                </div>
                <div className="text-sm">
                  <p className="font-semibold">CAE: {factura.cae || '-'}</p>
                  <p className="text-muted-foreground">
                    Vto. CAE: {factura.cae_vencimiento ? format(new Date(factura.cae_vencimiento), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>
                {isSandbox ? 'DOCUMENTO NO FISCAL - Generado en entorno de pruebas' : 'Comprobante electrónico'}
              </span>
              <Badge variant="secondary" className="text-xs print:hidden">
                VISTA PREVIA
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
