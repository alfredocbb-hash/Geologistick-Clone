import { useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Package, Printer, Download, FileText, AlertTriangle, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { calcLineSubtotal, type LineItem } from '@/components/invoicing/InvoiceLineItems';

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

/**
 * Normaliza el tipo_comprobante para soportar tanto el formato corto ('A','B','C')
 * como el formato largo ('factura_a','factura_b','factura_c').
 */
function normalizarTipoComprobante(tipo: string | null | undefined): string {
  if (!tipo) return '';
  if (tipo.length === 1) return `factura_${tipo.toLowerCase()}`;
  return tipo;
}

/**
 * Extrae la fecha fiscal (YYYY-MM-DD) sin drift de timezone.
 * Usa slice(0,10) sobre el string ISO almacenado en DB.
 */
function getFechaFiscal(fechaEmision: string | null | undefined): string {
  if (!fechaEmision) return format(new Date(), 'yyyy-MM-dd');
  // Si viene como "2026-03-02T00:00:00+00" o "2026-03-02 00:00:00+00", tomar solo la parte de fecha
  return fechaEmision.slice(0, 10);
}

/**
 * Formatea fecha fiscal para mostrar en la factura (sin timezone drift).
 */
function formatFechaFiscalDisplay(fechaFiscal: string): string {
  // fechaFiscal es "YYYY-MM-DD" – parseamos manualmente para evitar timezone
  const [year, month, day] = fechaFiscal.split('-').map(Number);
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${day} de ${months[month - 1]} de ${year}`;
}

/**
 * Genera la URL del QR AFIP conforme a la RG 4291/2018.
 * Formato: https://www.afip.gob.ar/fe/qr/?p=BASE64_JSON
 */
function buildAfipQRUrl(
  factura: {
    fecha_emision?: string | null;
    punto_venta: number;
    tipo_comprobante: string;
    numero_comprobante: number;
    importe_total: number;
    cae?: string | null;
    receptor_condicion_iva?: string | null;
    receptor_cuit?: string | null;
  },
  arcaConfig?: { cuit?: string } | null
): string {
  const tipoCmpMap: Record<string, number> = {
    'A': 1, 'B': 6, 'C': 11,
    'factura_a': 1, 'factura_b': 6, 'factura_c': 11,
    'nota_credito_a': 3, 'nota_credito_b': 8, 'nota_credito_c': 13,
  };
  const tipoCmp = tipoCmpMap[factura.tipo_comprobante] ?? 6;

  const esConsumidorFinal = factura.receptor_condicion_iva === 'consumidor_final';
  const tipoDocRec = esConsumidorFinal ? 99 : 80;
  const nroDocRec = esConsumidorFinal
    ? 0
    : parseInt((factura.receptor_cuit || '').replace(/[-]/g, '')) || 0;

  const cuitEmisor = parseInt((arcaConfig?.cuit || '').replace(/[-]/g, '')) || 0;

  // Usar fecha fiscal estable (sin timezone drift)
  const fechaFiscal = getFechaFiscal(factura.fecha_emision);

  const qrJson = {
    ver: 1,
    fecha: fechaFiscal,
    cuit: cuitEmisor,
    ptoVta: factura.punto_venta || 1,
    tipoCmp,
    nroCmp: factura.numero_comprobante || 1,
    importe: factura.importe_total,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec,
    nroDocRec,
    tipoCodAut: 'E',
    codAut: parseInt(factura.cae || '0') || 0,
  };

  const base64 = btoa(JSON.stringify(qrJson));
  return `https://www.afip.gob.ar/fe/qr/?p=${encodeURIComponent(base64)}`;
}

export default function PrintInvoice() {
  const [searchParams] = useSearchParams();
  const envioId = searchParams.get('id');
  const facturaId = searchParams.get('factura_id');

  // Fetch factura by factura_id or by envio_id
  const { data: factura, isLoading: loadingFactura } = useQuery({
    queryKey: ['print-factura', facturaId, envioId],
    queryFn: async () => {
      if (facturaId) {
        const { data, error } = await supabase
          .from('facturas')
          .select('*, factura_origen:facturas!factura_origen_id(id, punto_venta, numero_comprobante, tipo_comprobante, fecha_emision, cae)')
          .eq('id', facturaId)
          .single();
        if (error) throw error;
        return data;
      }
      if (!envioId) return null;
      const { data, error } = await supabase
        .from('facturas')
        .select('*, factura_origen:facturas!factura_origen_id(id, punto_venta, numero_comprobante, tipo_comprobante, fecha_emision, cae)')
        .eq('envio_id', envioId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!envioId || !!facturaId,
  });

  // Fetch envio with relations (use envioId from URL or from factura.envio_id)
  const resolvedEnvioId = envioId || factura?.envio_id;
  const { data: envio } = useQuery({
    queryKey: ['print-invoice-envio', resolvedEnvioId],
    queryFn: async () => {
      if (!resolvedEnvioId) return null;
      const { data, error } = await supabase
        .from('envios')
        .select(`
          *,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, direccion, ciudad, dni_cuit),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, direccion, ciudad, dni_cuit)
        `)
        .eq('id', resolvedEnvioId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!resolvedEnvioId,
  });

  // Fetch detalles
  const { data: detalles } = useQuery({
    queryKey: ['print-invoice-detalles', resolvedEnvioId],
    queryFn: async () => {
      if (!resolvedEnvioId) return [];
      const { data, error } = await supabase
        .from('envio_detalles')
        .select('nombre_concepto, monto')
        .eq('envio_id', resolvedEnvioId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!resolvedEnvioId,
  });

  // Detect liquidacion-type invoices
  const liquidacionSellerId = (factura as { liquidacion_seller_id?: string } | undefined)?.liquidacion_seller_id;
  const liquidacionTerciarizadoId = (factura as { liquidacion_terciarizado_id?: string } | undefined)?.liquidacion_terciarizado_id;
  const isLiquidacionInvoice = !!(liquidacionSellerId || liquidacionTerciarizadoId);

  // Fetch liquidacion seller details (period info)
  const { data: liquidacionSeller } = useQuery({
    queryKey: ['print-invoice-liq-seller', liquidacionSellerId],
    queryFn: async () => {
      if (!liquidacionSellerId) return null;
      const { data, error } = await supabase
        .from('liquidaciones_seller')
        .select('periodo_inicio, periodo_fin, cantidad_movimientos, total_cargos')
        .eq('id', liquidacionSellerId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!liquidacionSellerId,
  });

  // Fetch envíos vinculados a la liquidación (seller o terciarizado)
  const { data: liquidacionEnvios } = useQuery({
    queryKey: ['print-invoice-liq-envios', liquidacionSellerId, liquidacionTerciarizadoId],
    queryFn: async () => {
      if (liquidacionSellerId) {
        const { data, error } = await supabase
          .from('envios')
          .select('id, tracking_number, tracking_externo, fecha_entrega, ciudad_entrega, precio_total')
          .eq('liquidacion_seller_id', liquidacionSellerId)
          .order('fecha_entrega', { ascending: true });
        if (error) throw error;
        return data || [];
      }
      if (liquidacionTerciarizadoId) {
        const { data, error } = await supabase
          .from('envios')
          .select('id, tracking_number, tracking_externo, fecha_entrega, ciudad_entrega, precio_total')
          .eq('liquidacion_terciarizado_id' as never, liquidacionTerciarizadoId as never)
          .order('fecha_entrega', { ascending: true });
        if (error) throw error;
        return data || [];
      }
      return [];
    },
    enabled: isLiquidacionInvoice,
  });

  // Resolve tenant_id from envio or factura
  const tenantId = envio?.tenant_id || factura?.tenant_id;

  // Fetch ARCA config for emisor data — preferir producción
  const { data: arcaConfig } = useQuery({
    queryKey: ['print-invoice-arca', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data: prodConfig } = await supabase
        .from('arca_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('environment', 'production')
        .maybeSingle();
      if (prodConfig) return prodConfig;
      const { data: sbConfig } = await supabase
        .from('arca_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('environment', 'sandbox')
        .maybeSingle();
      return sbConfig;
    },
    enabled: !!tenantId,
  });

  // Fetch resolved environment from system_integrations (source of truth)
  const { data: resolvedEnvironment } = useQuery({
    queryKey: ['print-invoice-resolved-env', tenantId],
    queryFn: async () => {
      if (!tenantId) return 'sandbox';
      // Check if factura has environment persisted in arca_response
      if (factura?.arca_response && typeof factura.arca_response === 'object') {
        const arcaResp = factura.arca_response as Record<string, unknown>;
        if (arcaResp.environment === 'production' || arcaResp.environment === 'sandbox') {
          return arcaResp.environment as string;
        }
      }
      // Fallback: check system_integrations for production ARCA config
      const { data: prodKeys } = await supabase
        .from('system_integrations')
        .select('config_key')
        .eq('integration_type', 'arca')
        .eq('environment', 'production')
        .eq('is_active', true)
        .eq('tenant_id', tenantId)
        .in('config_key', ['cuit', 'cert_pem', 'private_key', 'punto_venta']);
      // If all 4 required keys exist in production, it's production
      const prodKeyNames = (prodKeys || []).map((k: { config_key: string }) => k.config_key);
      const hasFullProduction = ['cuit', 'cert_pem', 'private_key', 'punto_venta']
        .every(k => prodKeyNames.includes(k));
      if (hasFullProduction) return 'production';
      // Check sandbox
      const { data: sbKeys } = await supabase
        .from('system_integrations')
        .select('config_key')
        .eq('integration_type', 'arca')
        .eq('environment', 'sandbox')
        .eq('is_active', true)
        .eq('tenant_id', tenantId)
        .in('config_key', ['cuit', 'cert_pem', 'private_key', 'punto_venta']);
      const sbKeyNames = (sbKeys || []).map((k: { config_key: string }) => k.config_key);
      const hasFullSandbox = ['cuit', 'cert_pem', 'private_key', 'punto_venta']
        .every(k => sbKeyNames.includes(k));
      if (hasFullSandbox && !hasFullProduction) return 'sandbox';
      // Both or neither — don't label as sandbox
      return 'unknown';
    },
    enabled: !!tenantId && !!factura,
  });

  // Fetch branding
  const { data: branding } = useQuery({
    queryKey: ['print-invoice-branding', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('tenant_branding')
        .select('logo_light, nombre_app')
        .eq('tenant_id', tenantId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!tenantId,
  });

  // Normalizar tipo_comprobante (soporta 'A','B','C' y 'factura_a','factura_b','factura_c')
  // Si la factura es Nota de Crédito (es_nota_credito=true), mapear a 'nota_credito_x'
  const esNotaCredito = !!(factura as { es_nota_credito?: boolean } | undefined)?.es_nota_credito;
  const tipoBase = factura ? normalizarTipoComprobante(factura.tipo_comprobante) : '';
  const letraTipo = tipoBase.split('_').pop() || '';
  const tipoNormalizado = factura
    ? (esNotaCredito ? `nota_credito_${letraTipo}` : tipoBase)
    : '';
  const isFacturaA = tipoNormalizado.includes('_a');
  const isSandbox = resolvedEnvironment === 'sandbox';

  // URL QR AFIP conforme RG 4291/2018 (pasamos tipoNormalizado para que el código sea correcto en NC)
  const afipQRUrl = factura
    ? buildAfipQRUrl({ ...factura, tipo_comprobante: tipoNormalizado }, arcaConfig)
    : '';

  // Build conceptos
  const fleteEnDetalles = (detalles || []).find(d => d.nombre_concepto?.toLowerCase() === 'flete');
  const totalConceptos = (detalles || []).reduce((sum, d) => sum + (d.monto || 0), 0);
  const fleteCalculado = (envio?.precio_total || 0) - totalConceptos;

  // Liquidación: un renglón por envío con tracking, ciudad y fecha
  const conceptosLiquidacion = (liquidacionEnvios || []).map((e) => {
    const tracking = e.tracking_externo || e.tracking_number;
    const fecha = e.fecha_entrega ? format(new Date(e.fecha_entrega), 'dd/MM/yyyy') : '';
    const ciudad = e.ciudad_entrega || '';
    const desc = `${tracking}${ciudad ? ` - ${ciudad}` : ''}${fecha ? ` (${fecha})` : ''}`;
    return { nombre_concepto: desc, monto: e.precio_total || 0 };
  });

  const lineItemsFactura: LineItem[] = Array.isArray((factura as unknown as { line_items?: unknown } | undefined)?.line_items)
    ? ((factura as unknown as { line_items: LineItem[] }).line_items)
    : [];

  const hasDetailedLineItems = !isLiquidacionInvoice && lineItemsFactura.length > 0 && lineItemsFactura.some(it => Number(it.cantidad) > 0 || Number(it.precio_unitario) > 0);

  const conceptosAMostrar = isLiquidacionInvoice
    ? conceptosLiquidacion
    : lineItemsFactura.length > 0
      ? lineItemsFactura.map((it) => ({
          nombre_concepto: it.descripcion || 'Ítem',
          monto: calcLineSubtotal({
            codigo: it.codigo || '',
            descripcion: it.descripcion || '',
            cantidad: Number(it.cantidad) || 0,
            unidad_medida: it.unidad_medida || 'unidades',
            precio_unitario: Number(it.precio_unitario) || 0,
            bonificacion_pct: Number(it.bonificacion_pct) || 0,
            alicuota_iva: Number(it.alicuota_iva) || 0,
          }),
        }))
      : fleteEnDetalles
        ? (detalles || [])
        : [{ nombre_concepto: 'Flete', monto: fleteCalculado > 0 ? fleteCalculado : (envio?.precio_total || 0) }, ...(detalles || [])];

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!factura) return;
    const invoiceElement = document.getElementById('invoice-print-area');
    if (!invoiceElement) return;

    try {
      toast.info('Generando PDF...');
      // Hide non-print elements temporarily
      const badge = invoiceElement.querySelector('[data-print-hide]');
      if (badge) (badge as HTMLElement).style.display = 'none';

      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      const canvas = await html2canvas(invoiceElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      if (badge) (badge as HTMLElement).style.display = '';

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const imgRatio = canvas.width / canvas.height;
      const pdfWidth = pageWidth - 20;
      const pdfHeight = pdfWidth / imgRatio;

      doc.addImage(imgData, 'PNG', 10, 10, pdfWidth, Math.min(pdfHeight, pageHeight - 20));

      const prefix = esNotaCredito ? 'nota-credito' : 'factura';
      const fileName = `${prefix}-${formatNumeroComprobante(factura.punto_venta, factura.numero_comprobante)}${envio?.tracking_number ? `-${envio.tracking_number}` : ''}.pdf`;
      doc.save(fileName);
      toast.success(esNotaCredito ? 'Nota de Crédito descargada' : 'Factura descargada');
    } catch {
      toast.error('Error al generar PDF');
    }
  };

  const handleDownloadCompressedPDF = async () => {
    if (!factura) return;
    const invoiceElement = document.getElementById('invoice-print-area');
    if (!invoiceElement) return;

    try {
      toast.info('Generando PDF comprimido...');
      const badge = invoiceElement.querySelector('[data-print-hide]');
      if (badge) (badge as HTMLElement).style.display = 'none';

      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;

      const MAX_BYTES = 1024 * 1024; // 1 MB
      const scales = [2, 1.5, 1.2, 1, 0.85];
      const qualities = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25];

      let finalBlob: Blob | null = null;

      outer: for (const scale of scales) {
        const canvas = await html2canvas(invoiceElement, {
          scale,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });
        const imgRatio = canvas.width / canvas.height;
        for (const q of qualities) {
          const dataUrl = canvas.toDataURL('image/jpeg', q);
          const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          const pdfWidth = pageWidth - 20;
          const pdfHeight = pdfWidth / imgRatio;
          doc.addImage(dataUrl, 'JPEG', 10, 10, pdfWidth, Math.min(pdfHeight, pageHeight - 20));
          const blob = doc.output('blob');
          finalBlob = blob;
          if (blob.size <= MAX_BYTES) break outer;
        }
      }

      if (badge) (badge as HTMLElement).style.display = '';
      if (!finalBlob) throw new Error('no blob');

      const prefix = esNotaCredito ? 'nota-credito' : 'factura';
      const fileName = `${prefix}-${formatNumeroComprobante(factura.punto_venta, factura.numero_comprobante)}${envio?.tracking_number ? `-${envio.tracking_number}` : ''}.pdf`;

      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const kb = Math.round(finalBlob.size / 1024);
      if (finalBlob.size <= MAX_BYTES) {
        toast.success(`PDF descargado (${kb} KB)`);
      } else {
        toast.warning(`PDF descargado (${kb} KB) — supera 1 MB tras compresión máxima`);
      }
    } catch {
      toast.error('Error al generar PDF comprimido');
    }
  };

  // Auto-descarga cuando se abre con ?download=1
  const shouldAutoDownload = searchParams.get('download') === '1';
  const autoDownloadedRef = useRef(false);
  useEffect(() => {
    if (!shouldAutoDownload || autoDownloadedRef.current) return;
    if (!factura) return;
    // Esperar al próximo tick para asegurar render del DOM
    const t = setTimeout(() => {
      autoDownloadedRef.current = true;
      handleDownloadPDF();
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoDownload, factura?.id]);

  const backHref = resolvedEnvioId ? '/shipments' : '/facturacion';

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
          <Link to="/facturacion">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Facturación
          </Link>
        </Button>
      </div>
    );
  }

  const tipoLabel = TIPO_COMPROBANTE_LABELS[tipoNormalizado] || tipoNormalizado.toUpperCase();
  const letraComprobante = tipoNormalizado?.split('_').pop()?.toUpperCase() || '';

  // Código numérico para el PDF según tipo
  const tipoCodigo = tipoNormalizado === 'factura_a' ? '01'
    : tipoNormalizado === 'factura_b' ? '06'
    : tipoNormalizado === 'factura_c' ? '11'
    : tipoNormalizado === 'nota_credito_a' ? '03'
    : tipoNormalizado === 'nota_credito_b' ? '08'
    : tipoNormalizado === 'nota_credito_c' ? '13'
    : '06';

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0">

      <div className="max-w-3xl mx-auto">
        {/* Header - hidden on print */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link to={backHref}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={handleDownloadCompressedPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              Descargar PDF (≤1MB)
            </Button>
            <Button onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
          </div>
        </div>

        {/* Invoice Preview */}
        <Card id="invoice-print-area" className="shadow-lg print:shadow-none print:border-0 bg-white text-black [&_*]:text-black [&_.text-muted-foreground]:!text-gray-500">
          {/* Sandbox Banner */}
          {isSandbox && (
            <div className="bg-red-500/10 border-b border-red-500/20 text-center py-2 print:py-1">
              <p className="text-sm font-bold text-red-600">DOCUMENTO NO FISCAL - SANDBOX</p>
            </div>
          )}

          {/* Certificado de homologación en producción */}
          {!isSandbox && arcaConfig?.environment === 'production' && factura.estado === 'error' && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 print:hidden">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">Error de certificado AFIP</p>
                  <p className="mt-1">El certificado configurado en producción es de homologación (testing). Para emitir facturas reales debe:</p>
                  <ol className="list-decimal ml-4 mt-1 space-y-0.5">
                    <li>Generar un CSR ante AFIP con su CUIT de producción</li>
                    <li>Obtener el certificado firmado por AFIP producción</li>
                    <li>Cargarlo en Configuración → Integraciones → ARCA → Producción</li>
                  </ol>
                </div>
              </div>
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
                <p className="text-xs mt-1 text-muted-foreground">Cod. {tipoCodigo}</p>
              </div>

              {/* Right: Número + Fecha */}
              <div className="text-right flex-1">
                <p className="font-bold text-lg">{tipoLabel}</p>
                <p className="text-lg font-mono">
                  Nº {formatNumeroComprobante(factura.punto_venta, factura.numero_comprobante)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Fecha: {factura.fecha_emision ? formatFechaFiscalDisplay(getFechaFiscal(factura.fecha_emision)) : '-'}
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

            {/* Período del servicio y vencimiento de pago */}
            {(factura.fecha_servicio_desde || factura.fecha_servicio_hasta || factura.fecha_vto_pago) && (
              <div className="border rounded-lg p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">PERÍODO FACTURADO</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Desde: </span>
                    <span className="font-medium">
                      {factura.fecha_servicio_desde ? formatFechaFiscalDisplay(factura.fecha_servicio_desde.slice(0, 10)) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hasta: </span>
                    <span className="font-medium">
                      {factura.fecha_servicio_hasta ? formatFechaFiscalDisplay(factura.fecha_servicio_hasta.slice(0, 10)) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vto. Pago: </span>
                    <span className="font-medium">
                      {factura.fecha_vto_pago ? formatFechaFiscalDisplay(factura.fecha_vto_pago.slice(0, 10)) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Referencia: liquidación o envío único */}
            {isLiquidacionInvoice && liquidacionSeller ? (
              <div className="text-sm text-muted-foreground">
                Liquidación período:{' '}
                <span className="font-medium text-foreground">
                  {liquidacionSeller.periodo_inicio ? format(new Date(liquidacionSeller.periodo_inicio), 'dd/MM/yyyy') : '-'}
                  {' '}a{' '}
                  {liquidacionSeller.periodo_fin ? format(new Date(liquidacionSeller.periodo_fin), 'dd/MM/yyyy') : '-'}
                </span>
                {' '}· {(liquidacionEnvios || []).length} envío(s)
              </div>
            ) : envio && (
              <div className="text-sm text-muted-foreground">
                Envío asociado: <span className="font-mono font-medium text-foreground">{envio.tracking_number}</span>
              </div>
            )}

            {/* Conceptos */}
            {hasDetailedLineItems ? (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr className="text-muted-foreground">
                      <th className="px-2 py-2 text-left font-semibold">Código</th>
                      <th className="px-2 py-2 text-left font-semibold">Descripción</th>
                      <th className="px-2 py-2 text-right font-semibold">Cant.</th>
                      <th className="px-2 py-2 text-left font-semibold">U. Medida</th>
                      <th className="px-2 py-2 text-right font-semibold">P. Unit.</th>
                      <th className="px-2 py-2 text-right font-semibold">% Bonif.</th>
                      <th className="px-2 py-2 text-right font-semibold">IVA</th>
                      <th className="px-2 py-2 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lineItemsFactura.map((it, i) => {
                      const item: LineItem = {
                        codigo: it.codigo || '',
                        descripcion: it.descripcion || '',
                        cantidad: Number(it.cantidad) || 0,
                        unidad_medida: it.unidad_medida || 'unidades',
                        precio_unitario: Number(it.precio_unitario) || 0,
                        bonificacion_pct: Number(it.bonificacion_pct) || 0,
                        alicuota_iva: Number(it.alicuota_iva) || 0,
                      };
                      return (
                        <tr key={i}>
                          <td className="px-2 py-2">{item.codigo || '-'}</td>
                          <td className="px-2 py-2">{item.descripcion || '-'}</td>
                          <td className="px-2 py-2 text-right">{item.cantidad}</td>
                          <td className="px-2 py-2">{item.unidad_medida}</td>
                          <td className="px-2 py-2 text-right">{formatCurrency(item.precio_unitario)}</td>
                          <td className="px-2 py-2 text-right">{item.bonificacion_pct.toFixed(1)}%</td>
                          <td className="px-2 py-2 text-right">{item.alicuota_iva.toFixed(1)}%</td>
                          <td className="px-2 py-2 text-right font-medium">{formatCurrency(calcLineSubtotal(item))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
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
            )}

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

            {/* CAE + QR AFIP */}
            <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-lg border flex-shrink-0">
                  {/* QR con la URL AFIP correcta: https://www.afip.gob.ar/fe/qr/?p=BASE64 */}
                  <QRCodeSVG value={afipQRUrl || 'N/A'} size={90} />
                </div>
                <div className="text-sm">
                  <p className="font-semibold">CAE: {factura.cae || '-'}</p>
                  <p className="text-muted-foreground">
                    Vto. CAE: {factura.cae_vencimiento ? format(new Date(factura.cae_vencimiento), 'dd/MM/yyyy') : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Escanee para verificar en AFIP
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>
                {isSandbox ? 'DOCUMENTO NO FISCAL - Generado en entorno de pruebas' : 'Comprobante electrónico'}
              </span>
              <Badge variant="secondary" className="text-xs print:hidden" data-print-hide>
                VISTA PREVIA
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
