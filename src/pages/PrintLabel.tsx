import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  FileText, 
  Package,
  Loader2,
  Printer,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import geologistickLogo from '@/assets/geologistick-logo.png';
import { appendShipmentReceiptToDoc } from '@/lib/generateShipmentReceiptPDF';

async function appendReceiptIfPossible(doc: jsPDF, envio: any) {
  try {
    const [detallesRes, brandingRes] = await Promise.all([
      supabase.from('envio_detalles').select('nombre_concepto, monto').eq('envio_id', envio.id),
      envio.tenant_id
        ? supabase
            .from('tenant_branding')
            .select('logo_light, nombre_app, color_primario')
            .eq('tenant_id', envio.tenant_id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    const trackingUrl = `${window.location.origin}/tracking?code=${envio.tracking_number}`;
    await appendShipmentReceiptToDoc(
      doc,
      envio,
      detallesRes?.data || [],
      (brandingRes as any)?.data || null,
      trackingUrl,
      true,
    );
  } catch (e) {
    console.error('[PrintLabel] Error appending receipt:', e);
    toast.warning('No se pudo anexar el comprobante al PDF');
  }
}

const LABEL_SIZE = {
  widthMm: 100,
  heightMm: 150,
  orientation: 'portrait' as const,
  qrSize: 26,
};

const TIPO_SERVICIO_CONFIG = {
  sucursal_sucursal: { label: 'SUCURSAL A SUCURSAL' },
  sucursal_puerta: { label: 'ENTREGA A DOMICILIO' },
  puerta_sucursal: { label: 'RETIRO + SUCURSAL' },
  puerta_puerta: { label: 'PUERTA A PUERTA' },
};

const TIPO_PAGO_LABELS: Record<string, string> = {
  contado: 'CONTADO',
  destino: 'PAGO EN DESTINO',
  cuenta_corriente: 'CTA. CTE.',
};

interface Envio {
  id: string;
  tracking_number: string;
  cantidad_bultos: number;
  peso_kg: number | null;
  precio_total: number;
  tipo_pago: string | null;
  tipo_servicio_detalle: string | null;
  descripcion: string | null;
  notas: string | null;
  direccion_entrega: string | null;
  ciudad_entrega: string | null;
  cp_entrega: string | null;
  direccion_retiro: string | null;
  ciudad_retiro: string | null;
  cp_retiro: string | null;
  dni_remitente: string | null;
  dni_destinatario: string | null;
  whatsapp_destinatario: string | null;
  created_at: string;
  tenant_id: string | null;
  nombre_remitente: string | null;
  nombre_destinatario: string | null;
  es_terciarizado: boolean | null;
  empresa_terciarizada: string | null;
  tracking_externo: string | null;
  codigo_cliente_externo: string | null;
  codigo_orden_externo: string | null;
  provincia: string | null;
  remitente: {
    nombre: string;
    apellido: string | null;
    telefono: string;
    direccion: string;
  } | null;
  destinatario: {
    nombre: string;
    apellido: string | null;
    telefono: string;
    direccion: string;
  } | null;
  sucursal_origen: {
    codigo: string | null;
    nombre: string;
    telefono: string | null;
    direccion: string;
    ciudad: string | null;
  } | null;
  sucursal_destino: {
    codigo: string | null;
    nombre: string;
    telefono: string | null;
    direccion: string;
    ciudad: string | null;
  } | null;
  logoUrl?: string | null;
}

// Helper to get QR code URL
const getQRCodeUrl = (data: string, size: number) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&format=png&margin=2&ecc=M`;
};

// Load an image URL as base64 for PDF embedding (fetch-based, for raster images like QR)
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Load any image (including SVG) as PNG base64 via canvas - required for jsPDF compatibility
async function loadImageAsPngBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 150;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Draw a single label on the PDF at a given offset
function drawLabel(
  doc: jsPDF,
  envio: Envio,
  bultoNum: number,
  totalBultos: number,
  tipoConfig: { label: string },
  deliveryInfo: { type: string; direccion?: string; ciudad?: string | null; cp?: string | null; nombre?: string } | null,
  logoBase64: string | null,
  qrBase64: string | null,
  widthMm: number,
  heightMm: number,
  qrSizeMm: number,
  offsetX: number = 0,
  offsetY: number = 0,
) {
  const W = widthMm;
  const H = heightMm;
  const m = 2; // margin mm
  const cw = W - m * 2; // content width
  let y = m + offsetY;
  const lx = m + offsetX; // left x

  const isCompact = heightMm > widthMm; // portrait = compact
  const fontBase = isCompact ? 7 : 8;

  // Border around entire label
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(lx, y - offsetY + m + offsetY, cw, H - m * 2);

  // Reset y to proper start
  y = m + offsetY;

  // ── Row 1: Logo + Tracking ──
  const row1H = isCompact ? 18 : 14;
  const logoW = cw * 0.3;
  
  // Logo area
  doc.setLineWidth(0.3);
  doc.rect(lx, y, logoW, row1H);
  if (logoBase64) {
    try {
      const logoMaxW = logoW - 2;
      const logoMaxH = row1H - 2;
      doc.addImage(logoBase64, 'PNG', lx + 1, y + 1, logoMaxW, logoMaxH);
    } catch {}
  }

  // Tracking area
  doc.rect(lx + logoW, y, cw - logoW, row1H);
  const trackingCode = `${envio.tracking_number}-${String(bultoNum).padStart(2, '0')}`;
  doc.setFontSize(isCompact ? 12 : 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(envio.tracking_number, lx + cw - 2, y + (isCompact ? 7 : 6), { align: 'right' });
  doc.setFontSize(fontBase - 1);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(trackingCode, lx + cw - 2, y + (isCompact ? 12 : 10), { align: 'right' });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(fontBase - 1);
  const dateStr = format(new Date(envio.created_at), 'dd/MM/yyyy', { locale: es });
  doc.text(dateStr, lx + cw - 2, y + (isCompact ? 16 : 13), { align: 'right' });
  y += row1H;

  // ── Row 2: 4-column header ──
  const row2H = isCompact ? 8 : 6;
  const col4W = cw / 4;
  const headers = ['DOC. CLIENTE', 'BULTO', 'OPERATIVA', 'PESO'];
  
  // Header row (black bg)
  doc.setFillColor(0, 0, 0);
  doc.rect(lx, y, cw, row2H / 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(fontBase - 2);
  doc.setFont('helvetica', 'bold');
  headers.forEach((h, i) => {
    doc.text(h, lx + i * col4W + 1.5, y + row2H / 2 - 0.8);
  });

  // Data row
  y += row2H / 2;
  const docCliente = envio.codigo_cliente_externo || envio.dni_remitente || '-';
  const operativa = envio.sucursal_destino?.codigo || '-';
  const pesoStr = envio.peso_kg ? envio.peso_kg.toFixed(2).replace('.', ',') + ' kg' : '0,00 kg';
  const dataVals = [docCliente, `${bultoNum} / ${totalBultos}`, operativa, pesoStr];
  
  doc.setFillColor(255, 255, 255);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(fontBase);
  doc.setFont('helvetica', 'bold');
  dataVals.forEach((v, i) => {
    doc.rect(lx + i * col4W, y, col4W, row2H / 2);
    doc.text(v, lx + i * col4W + 1.5, y + row2H / 2 - 1);
  });
  y += row2H / 2;

  // ── Row 3: Sucursal destino / Localidad GRANDE ──
  const row3H = isCompact ? 16 : 14;
  const destCiudad = envio.ciudad_entrega || envio.sucursal_destino?.ciudad || '';
  const letraZona = destCiudad ? destCiudad.charAt(0).toUpperCase() : '';
  
  // Header part
  const sucDestHdrW = cw * 0.3;
  doc.setFillColor(0, 0, 0);
  doc.rect(lx, y, sucDestHdrW, row3H, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(fontBase - 2);
  doc.setFont('helvetica', 'bold');
  doc.text('SUCURSAL', lx + 1.5, y + row3H / 2 - 1);
  doc.text('DESTINO', lx + 1.5, y + row3H / 2 + 2);
  
  // Localidad GRANDE
  const cityBoxX = lx + sucDestHdrW;
  const cityBoxW = cw - sucDestHdrW - 12;
  doc.rect(cityBoxX, y, cityBoxW, row3H);
  doc.setTextColor(0, 0, 0);
  const sucDestNombre = envio.sucursal_destino?.nombre || envio.sucursal_destino?.codigo || '';
  const cityText = (destCiudad || sucDestNombre || '-').toUpperCase();
  // Auto-shrink city font to fit width
  let cityFontSize = isCompact ? 22 : 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(cityFontSize);
  while (doc.getTextWidth(cityText) > cityBoxW - 4 && cityFontSize > 10) {
    cityFontSize -= 1;
    doc.setFontSize(cityFontSize);
  }
  const hasSubLine = !!sucDestNombre && destCiudad && sucDestNombre.toUpperCase() !== destCiudad.toUpperCase();
  doc.text(cityText, cityBoxX + cityBoxW / 2, y + (hasSubLine ? row3H / 2 + 1 : row3H / 2 + cityFontSize / 8), { align: 'center' });
  if (hasSubLine) {
    doc.setFontSize(fontBase - 1);
    doc.setFont('helvetica', 'normal');
    doc.text(sucDestNombre, cityBoxX + cityBoxW / 2, y + row3H - 2, { align: 'center', maxWidth: cityBoxW - 4 });
  }
  
  // Zona letter
  const zonaX = lx + cw - 12;
  doc.rect(zonaX, y, 12, row3H);
  if (letraZona) {
    doc.setFillColor(0, 0, 0);
    doc.rect(zonaX + 1, y + 1, 10, row3H - 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(isCompact ? 14 : 16);
    doc.setFont('helvetica', 'bold');
    doc.text(letraZona, zonaX + 6, y + row3H / 2 + 2, { align: 'center' });
  }
  y += row3H;

  // ── Row 4: Tipo de servicio ──
  const row4H = isCompact ? 7 : 6;
  doc.rect(lx, y, cw, row4H);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(fontBase);
  doc.setFont('helvetica', 'bold');
  doc.text(`★ ${tipoConfig.label} ★`, lx + cw / 2, y + row4H / 2 + 1, { align: 'center' });
  y += row4H;

  // ── Row 5: Destinatario ──
  const destHdrH = isCompact ? 5 : 4;
  doc.setFillColor(0, 0, 0);
  doc.rect(lx, y, cw, destHdrH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(fontBase - 1);
  doc.setFont('helvetica', 'bold');
  doc.text('DESTINATARIO', lx + cw / 2, y + destHdrH / 2 + 1, { align: 'center' });
  y += destHdrH;

  const destDataH = isCompact ? 22 : 18;
  doc.rect(lx, y, cw, destDataH);
  const destinatarioNombre = envio.destinatario 
    ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`.trim()
    : (envio.nombre_destinatario || 'Sin destinatario');
  const destinatarioTel = envio.destinatario?.telefono || envio.whatsapp_destinatario || '';
  const direccionEntrega = deliveryInfo?.direccion || 'Sin dirección';
  const cpEntrega = deliveryInfo?.cp || envio.cp_entrega || '';
  const ciudadEntrega = deliveryInfo?.ciudad || envio.ciudad_entrega || '';
  const provinciaEntrega = envio.provincia || '';

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(isCompact ? 12 : 13);
  doc.setFont('helvetica', 'bold');
  let nameStr = destinatarioNombre;
  if (envio.dni_destinatario) nameStr += ` - DNI: ${envio.dni_destinatario}`;
  doc.text(nameStr, lx + 2, y + 6, { maxWidth: cw - 4 });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const addr2 = `${direccionEntrega}${cpEntrega ? ` (${cpEntrega})` : ''}`;
  doc.text(addr2, lx + 2, y + (isCompact ? 13 : 12), { maxWidth: cw - 4 });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const addr3 = `${ciudadEntrega}${provinciaEntrega ? ` - ${provinciaEntrega}` : ''}${destinatarioTel ? ` - Tel: ${destinatarioTel}` : ''}`;
  doc.text(addr3, lx + 2, y + (isCompact ? 19 : 17), { maxWidth: cw - 4 });
  y += destDataH;

  // ── Row 6: Observaciones + QR ──
  const obsHdrH = isCompact ? 5 : 4;
  doc.setFillColor(0, 0, 0);
  doc.rect(lx, y, cw, obsHdrH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(fontBase - 2);
  doc.setFont('helvetica', 'bold');
  doc.text('OBSERVACIONES', lx + 1.5, y + obsHdrH / 2 + 1);
  y += obsHdrH;

  const obsDataH = qrSizeMm + 4;
  doc.rect(lx, y, cw, obsDataH);
  
  // QR on the right
  const qrAreaW = qrSizeMm + 4;
  doc.setLineWidth(0.3);
  doc.line(lx + cw - qrAreaW, y, lx + cw - qrAreaW, y + obsDataH);
  if (qrBase64) {
    try {
      doc.addImage(qrBase64, 'PNG', lx + cw - qrAreaW + 2, y + 2, qrSizeMm, qrSizeMm);
    } catch {}
  }

  // Obs text on the left
  const observaciones = envio.descripcion || envio.notas || '-';
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(fontBase - 1);
  doc.setFont('helvetica', 'normal');
  doc.text(observaciones, lx + 2, y + 4, { maxWidth: cw - qrAreaW - 4 });

  // Payment info
  const tipoPagoLabel = TIPO_PAGO_LABELS[envio.tipo_pago || 'contado'];
  const precioStr = `$${envio.precio_total.toLocaleString('es-AR')}`;
  doc.setFontSize(fontBase - 2);
  doc.setFont('helvetica', 'bold');
  doc.rect(lx + 2, y + obsDataH - 7, 18, 4);
  doc.text(tipoPagoLabel, lx + 3, y + obsDataH - 4);
  doc.setFontSize(isCompact ? 12 : 13);
  doc.text(precioStr, lx + 22, y + obsDataH - 3.5);
  y += obsDataH;

  // ── Row 7: Sucursal origen ──
  const row7H = isCompact ? 7 : 6;
  const sucOrigHdrW = cw * 0.3;
  doc.setFillColor(0, 0, 0);
  doc.rect(lx, y, sucOrigHdrW, row7H, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(fontBase - 2);
  doc.setFont('helvetica', 'bold');
  doc.text('SUCURSAL ORIGEN', lx + 1.5, y + row7H / 2 + 1);
  
  doc.rect(lx + sucOrigHdrW, y, cw - sucOrigHdrW, row7H);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(fontBase);
  doc.setFont('helvetica', 'bold');
  const origenStr = `${envio.sucursal_origen?.codigo || '-'} - ${envio.sucursal_origen?.nombre || 'Sin sucursal'}`;
  doc.text(origenStr, lx + sucOrigHdrW + 2, y + row7H / 2 + 1, { maxWidth: cw - sucOrigHdrW - 4 });
  y += row7H;

  // ── Row 8: Remitente ──
  const row8HdrH = isCompact ? 5 : 4;
  doc.setFillColor(0, 0, 0);
  doc.rect(lx, y, cw, row8HdrH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(fontBase - 1);
  doc.setFont('helvetica', 'bold');
  doc.text('REMITENTE', lx + cw / 2, y + row8HdrH / 2 + 1, { align: 'center' });
  y += row8HdrH;

  const row8DataH = isCompact ? 7 : 6;
  doc.rect(lx, y, cw, row8DataH);
  const remitenteNombre = envio.remitente 
    ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim()
    : (envio.nombre_remitente || 'Sin remitente');
  const remitenteTel = envio.remitente?.telefono || '';
  const remStr = `${remitenteNombre}${remitenteTel ? ` - Tel: ${remitenteTel}` : ''}`;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(fontBase - 1);
  doc.setFont('helvetica', 'normal');
  doc.text(remStr, lx + cw / 2, y + row8DataH / 2 + 1, { align: 'center', maxWidth: cw - 4 });
  y += row8DataH;

  // ── Row 9: BULTOS GIGANTES (ocupa el espacio restante) ──
  const bottomY = m + offsetY + (H - m * 2);
  const bultosBoxH = bottomY - y;
  if (bultosBoxH > 6) {
    doc.rect(lx, y, cw, bultosBoxH);
    const labelH = 5;
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(fontBase - 1);
    doc.setFont('helvetica', 'bold');
    doc.text('BULTOS', lx + 3, y + 4);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    const bultosText = `${bultoNum} / ${totalBultos}`;
    // cap-height ≈ fontSize(pt) * 0.247 mm. Fit within available height.
    const availH = bultosBoxH - labelH - 2;
    let bSize = Math.min(80, Math.floor(availH / 0.247));
    doc.setFontSize(bSize);
    while (doc.getTextWidth(bultosText) > cw - 8 && bSize > 12) {
      bSize -= 2;
      doc.setFontSize(bSize);
    }
    const capMm = bSize * 0.247;
    const numCenterY = y + labelH + (bultosBoxH - labelH) / 2;
    doc.text(bultosText, lx + cw / 2, numCenterY + capMm / 2, { align: 'center', baseline: 'alphabetic' });
  }
}

// Shared logic to prepare PDF data
async function preparePdfData(envio: Envio) {
  const tipoServicio = envio.tipo_servicio_detalle || 'sucursal_sucursal';
  const tipoConfig = TIPO_SERVICIO_CONFIG[tipoServicio as keyof typeof TIPO_SERVICIO_CONFIG] 
    || TIPO_SERVICIO_CONFIG.sucursal_sucursal;

  const getDeliveryAddress = () => {
    if (['sucursal_puerta', 'puerta_puerta', 'domicilio_domicilio'].includes(tipoServicio)) {
      if (envio.direccion_entrega) {
        return { type: 'domicilio', direccion: envio.direccion_entrega, ciudad: envio.ciudad_entrega, cp: envio.cp_entrega };
      }
      if (envio.destinatario) {
        return { type: 'domicilio', direccion: envio.destinatario.direccion, ciudad: null, cp: null };
      }
    }
    if (envio.sucursal_destino) {
      return { type: 'sucursal', nombre: envio.sucursal_destino.nombre, direccion: envio.sucursal_destino.direccion, ciudad: envio.sucursal_destino.ciudad };
    }
    return null;
  };

  const deliveryInfo = getDeliveryAddress();
  const bultos = envio.cantidad_bultos || 1;

  let logoBase64 = envio.logoUrl ? await loadImageAsPngBase64(envio.logoUrl) : null;
  if (!logoBase64) {
    logoBase64 = await loadImageAsPngBase64(geologistickLogo);
  }

  const baseUrl = window.location.origin;
  const qrImages: (string | null)[] = [];
  for (let i = 0; i < bultos; i++) {
    const trackingCode = `${envio.tracking_number}-${String(i + 1).padStart(2, '0')}`;
    const qrUrl = getQRCodeUrl(`${baseUrl}/tracking?q=${trackingCode}`, 200);
    const qrB64 = await loadImageAsBase64(qrUrl);
    qrImages.push(qrB64);
  }

  return { tipoConfig, deliveryInfo, bultos, logoBase64, qrImages };
}

// Generate PDF document with all labels
function generateLabelPdf(
  envio: Envio,
  tipoConfig: { label: string },
  deliveryInfo: ReturnType<typeof Object>,
  bultos: number,
  logoBase64: string | null,
  qrImages: (string | null)[],
) {
  const size = LABEL_SIZE;

  if (bultos <= 1) {
    // Single label: 100x150mm page
    const doc = new jsPDF({
      orientation: size.orientation,
      unit: 'mm',
      format: [size.widthMm, size.heightMm],
    });
    drawLabel(doc, envio, 1, bultos, tipoConfig, deliveryInfo as any, logoBase64, qrImages[0], size.widthMm, size.heightMm, size.qrSize);
    return doc;
  }

  // Multiple labels: A4 with 4 labels per page (2x2 grid)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const positions = [
    { x: 5, y: 0.5 },
    { x: 107.5, y: 0.5 },
    { x: 5, y: 148.5 },
    { x: 107.5, y: 148.5 },
  ];

  for (let i = 0; i < bultos; i++) {
    if (i > 0 && i % 4 === 0) doc.addPage();
    const pos = positions[i % 4];
    drawLabel(
      doc, envio, i + 1, bultos, tipoConfig, deliveryInfo as any,
      logoBase64, qrImages[i],
      size.widthMm, size.heightMm, size.qrSize,
      pos.x, pos.y,
    );
  }

  return doc;
}

export default function PrintLabel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isPrinting, setIsPrinting] = useState(false);
  const envioId = searchParams.get('id');

  const { data: envio, isLoading, error } = useQuery({
    queryKey: ['envio-print', envioId],
    queryFn: async () => {
      if (!envioId) throw new Error('ID de envío requerido');
      
      const { data, error } = await supabase
        .from('envios')
        .select(`
          *,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono, direccion),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono, direccion),
          sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(codigo, nombre, telefono, direccion, ciudad),
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(codigo, nombre, telefono, direccion, ciudad)
        `)
        .eq('id', envioId)
        .single();
      
      if (error) throw error;
      
      let logoUrl: string | null = null;
      if (data.tenant_id) {
        const { data: branding } = await supabase
          .from('tenant_branding')
          .select('logo_light')
          .eq('tenant_id', data.tenant_id)
          .single();
        logoUrl = branding?.logo_light || null;
      }
      
      return { ...data, logoUrl } as Envio;
    },
    enabled: !!envioId,
  });

  const handlePrint = async () => {
    if (!envio) return;
    setIsPrinting(true);
    try {
      const { tipoConfig, deliveryInfo, bultos, logoBase64, qrImages } = await preparePdfData(envio);
      const doc = generateLabelPdf(envio, tipoConfig, deliveryInfo, bultos, logoBase64, qrImages);
      await appendReceiptIfPossible(doc, envio);
      doc.save(`etiqueta-comprobante-${envio.tracking_number}.pdf`);
      toast.success('PDF descargado (etiqueta + comprobante).');
    } catch (e) {
      console.error('Error generating PDF:', e);
      toast.error('Error al generar el PDF');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDirectPrint = async () => {
    if (!envio) return;
    setIsPrinting(true);
    try {
      const { tipoConfig, deliveryInfo, bultos, logoBase64, qrImages } = await preparePdfData(envio);
      const doc = generateLabelPdf(envio, tipoConfig, deliveryInfo, bultos, logoBase64, qrImages);
      await appendReceiptIfPossible(doc, envio);
      doc.autoPrint();
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
      toast.success('Abriendo diálogo de impresión...');
    } catch (e) {
      console.error('Error printing:', e);
      toast.error('Error al imprimir');
    } finally {
      setIsPrinting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <Package className="h-12 w-12 animate-pulse text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando etiqueta...</p>
        </div>
      </div>
    );
  }

  if (error || !envio) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <p className="text-destructive">Error: {error?.message || 'Envío no encontrado'}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  const tipoServicio = envio.tipo_servicio_detalle || 'sucursal_sucursal';
  const tipoConfig = TIPO_SERVICIO_CONFIG[tipoServicio as keyof typeof TIPO_SERVICIO_CONFIG] 
    || TIPO_SERVICIO_CONFIG.sucursal_sucursal;
  
  const bultos = envio.cantidad_bultos || 1;
  const labels = Array.from({ length: bultos }, (_, i) => i + 1);

  const getDeliveryAddress = () => {
    if (['sucursal_puerta', 'puerta_puerta', 'domicilio_domicilio'].includes(tipoServicio)) {
      if (envio.direccion_entrega) {
        return { type: 'domicilio', direccion: envio.direccion_entrega, ciudad: envio.ciudad_entrega, cp: envio.cp_entrega };
      }
      if (envio.destinatario) {
        return { type: 'domicilio', direccion: envio.destinatario.direccion, ciudad: null, cp: null };
      }
    }
    if (envio.sucursal_destino) {
      return { type: 'sucursal', nombre: envio.sucursal_destino.nombre, direccion: envio.sucursal_destino.direccion, ciudad: envio.sucursal_destino.ciudad };
    }
    return null;
  };

  const deliveryInfo = getDeliveryAddress();
  const destCiudad = envio.ciudad_entrega || envio.sucursal_destino?.ciudad || '';
  const letraZona = destCiudad ? destCiudad.charAt(0).toUpperCase() : '';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 flex-wrap gap-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Imprimir Etiquetas + Comprobante</h1>
            <p className="text-muted-foreground">
              {envio.tracking_number} • {bultos} {bultos === 1 ? 'bulto' : 'bultos'}
              {bultos > 1 && ' • 4 por hoja A4'} • Incluye comprobante de envío
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleDirectPrint} variant="outline" disabled={isPrinting}>
            {isPrinting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            Imprimir
          </Button>
          <Button onClick={handlePrint} className="gradient-primary" disabled={isPrinting}>
            {isPrinting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Generar PDF
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Vista previa de las etiquetas. {bultos > 1 ? 'Se imprimirán 4 etiquetas por hoja A4.' : 'Al generar el PDF se descargará el archivo.'}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {labels.map((bultoNum) => {
            const trackingCode = `${envio.tracking_number}-${String(bultoNum).padStart(2, '0')}`;
            const docCliente = envio.codigo_cliente_externo || envio.dni_remitente || '-';
            const operativa = envio.sucursal_destino?.codigo || '-';
            const pesoStr = envio.peso_kg ? envio.peso_kg.toFixed(2).replace('.', ',') : '0,00';
            const destinatarioNombre = envio.destinatario 
              ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`.trim()
              : (envio.nombre_destinatario || 'Sin destinatario');
            const destinatarioTel = envio.destinatario?.telefono || envio.whatsapp_destinatario || '';
            const remitenteNombre = envio.remitente 
              ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim()
              : (envio.nombre_remitente || 'Sin remitente');
            const remitenteTel = envio.remitente?.telefono || '';
            const direccionEntrega = deliveryInfo?.direccion || 'Sin dirección';
            const cpEntrega = deliveryInfo?.cp || envio.cp_entrega || '';
            const ciudadEntrega = deliveryInfo?.ciudad || envio.ciudad_entrega || '';
            const provinciaEntrega = envio.provincia || '';
            const observaciones = envio.descripcion || envio.notas || '';
            const tipoPagoLabel = TIPO_PAGO_LABELS[envio.tipo_pago || 'contado'];

            return (
              <div key={bultoNum} className="bg-white border-2 border-black overflow-hidden">
                {/* Fila 1: Header - Logo + Tracking */}
                <div className="grid grid-cols-[30%_1fr] border-b border-black">
                  <div className="border-r border-black p-1 flex items-center justify-center aspect-[2/1]">
                    <img 
                      src={envio.logoUrl || geologistickLogo} 
                      alt="" 
                      className="w-full h-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = geologistickLogo; }}
                    />
                  </div>
                  <div className="p-2 text-right">
                    <p className="font-mono font-bold text-lg tracking-wider">{envio.tracking_number}</p>
                    <p className="font-mono text-[10px] text-gray-500">{trackingCode}</p>
                    <p className="text-[10px] font-semibold mt-0.5">
                      {format(new Date(envio.created_at), 'dd/MM/yyyy', { locale: es })}
                    </p>
                  </div>
                </div>

                {/* Fila 2: Grilla 4 columnas */}
                <div className="grid grid-cols-4">
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-0.5 border-r border-black">DOC. CLIENTE</div>
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-0.5 border-r border-black">BULTO</div>
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-0.5 border-r border-black">OPERATIVA</div>
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-0.5">PESO</div>
                </div>
                <div className="grid grid-cols-4 border-b border-black">
                  <div className="text-xs font-bold px-2 py-1 border-r border-black">{docCliente}</div>
                  <div className="text-xs font-bold px-2 py-1 border-r border-black">{bultoNum} / {bultos}</div>
                  <div className="text-xs font-bold px-2 py-1 border-r border-black">{operativa}</div>
                  <div className="text-xs font-bold px-2 py-1">{pesoStr} kg</div>
                </div>

                {/* Fila 3: Sucursal destino */}
                <div className="grid grid-cols-[auto_1fr_auto] border-b border-black">
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-1 border-r border-black flex items-center">
                    SUCURSAL<br/>DESTINO
                  </div>
                  <div className="px-2 py-1 flex items-center">
                    <span className="font-black text-xl">{envio.sucursal_destino?.codigo || '-'}</span>
                    <span className="text-[9px] font-semibold ml-2">{envio.sucursal_destino?.nombre || ''}</span>
                  </div>
                  <div className="flex items-center justify-center px-2">
                    {letraZona && (
                      <span className="bg-black text-white font-black text-xl px-2 py-0.5 min-w-[28px] text-center">
                        {letraZona}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fila 4: Tipo servicio */}
                <div className="text-center font-bold text-xs tracking-wide py-1.5 border-b border-black">
                  ★ {tipoConfig.label} ★
                </div>

                {/* Fila 5: Destinatario */}
                <div className="bg-black text-white text-[8px] font-bold uppercase text-center py-0.5">DESTINATARIO</div>
                <div className="px-2 py-1.5 border-b border-black">
                  <p className="text-sm font-bold">{destinatarioNombre}{envio.dni_destinatario ? ` - DNI: ${envio.dni_destinatario}` : ''}</p>
                  <p className="text-[10px]">{direccionEntrega}{cpEntrega ? ` (${cpEntrega})` : ''}</p>
                  <p className="text-[10px]">{ciudadEntrega}{provinciaEntrega ? ` - ${provinciaEntrega}` : ''}{destinatarioTel ? ` - Tel: ${destinatarioTel}` : ''}</p>
                </div>

                {/* Fila 6: Observaciones + QR */}
                <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-0.5">OBSERVACIONES</div>
                <div className="flex border-b border-black">
                  <div className="flex-1 px-2 py-1.5 flex flex-col justify-between">
                    <p className="text-[9px] leading-tight">{observaciones || '-'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] font-bold px-1 py-0.5 border border-black">{tipoPagoLabel}</span>
                      <span className="font-black text-base">${envio.precio_total.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                  <div className="border-l border-black p-1.5 flex items-center justify-center">
                    <img 
                      src={getQRCodeUrl(`${window.location.origin}/tracking?q=${trackingCode}`, 80)}
                      alt="QR Code"
                      className="w-20 h-20"
                    />
                  </div>
                </div>

                {/* Fila 7: Sucursal origen */}
                <div className="grid grid-cols-[auto_1fr] border-b border-black">
                  <div className="bg-black text-white text-[7px] font-bold uppercase px-2 py-1 border-r border-black">SUCURSAL ORIGEN</div>
                  <div className="px-2 py-1 text-xs font-bold">
                    <strong>{envio.sucursal_origen?.codigo || '-'}</strong> - {envio.sucursal_origen?.nombre || 'Sin sucursal'}
                  </div>
                </div>

                {/* Fila 8: Remitente */}
                <div className="bg-black text-white text-[8px] font-bold uppercase text-center py-0.5">REMITENTE</div>
                <div className="text-center text-[10px] font-semibold px-2 py-1">
                  {remitenteNombre}{remitenteTel ? ` - Tel: ${remitenteTel}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
