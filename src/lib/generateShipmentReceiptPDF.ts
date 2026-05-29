import { jsPDF } from 'jspdf';
import { loadLogoAsBase64 } from './pdfHelpers';

interface ShipmentData {
  id: string;
  tracking_number: string;
  created_at: string;
  nombre_remitente?: string;
  dni_remitente?: string;
  direccion_retiro?: string;
  ciudad_retiro?: string;
  nombre_destinatario?: string;
  dni_destinatario?: string;
  direccion_entrega?: string;
  ciudad_entrega?: string;
  whatsapp_destinatario?: string;
  cantidad_bultos?: number;
  peso_kg?: number;
  descripcion?: string;
  valor_declarado?: number;
  precio_total: number;
  tipo_pago?: string;
  notas?: string;
  remitente?: {
    nombre: string;
    apellido?: string;
    telefono?: string;
    direccion?: string;
    ciudad?: string;
  };
  destinatario?: {
    nombre: string;
    apellido?: string;
    telefono?: string;
    direccion?: string;
    ciudad?: string;
  };
  sucursal_origen?: {
    nombre: string;
    codigo?: string;
    direccion?: string;
    ciudad?: string;
    telefono?: string;
  };
  sucursal_destino?: {
    nombre: string;
    codigo?: string;
    direccion?: string;
    ciudad?: string;
    telefono?: string;
  };
}

interface DetalleConcepto {
  nombre_concepto: string;
  monto: number;
}

interface BrandingData {
  logo_light?: string;
  nombre_app?: string;
  color_primario?: string;
}

interface LoadedAssets {
  tenantLogo: string | null;
  qrCodeBase64: string | null;
  defaultLogo: string | null;
}

