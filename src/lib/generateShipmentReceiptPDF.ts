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
  tenantLogoRatio: number;
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

function generateQRCodeDataUrl(text: string, size: number = 200): string {
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

// Draws a single receipt copy within a half A4 (≈145mm usable height) at the given vertical offset.
function drawReceipt(
  doc: jsPDF,
  shipment: ShipmentData,
  detalles: DetalleConcepto[],
  branding: BrandingData | null,
  assets: LoadedAssets,
  copyType: 'agencia' | 'cliente',
  offsetY: number,
) {
  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const margin = 8;
  const contentWidth = pageWidth - margin * 2; // 194

  const logoToUse = assets.tenantLogo || assets.defaultLogo;
  const companyName = branding?.nombre_app || 'Geologistick';
  const primaryColor = branding?.color_primario || '#3B82F6';
  const primaryRgb = hexToRgb(primaryColor);

  let y = offsetY + 2;

  // Top accent bar
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(margin, y, contentWidth, 1, 'F');
  y += 2.5;

  // ===== HEADER (12mm de alto) =====
  const headerStart = y;
  const headerH = 12;
  const logoMaxH = 11;
  const logoMaxW = 22;
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

  const textX = margin + logoDrawW + 3;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(companyName.substring(0, 30), textX, y + 4);

  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  const branchInfo = shipment.sucursal_origen;
  if (branchInfo) {
    const branchLine1 = `${branchInfo.direccion || ''} ${branchInfo.ciudad || ''}`.trim();
    const tel = branchInfo.telefono ? ` · Tel: ${branchInfo.telefono}` : '';
    doc.text((branchLine1 + tel).substring(0, 75), textX, y + 7.5);
  }

  // Right side: badge + guía + fecha
  const rightX = pageWidth - margin;
  const copyLabel = copyType === 'agencia' ? 'COPIA AGENCIA' : 'COPIA CLIENTE';

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  const labelWidth = doc.getTextWidth(copyLabel) + 5;
  doc.setFillColor(0, 0, 0);
  doc.rect(rightX - labelWidth, y, labelWidth, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(copyLabel, rightX - labelWidth / 2, y + 2.8, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(`Guía: ${shipment.tracking_number}`, rightX, y + 8, { align: 'right' });

  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  const fecha = new Date(shipment.created_at).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  doc.text(`Fecha: ${fecha}`, rightX, y + 11.5, { align: 'right' });

  y = headerStart + headerH;

  // Separator
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 2;

  // ===== ORIGEN / DESTINO bars =====
  const halfWidth = contentWidth / 2 - 1.5;
  const odBarH = 6.5;

  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(margin, y, halfWidth, odBarH, 'F');
  doc.setFillColor(34, 139, 80);
  doc.rect(margin + halfWidth + 4, y, halfWidth, odBarH, 'F');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ORIGEN', margin + 2.5, y + 2.6);
  doc.text('DESTINO', margin + halfWidth + 5.5, y + 2.6);

  const ciudadOrigen = shipment.sucursal_origen?.ciudad || shipment.ciudad_retiro || '-';
  const ciudadDestino = shipment.sucursal_destino?.ciudad || shipment.ciudad_entrega || '-';
  doc.setFontSize(8);
  doc.text(ciudadOrigen.substring(0, 32), margin + 2.5, y + 5.5);
  doc.text(ciudadDestino.substring(0, 32), margin + halfWidth + 5.5, y + 5.5);

  y += odBarH + 2;

  // ===== REMITENTE / DESTINATARIO =====
  const boxHeight = 22;
  const boxHeaderH = 4;

  const drawPersonBox = (
    title: string,
    name: string,
    address: string,
    phone: string,
    dni: string,
    x: number,
    boxWidth: number,
  ) => {
    const boxY = y;
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    doc.rect(x, boxY, boxWidth, boxHeight);
    doc.setFillColor(0, 0, 0);
    doc.rect(x, boxY, boxWidth, boxHeaderH, 'F');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, x + 2, boxY + 2.8);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(8.5);
    doc.text((name || '-').substring(0, 42), x + 2, boxY + boxHeaderH + 3.5);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const addrLines = doc.splitTextToSize(`Dir: ${address || '-'}`, boxWidth - 4);
    doc.text(addrLines.slice(0, 2), x + 2, boxY + boxHeaderH + 7);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`Tel: ${(phone || '-').substring(0, 18)}`, x + 2, boxY + boxHeight - 1.8);
    doc.text(`DNI: ${(dni || '-').substring(0, 14)}`, x + boxWidth / 2 + 2, boxY + boxHeight - 1.8);
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
  drawPersonBox('DESTINATARIO', destNombre, destDir, destTel, destDni, margin + halfWidth + 3, halfWidth);

  y += boxHeight + 2;

  // ===== Condición de venta =====
  const tipoPago = TIPO_PAGO_LABELS[shipment.tipo_pago || 'contado'] || shipment.tipo_pago || 'Contado';
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, contentWidth, 5);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('Condición de Venta:', margin + 2, y + 3.4);
  doc.setFont('helvetica', 'normal');
  doc.text(tipoPago, margin + 34, y + 3.4);
  y += 5 + 2;

  // ===== DESCRIPCIÓN + CONCEPTOS =====
  const fleteEnDetalles = detalles.find(d => d.nombre_concepto?.toLowerCase() === 'flete');
  const totalConceptos = detalles.reduce((sum, d) => sum + (d.monto || 0), 0);
  const fleteCalculado = shipment.precio_total - totalConceptos;
  const conceptosAMostrar = fleteEnDetalles
    ? detalles
    : [{ nombre_concepto: 'Flete', monto: fleteCalculado > 0 ? fleteCalculado : shipment.precio_total }, ...detalles];

  // Limitar a 6 conceptos visibles
  const maxConceptos = 6;
  const conceptosVisibles = conceptosAMostrar.slice(0, maxConceptos);
  const conceptosRestantes = conceptosAMostrar.length - conceptosVisibles.length;

  const rowHeight = Math.max(24, 8 + (conceptosVisibles.length + (conceptosRestantes > 0 ? 1 : 0)) * 3.5);
  const colHeaderH = 4;

  const drawColHeader = (title: string, x: number, w: number) => {
    doc.setFillColor(230, 230, 230);
    doc.rect(x, y, w, colHeaderH, 'F');
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, rowHeight);
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(title, x + 2, y + 2.8);
  };

  // DESCRIPCIÓN
  drawColHeader('DESCRIPCIÓN DEL ENVÍO', margin, halfWidth);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 30, 30);
  let descY = y + colHeaderH + 3.5;
  doc.setFont('helvetica', 'bold');
  doc.text('Bultos:', margin + 2, descY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${shipment.cantidad_bultos || 1}`, margin + 14, descY);
  descY += 3.5;
  if (shipment.peso_kg) {
    doc.setFont('helvetica', 'bold');
    doc.text('Peso:', margin + 2, descY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${shipment.peso_kg} kg`, margin + 14, descY);
    descY += 3.5;
  }
  if (shipment.descripcion) {
    doc.setFont('helvetica', 'bold');
    doc.text('Desc:', margin + 2, descY);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(shipment.descripcion, halfWidth - 18);
    doc.text(descLines.slice(0, 2), margin + 14, descY);
    descY += 3.5 * Math.min(2, descLines.length);
  }
  if (shipment.valor_declarado) {
    doc.setFont('helvetica', 'bold');
    doc.text('V. Decl.:', margin + 2, descY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(shipment.valor_declarado), margin + 18, descY);
  }

  // CONCEPTOS
  const esCtaCte = shipment.tipo_pago === 'cuenta_corriente';
  const concX = margin + halfWidth + 3;
  drawColHeader('CONCEPTOS', concX, halfWidth);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 30, 30);
  let conceptY = y + colHeaderH + 3.5;
  if (esCtaCte) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('Facturación en cuenta corriente', concX + halfWidth / 2, conceptY + 4, { align: 'center' });
  } else {
    for (const detalle of conceptosVisibles) {
      doc.setFont('helvetica', 'normal');
      doc.text(detalle.nombre_concepto.substring(0, 28), concX + 2, conceptY);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(detalle.monto), concX + halfWidth - 2, conceptY, { align: 'right' });
      conceptY += 3.5;
    }
    if (conceptosRestantes > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(110, 110, 110);
      doc.text(`+ ${conceptosRestantes} concepto(s) más`, concX + 2, conceptY);
    }
  }

  y += rowHeight + 2;

  // ===== QR + TOTAL =====
  const qrBlockH = 22;
  const qrSize = 18;

  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, qrBlockH);

  if (assets.qrCodeBase64) {
    try {
      doc.addImage(assets.qrCodeBase64, 'PNG', margin + 2, y + 2, qrSize, qrSize);
    } catch (e) {}
  }
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Escaneá para seguir tu envío', margin + qrSize + 4, y + 7);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text(shipment.tracking_number, margin + qrSize + 4, y + 12);

  if (esCtaCte) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text('CUENTA CORRIENTE', pageWidth - margin - 3, y + 12, { align: 'right' });
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(tipoPago, pageWidth - margin - 3, y + 19, { align: 'right' });
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('TOTAL', pageWidth - margin - 3, y + 6, { align: 'right' });

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(formatCurrency(shipment.precio_total), pageWidth - margin - 3, y + 14, { align: 'right' });

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(tipoPago, pageWidth - margin - 3, y + 19, { align: 'right' });
  }

  y += qrBlockH + 2;

  // ===== FIRMAS =====
  const sigH = 14;
  const sigW = contentWidth / 2 - 1.5;

  const drawSigBox = (label: string, x: number) => {
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.2);
    doc.rect(x, y, sigW, sigH);
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(label, x + sigW / 2, y + 3, { align: 'center' });

    doc.setLineWidth(0.3);
    doc.setDrawColor(80, 80, 80);
    doc.line(x + 4, y + 9, x + sigW - 4, y + 9);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    doc.text('Firma y aclaración', x + sigW / 2, y + 12, { align: 'center' });
  };

  drawSigBox('REMITENTE', margin);
  drawSigBox('DESTINATARIO', margin + sigW + 3);

  y += sigH + 2;

  // ===== OBSERVACIONES + footer legal =====
  const obsBoxH = 9;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, contentWidth, obsBoxH);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('OBSERVACIONES:', margin + 2, y + 2.8);

  if (shipment.notas) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(50, 50, 50);
    const obsLines = doc.splitTextToSize(shipment.notas, contentWidth - 32);
    doc.text(obsLines.slice(0, 1), margin + 28, y + 2.8);
  }

  doc.setFontSize(5.8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Declaro que esta encomienda no contiene dinero en efectivo, cheques ni valores negociables. El remitente acepta los términos y condiciones del servicio.',
    margin + 2,
    y + obsBoxH - 1.5,
    { maxWidth: contentWidth - 4 },
  );
}

/**
 * Anexa el comprobante (Copia Agencia arriba + Copia Cliente abajo) en una sola hoja A4 al jsPDF.
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

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const halfHeight = 148.5;

  // Mitad superior: Copia Agencia
  drawReceipt(doc, shipment, detalles, branding, assets, 'agencia', 0);

  // Línea de corte punteada en y = 148.5
  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(8, halfHeight, pageWidth - 8, halfHeight);
  doc.setLineDashPattern([], 0);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(140, 140, 140);
  doc.text('— Cortar aquí —', pageWidth / 2, halfHeight - 0.5, { align: 'center' });

  // Mitad inferior: Copia Cliente
  drawReceipt(doc, shipment, detalles, branding, assets, 'cliente', halfHeight);
}

export async function generateShipmentReceiptPDF(
  shipment: ShipmentData,
  detalles: DetalleConcepto[],
  branding: BrandingData | null,
  trackingUrl: string,
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  await appendShipmentReceiptToDoc(doc, shipment, detalles, branding, trackingUrl, false);

  doc.save(`Comprobante_${shipment.tracking_number}.pdf`);
}
