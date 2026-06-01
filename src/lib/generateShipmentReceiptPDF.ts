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
  tenantLogoRatio: number; // width/height
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

function generateQRCodeDataUrl(text: string, size: number = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=png`;
}

async function loadImageWithRatio(url: string): Promise<{ base64: string; ratio: number } | null> {
  try {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timeout = setTimeout(() => resolve(null), 6000);
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const w = img.width || 1;
          const h = img.height || 1;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve({ base64: canvas.toDataURL('image/png'), ratio: w / h });
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

// Draw a single full A4 receipt
function drawReceipt(
  doc: jsPDF,
  shipment: ShipmentData,
  detalles: DetalleConcepto[],
  branding: BrandingData | null,
  assets: LoadedAssets,
  copyType: 'agencia' | 'cliente'
) {
  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182

  const logoToUse = assets.tenantLogo || assets.defaultLogo;
  const companyName = branding?.nombre_app || 'Geologistick';
  const primaryColor = branding?.color_primario || '#3B82F6';
  const primaryRgb = hexToRgb(primaryColor);

  let y = margin;

  // ========== TOP ACCENT BAR ==========
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(margin, y, contentWidth, 2.2, 'F');
  y += 6;

  // ========== HEADER ==========
  const headerStart = y;
  const logoMaxH = 24;
  const logoMaxW = 50;
  let logoDrawW = logoMaxH;
  let logoDrawH = logoMaxH;
  if (logoToUse) {
    const ratio = assets.tenantLogo ? assets.tenantLogoRatio : 1;
    if (ratio >= 1) {
      logoDrawW = Math.min(logoMaxW, logoMaxH * ratio);
      logoDrawH = logoDrawW / ratio;
    } else {
      logoDrawH = logoMaxH;
      logoDrawW = logoDrawH * ratio;
    }
    try {
      doc.addImage(logoToUse, 'PNG', margin, y, logoDrawW, logoDrawH);
    } catch (e) {}
  }

  const textX = margin + logoDrawW + 6;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(companyName, textX, y + 8);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  const branchInfo = shipment.sucursal_origen;
  if (branchInfo) {
    const branchLine1 = `${branchInfo.direccion || ''} ${branchInfo.ciudad || ''}`.trim();
    const branchLine2 = branchInfo.telefono ? `Tel: ${branchInfo.telefono}` : '';
    doc.text(branchLine1.substring(0, 70), textX, y + 14);
    if (branchLine2) doc.text(branchLine2, textX, y + 19);
  }

  // Right side: badge + guía + fecha
  const rightX = pageWidth - margin;
  const copyLabel = copyType === 'agencia' ? 'COPIA AGENCIA' : 'COPIA CLIENTE';

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const labelWidth = doc.getTextWidth(copyLabel) + 8;
  doc.setFillColor(0, 0, 0);
  doc.rect(rightX - labelWidth, y, labelWidth, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(copyLabel, rightX - labelWidth / 2, y + 4.8, { align: 'center' });

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(`Guía Nº: ${shipment.tracking_number}`, rightX, y + 15, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  const fecha = new Date(shipment.created_at).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  doc.text(`Fecha: ${fecha}`, rightX, y + 20.5, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(140, 140, 140);
  doc.text('DOCUMENTO NO VÁLIDO COMO FACTURA', rightX, y + 25, { align: 'right' });

  y = headerStart + Math.max(logoDrawH, 26) + 4;

  // Separator
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ========== ORIGEN / DESTINO bars ==========
  const halfWidth = contentWidth / 2 - 3;
  const odBarH = 13;

  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(margin, y, halfWidth, odBarH, 'F');
  doc.setFillColor(34, 139, 80);
  doc.rect(margin + halfWidth + 6, y, halfWidth, odBarH, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ORIGEN', margin + 4, y + 5.5);
  doc.text('DESTINO', margin + halfWidth + 10, y + 5.5);

  const ciudadOrigen = shipment.sucursal_origen?.ciudad || shipment.ciudad_retiro || '-';
  const ciudadDestino = shipment.sucursal_destino?.ciudad || shipment.ciudad_entrega || '-';
  doc.setFontSize(13);
  doc.text(ciudadOrigen.substring(0, 28), margin + 4, y + 11);
  doc.text(ciudadDestino.substring(0, 28), margin + halfWidth + 10, y + 11);

  y += odBarH + 5;

  // ========== REMITENTE / DESTINATARIO boxes ==========
  const boxHeight = 46;
  const boxHeaderH = 7;

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
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, x + 3, boxY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(13);
    doc.text((name || '-').substring(0, 38), x + 3, boxY + boxHeaderH + 6);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const addrLines = doc.splitTextToSize(`Dir: ${address || '-'}`, boxWidth - 6);
    doc.text(addrLines.slice(0, 3), x + 3, boxY + boxHeaderH + 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`Tel: ${phone || '-'}`, x + 3, boxY + boxHeight - 3);
    doc.text(`DNI: ${dni || '-'}`, x + boxWidth / 2 + 2, boxY + boxHeight - 3);
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
  drawPersonBox('DESTINATARIO', destNombre, destDir, destTel, destDni, margin + halfWidth + 6, halfWidth);

  y += boxHeight + 5;

  // ========== Condición de venta strip ==========
  const tipoPago = TIPO_PAGO_LABELS[shipment.tipo_pago || 'contado'] || shipment.tipo_pago || 'Contado';
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 9);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('Condición de Venta:', margin + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(tipoPago, margin + 50, y + 6);
  y += 9 + 5;

  // ========== DESCRIPCIÓN + CONCEPTOS ==========
  const fleteEnDetalles = detalles.find(d => d.nombre_concepto?.toLowerCase() === 'flete');
  const totalConceptos = detalles.reduce((sum, d) => sum + (d.monto || 0), 0);
  const fleteCalculado = shipment.precio_total - totalConceptos;
  const conceptosAMostrar = fleteEnDetalles
    ? detalles
    : [{ nombre_concepto: 'Flete', monto: fleteCalculado > 0 ? fleteCalculado : shipment.precio_total }, ...detalles];

  const rowHeight = Math.max(46, 14 + conceptosAMostrar.length * 6);
  const colHeaderH = 7;

  const drawColHeader = (title: string, x: number, w: number) => {
    doc.setFillColor(230, 230, 230);
    doc.rect(x, y, w, colHeaderH, 'F');
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, rowHeight);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(title, x + 3, y + 5);
  };

  // DESCRIPCIÓN (left half)
  drawColHeader('DESCRIPCIÓN DEL ENVÍO', margin, halfWidth);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  let descY = y + colHeaderH + 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Bultos:', margin + 3, descY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${shipment.cantidad_bultos || 1}`, margin + 22, descY);
  descY += 6;
  if (shipment.peso_kg) {
    doc.setFont('helvetica', 'bold');
    doc.text('Peso:', margin + 3, descY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${shipment.peso_kg} kg`, margin + 22, descY);
    descY += 6;
  }
  if (shipment.descripcion) {
    doc.setFont('helvetica', 'bold');
    doc.text('Desc:', margin + 3, descY);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(shipment.descripcion, halfWidth - 26);
    doc.text(descLines.slice(0, 2), margin + 22, descY);
    descY += 6 * Math.min(2, descLines.length);
  }
  if (shipment.valor_declarado) {
    doc.setFont('helvetica', 'bold');
    doc.text('V. Declarado:', margin + 3, descY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(shipment.valor_declarado), margin + 40, descY);
  }

  // CONCEPTOS (right half)
  const concX = margin + halfWidth + 6;
  drawColHeader('CONCEPTOS', concX, halfWidth);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  let conceptY = y + colHeaderH + 6;
  for (const detalle of conceptosAMostrar) {
    doc.setFont('helvetica', 'normal');
    doc.text(detalle.nombre_concepto.substring(0, 28), concX + 3, conceptY);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(detalle.monto), concX + halfWidth - 3, conceptY, { align: 'right' });
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.line(concX + 3, conceptY + 1.5, concX + halfWidth - 3, conceptY + 1.5);
    conceptY += 6;
  }

  y += rowHeight + 5;

  // ========== QR + TOTAL ==========
  const qrBlockH = 46;
  const qrSize = 40;

  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentWidth, qrBlockH);

  // QR left
  if (assets.qrCodeBase64) {
    try {
      doc.addImage(assets.qrCodeBase64, 'PNG', margin + 3, y + 3, qrSize, qrSize);
    } catch (e) {}
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Escaneá para seguir tu envío', margin + qrSize + 8, y + 10);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(shipment.tracking_number, margin + qrSize + 8, y + 18);

  // TOTAL right
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('TOTAL', pageWidth - margin - 4, y + 14, { align: 'right' });

  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(formatCurrency(shipment.precio_total), pageWidth - margin - 4, y + 30, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(tipoPago, pageWidth - margin - 4, y + 38, { align: 'right' });

  y += qrBlockH + 5;

  // ========== FIRMAS ==========
  const sigH = 36;
  const sigW = contentWidth / 2 - 3;

  const drawSigBox = (label: string, x: number, includeFecha: boolean) => {
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    doc.rect(x, y, sigW, sigH);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(label, x + sigW / 2, y + 5, { align: 'center' });

    doc.setLineWidth(0.4);
    doc.setDrawColor(80, 80, 80);
    doc.line(x + 5, y + 22, x + sigW - 5, y + 22);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    doc.text('Firma y aclaración', x + sigW / 2, y + 25.5, { align: 'center' });

    if (includeFecha) {
      doc.line(x + 5, y + 31, x + sigW / 2 - 3, y + 31);
      doc.line(x + sigW / 2 + 3, y + 31, x + sigW - 5, y + 31);
      doc.text('DNI', x + (5 + sigW / 2 - 3) / 2 + 2, y + 34.5, { align: 'center' });
      doc.text('Fecha', x + sigW / 2 + 3 + (sigW / 2 - 8) / 2, y + 34.5, { align: 'center' });
    } else {
      doc.line(x + 5, y + 31, x + sigW - 5, y + 31);
      doc.text('DNI', x + sigW / 2, y + 34.5, { align: 'center' });
    }
  };

  drawSigBox('REMITENTE', margin, false);
  drawSigBox('DESTINATARIO', margin + sigW + 6, true);

  y += sigH + 5;

  // ========== OBSERVACIONES ==========
  const obsBoxH = 22;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, obsBoxH);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('OBSERVACIONES', margin + 3, y + 5);

  if (shipment.notas) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const obsLines = doc.splitTextToSize(shipment.notas, contentWidth - 8);
    doc.text(obsLines.slice(0, 2), margin + 3, y + 10);
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Declaro que esta encomienda no contiene dinero en efectivo, cheques ni valores negociables. El remitente acepta los términos y condiciones del servicio.',
    margin + 3,
    y + obsBoxH - 3,
    { maxWidth: contentWidth - 6 }
  );

  // Footer bar
  const footerY = pageHeight - margin - 4;
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(margin, footerY, contentWidth, 1.5, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.text(`${companyName} · ${copyLabel}`, pageWidth / 2, footerY + 4.5, { align: 'center' });
}

/**
 * Anexa el comprobante (Copia Agencia en una página + Copia Cliente en otra página) a un jsPDF existente.
 * Cada copia ocupa una A4 portrait completa.
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

  const [tenantLogoData, qrCodeData, defaultLogo] = await Promise.all([
    branding?.logo_light ? loadImageWithRatio(branding.logo_light) : Promise.resolve(null),
    loadImageWithRatio(generateQRCodeDataUrl(trackingUrl)),
    loadLogoAsBase64(),
  ]);

  const assets: LoadedAssets = {
    tenantLogo: tenantLogoData?.base64 || null,
    tenantLogoRatio: tenantLogoData?.ratio || 1,
    qrCodeBase64: qrCodeData?.base64 || null,
    defaultLogo,
  };

  // Página 1: Copia Agencia
  drawReceipt(doc, shipment, detalles, branding, assets, 'agencia');

  // Página 2: Copia Cliente
  doc.addPage([210, 297], 'portrait');
  drawReceipt(doc, shipment, detalles, branding, assets, 'cliente');
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