const TIPO_PAGO_LABELS: Record<string, string> = {
  contado: 'Contado',
  destino: 'Pago en Destino',
  cuenta_corriente: 'Cuenta Corriente',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

function generateQRCodeDataUrl(text: string, size: number = 100): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=png`;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    // Use Image element with crossOrigin to handle CORS properly
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      // Timeout after 5 seconds
      const timeout = setTimeout(() => {
        resolve(null);
      }, 5000);
      
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };
      
      img.src = url;
    });
  } catch {
    return null;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [59, 130, 246];
}

// Draw cut line between the two receipts
function drawCutLine(doc: jsPDF, yPosition: number, pageWidth: number) {
  const margin = 8;
  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2.5, 2], 0);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  doc.setLineDashPattern([], 0);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(120, 120, 120);
  doc.text('✂  CORTAR POR AQUÍ  ✂', pageWidth / 2, yPosition - 1.2, { align: 'center' });
}

// Draw a single receipt that fills half of A4 (~148.5mm) — Industrial grid layout v4
function drawReceipt(
  doc: jsPDF,
  shipment: ShipmentData,
  detalles: DetalleConcepto[],
  branding: BrandingData | null,
  assets: LoadedAssets,
  yOffset: number,
  copyType: 'agencia' | 'cliente'
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;

  const logoToUse = assets.tenantLogo || assets.defaultLogo;
  const companyName = branding?.nombre_app || 'Geologistick';
  const primaryColor = branding?.color_primario || '#3B82F6';
  const primaryRgb = hexToRgb(primaryColor);

  let y = yOffset + 5;

  // ========== TOP ACCENT BAR ==========
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(margin, y, contentWidth, 1.2, 'F');
  y += 4;

  // ========== HEADER ==========
  const headerStart = y;
  const logoSize = 14;

  if (logoToUse) {
    try {
      doc.addImage(logoToUse, 'PNG', margin, y, logoSize, logoSize);
    } catch (e) {}
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(companyName, margin + logoSize + 4, y + 5.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  const branchInfo = shipment.sucursal_origen;
  if (branchInfo) {
    const branchLine = `${branchInfo.direccion || ''} ${branchInfo.ciudad || ''}${branchInfo.telefono ? ' • Tel: ' + branchInfo.telefono : ''}`;
    doc.text(branchLine.substring(0, 65), margin + logoSize + 4, y + 10.5);
  }

  const rightX = pageWidth - margin;

  const copyLabel = copyType === 'agencia' ? 'COPIA AGENCIA' : 'COPIA CLIENTE';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const labelWidth = doc.getTextWidth(copyLabel) + 5;
  const badgeY = y;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.setFillColor(0, 0, 0);
  doc.rect(rightX - labelWidth, badgeY, labelWidth, 5, 'FD');
  doc.setTextColor(255, 255, 255);
  doc.text(copyLabel, rightX - labelWidth / 2, badgeY + 3.5, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(`Guía: ${shipment.tracking_number}`, rightX, badgeY + 10, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  const fecha = new Date(shipment.created_at).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  doc.text(`Fecha: ${fecha}`, rightX, badgeY + 14.5, { align: 'right' });

  y = headerStart + logoSize + 2;

  // Separator
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // ========== ORIGEN / DESTINO bars ==========
  const halfWidth = contentWidth / 2 - 2;
  const odBarH = 8;

  doc.setFillColor(0, 0, 0);
  doc.rect(margin, y, halfWidth, odBarH, 'F');
  doc.setFillColor(102, 102, 102);
  doc.rect(margin + halfWidth + 4, y, halfWidth, odBarH, 'F');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin + halfWidth + 4, y, halfWidth, odBarH);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ORIGEN', margin + 3, y + 5.5);
  doc.text('DESTINO', margin + halfWidth + 7, y + 5.5);

  const ciudadOrigen = shipment.sucursal_origen?.ciudad || shipment.ciudad_retiro || '-';
  const ciudadDestino = shipment.sucursal_destino?.ciudad || shipment.ciudad_entrega || '-';
  doc.text(ciudadOrigen.substring(0, 22), margin + halfWidth - 3, y + 5.5, { align: 'right' });
  doc.text(ciudadDestino.substring(0, 22), pageWidth - margin - 3, y + 5.5, { align: 'right' });

  y += odBarH + 2;

  // ========== REMITENTE / DESTINATARIO boxes ==========
  const boxHeight = 26;
  const boxHeaderH = 5;

  const drawPersonBox = (
    title: string,
    name: string,
    address: string,
    phone: string,
    dni: string,
    x: number,
    boxWidth: number
  ) => {
    const boxY = y;
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.4);
    doc.rect(x, boxY, boxWidth, boxHeight);
    doc.setFillColor(0, 0, 0);
    doc.rect(x, boxY, boxWidth, boxHeaderH, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, x + 2, boxY + 3.6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(10);
    doc.text((name || '-').substring(0, 32), x + 2, boxY + boxHeaderH + 4.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const addrFull = (address || '-').substring(0, 90);
    const addrLines = doc.splitTextToSize(`Dir: ${addrFull}`, boxWidth - 4);
    doc.text(addrLines.slice(0, 2), x + 2, boxY + boxHeaderH + 9);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`Tel: ${phone || '-'}`, x + 2, boxY + boxHeight - 2.5);
    doc.text(`DNI: ${dni || '-'}`, x + boxWidth / 2, boxY + boxHeight - 2.5);
  };

  const remitenteNombre = shipment.nombre_remitente ||
    (shipment.remitente ? `${shipment.remitente.nombre} ${shipment.remitente.apellido || ''}` : '-');
  const remitenteDir = shipment.direccion_retiro || shipment.remitente?.direccion || '-';
  const remitenteTel = shipment.remitente?.telefono || '-';
  const remitenteDni = shipment.dni_remitente || '-';

  const destNombre = shipment.nombre_destinatario ||
    (shipment.destinatario ? `${shipment.destinatario.nombre} ${shipment.destinatario.apellido || ''}` : '-');
  const destDir = shipment.direccion_entrega || shipment.destinatario?.direccion || '-';
  const destTel = shipment.whatsapp_destinatario || shipment.destinatario?.telefono || '-';
  const destDni = shipment.dni_destinatario || '-';

  drawPersonBox('REMITENTE', remitenteNombre, remitenteDir, remitenteTel, remitenteDni, margin, halfWidth);
  drawPersonBox('DESTINATARIO', destNombre, destDir, destTel, destDni, margin + halfWidth + 4, halfWidth);

  y += boxHeight + 2;

  // ========== PAGO + DESCRIPCIÓN + CONCEPTOS ==========
  const thirdWidth = contentWidth / 3 - 2;

  const fleteEnDetalles = detalles.find(d => d.nombre_concepto?.toLowerCase() === 'flete');
  const totalConceptos = detalles.reduce((sum, d) => sum + (d.monto || 0), 0);
  const fleteCalculado = shipment.precio_total - totalConceptos;
  const conceptosAMostrar = fleteEnDetalles
    ? detalles
    : [{ nombre_concepto: 'Flete', monto: fleteCalculado > 0 ? fleteCalculado : shipment.precio_total }, ...detalles];

  const rowHeight = Math.max(30, 10 + conceptosAMostrar.length * 5);
  const colHeaderH = 6;

  const drawColHeader = (title: string, x: number, w: number) => {
    doc.setFillColor(230, 230, 230);
    doc.rect(x, y, w, colHeaderH, 'F');
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, rowHeight);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(title, x + 2, y + 4.2);
  };

  // PAGO
  drawColHeader('PAGO', margin, thirdWidth);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  const tipoPago = TIPO_PAGO_LABELS[shipment.tipo_pago || 'contado'] || shipment.tipo_pago || 'Contado';
  doc.text(tipoPago, margin + 2, y + colHeaderH + 5);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Bultos: ${shipment.cantidad_bultos || 1}`, margin + 2, y + colHeaderH + 11);
  if (shipment.peso_kg) {
    doc.text(`Peso: ${shipment.peso_kg} kg`, margin + 2, y + colHeaderH + 16);
  }

  // DESCRIPCIÓN
  const descX = margin + thirdWidth + 2;
  drawColHeader('DESCRIPCIÓN', descX, thirdWidth);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  const desc = (shipment.descripcion || '-');
  const descLines = doc.splitTextToSize(desc, thirdWidth - 4);
  doc.text(descLines.slice(0, 4), descX + 2, y + colHeaderH + 5);
  if (shipment.valor_declarado) {
    doc.setFont('helvetica', 'bold');
    doc.text(`V.Decl: ${formatCurrency(shipment.valor_declarado)}`, descX + 2, y + rowHeight - 2);
  }

  // CONCEPTOS
  const concX = margin + (thirdWidth + 2) * 2;
  drawColHeader('CONCEPTOS', concX, thirdWidth);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  let conceptY = y + colHeaderH + 4.5;
  for (const detalle of conceptosAMostrar) {
    doc.setFont('helvetica', 'normal');
    doc.text(detalle.nombre_concepto.substring(0, 18), concX + 2, conceptY);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(detalle.monto), concX + thirdWidth - 2, conceptY, { align: 'right' });
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.1);
    doc.line(concX + 2, conceptY + 1.2, concX + thirdWidth - 2, conceptY + 1.2);
    conceptY += 5;
  }

  y += rowHeight + 2;

  // ========== QR + TOTAL + SIGNATURES ==========
  const blockHeight = 38;
  const qrSize = 30;
  const qrBoxWidth = 34;
  const totalBoxWidth = 56;
  const sigWidth = (contentWidth - qrBoxWidth - totalBoxWidth - 6) / 2;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Escaneá para seguir tu envío', margin, y + 3);

  if (assets.qrCodeBase64) {
    try {
      doc.addImage(assets.qrCodeBase64, 'PNG', margin, y + 4.5, qrSize, qrSize);
    } catch (e) {}
  }

  const shortCode = shipment.tracking_number.split('-').pop() || shipment.tracking_number.slice(-6);
  doc.setFontSize(10);
  doc.setFont('courier', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(shortCode, margin + qrSize / 2, y + 4.5 + qrSize + 3, { align: 'center' });

  // TOTAL box
  const totalX = margin + qrBoxWidth + 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1.8);
  doc.rect(totalX, y, totalBoxWidth, blockHeight);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text(tipoPago.toUpperCase(), totalX + totalBoxWidth / 2, y + 7, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('TOTAL', totalX + totalBoxWidth / 2, y + 16, { align: 'center' });

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(shipment.precio_total), totalX + totalBoxWidth / 2, y + 30, { align: 'center' });

  // Signature boxes
  const sig1X = totalX + totalBoxWidth + 4;
  const sig2X = sig1X + sigWidth + 2;

  const drawSigBox = (label: string, x: number) => {
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    doc.rect(x, y, sigWidth, blockHeight);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(label, x + sigWidth / 2, y + 5, { align: 'center' });
    doc.setLineWidth(0.4);
    doc.line(x + 3, y + 24, x + sigWidth - 3, y + 24);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Firma y aclaración', x + sigWidth / 2, y + 28, { align: 'center' });
    doc.setLineWidth(0.4);
    doc.line(x + 3, y + 33, x + sigWidth - 3, y + 33);
    doc.setFontSize(8);
    doc.text('DNI', x + sigWidth / 2, y + 36.5, { align: 'center' });
  };

  drawSigBox('REMITENTE', sig1X);
  drawSigBox('DESTINATARIO', sig2X);

  y += blockHeight + 2;

  // ========== OBSERVACIONES + FOOTER ==========
  const obsBoxH = 14;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, contentWidth, obsBoxH);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('OBS:', margin + 2, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  const obs = (shipment.notas || '');
  const obsLines = doc.splitTextToSize(obs, contentWidth - 16);
  doc.text(obsLines.slice(0, 2), margin + 12, y + 4);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text(
    'No contiene dinero en efectivo, cheques ni valores. Acepto los términos del servicio. DOCUMENTO NO VÁLIDO COMO FACTURA.',
    margin + 2,
    y + obsBoxH - 2
  );
}

/**
 * Anexa el comprobante (Copia Agencia + Copia Cliente) a un jsPDF existente.
 * Si `startNewPage` es true, agrega una página A4 portrait nueva antes de dibujar.
 * Si es false, dibuja en la página actual (asumida A4 portrait).
 */
export async function appendShipmentReceiptToDoc(
  doc: jsPDF,
  shipment: ShipmentData,
  detalles: DetalleConcepto[],
  branding: BrandingData | null,
  trackingUrl: string,
  startNewPage: boolean = true,
): Promise<void> {
  if (startNewPage) {
    doc.addPage([210, 297], 'portrait');
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const halfHeight = pageHeight / 2;

  const [tenantLogo, qrCodeBase64, defaultLogo] = await Promise.all([
    branding?.logo_light ? loadImageAsBase64(branding.logo_light) : null,
    loadImageAsBase64(generateQRCodeDataUrl(trackingUrl)),
    loadLogoAsBase64(),
  ]);

  const assets: LoadedAssets = { tenantLogo, qrCodeBase64, defaultLogo };

  drawReceipt(doc, shipment, detalles, branding, assets, 0, 'agencia');
  drawCutLine(doc, halfHeight, pageWidth);
  drawReceipt(doc, shipment, detalles, branding, assets, halfHeight, 'cliente');
}

export async function generateShipmentReceiptPDF(
  shipment: ShipmentData,
  detalles: DetalleConcepto[],
  branding: BrandingData | null,
  trackingUrl: string
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  await appendShipmentReceiptToDoc(doc, shipment, detalles, branding, trackingUrl, false);

  doc.save(`Comprobante_${shipment.tracking_number}.pdf`);
}
