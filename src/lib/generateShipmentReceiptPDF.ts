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
  
  // Dashed line
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([3, 2], 0);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  doc.setLineDashPattern([], 0); // Reset to solid line
  
  // Scissors icon (✂) in the middle
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('✂ - - - - - - - - - CORTAR AQUÍ - - - - - - - - - ✂', pageWidth / 2, yPosition - 1.5, { align: 'center' });
}

// Draw a single compact receipt
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

  // ========== HEADER (compact) ==========
  const logoSize = 16; // Increased from 12mm to 16mm for better visibility
  const logoOffset = logoSize + 4; // Space after logo for text
  
  if (logoToUse) {
    try {
      doc.addImage(logoToUse, 'PNG', margin, y, logoSize, logoSize);
    } catch (e) {
      // Continue without logo
    }
  }

  // Company name and branch info (adjusted position for larger logo)
  // LASER BOLD: Increased from 10pt to 12pt
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(companyName, margin + logoOffset, y + 5);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  
  const branchInfo = shipment.sucursal_origen;
  if (branchInfo) {
    const branchLine = `${branchInfo.direccion || ''} ${branchInfo.ciudad || ''} ${branchInfo.telefono ? '• Tel: ' + branchInfo.telefono : ''}`;
    doc.text(branchLine.substring(0, 55), margin + logoOffset, y + 10);
  }

  // Receipt number and date (right side)
  // LASER BOLD: Increased from 9pt to 11pt
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(`Guía: ${shipment.tracking_number}`, pageWidth - margin, y + 4, { align: 'right' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const fecha = new Date(shipment.created_at).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  doc.text(`Fecha: ${fecha}`, pageWidth - margin, y + 9, { align: 'right' });

  y += logoSize + 2; // Adjust based on logo size

  // Separator line - LASER BOLD: Increased from 0.5 to 1.0
  doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.setLineWidth(1.0);
  doc.line(margin, y, pageWidth - margin, y);
  y += 3;

  // ========== ORIGEN / DESTINO (inline) ==========
  const halfWidth = contentWidth / 2 - 2;
  
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(margin, y, halfWidth, 6, 'F');
  doc.setFillColor(34, 197, 94); // Green
  doc.rect(margin + halfWidth + 4, y, halfWidth, 6, 'F');
  
  // LASER BOLD: Increased from 7pt to 8pt
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ORIGEN', margin + 3, y + 4);
  doc.text('DESTINO', margin + halfWidth + 7, y + 4);
  
  // Cities next to labels - LASER BOLD: 8pt bold
  doc.setFontSize(8);
  const ciudadOrigen = shipment.sucursal_origen?.ciudad || shipment.ciudad_retiro || '-';
  const ciudadDestino = shipment.sucursal_destino?.ciudad || shipment.ciudad_entrega || '-';
  doc.text(ciudadOrigen.substring(0, 20), margin + halfWidth - 3, y + 4, { align: 'right' });
  doc.text(ciudadDestino.substring(0, 20), pageWidth - margin - 3, y + 4, { align: 'right' });
  
  y += 8;

  // ========== REMITENTE / DESTINATARIO (compact boxes) ==========
  const boxHeight = 20;
  
  const drawPersonBoxCompact = (
    title: string, 
    name: string, 
    address: string, 
    phone: string, 
    dni: string,
    x: number, 
    boxWidth: number
  ) => {
    const boxY = y;
    
    doc.setDrawColor(180, 180, 180);
    // LASER BOLD: Increased from 0.2 to 0.4
    doc.setLineWidth(0.4);
    doc.rect(x, boxY, boxWidth, boxHeight);
    
    doc.setFillColor(245, 245, 245);
    doc.rect(x, boxY, boxWidth, 4.5, 'F');
    
    // LASER BOLD: Increased from 6pt to 7pt
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(title, x + 2, boxY + 3);
    
    // LASER BOLD: Name in bold and increased from 7pt to 8pt
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(8);
    doc.text(name.substring(0, 30) || '-', x + 2, boxY + 9);
    
    // LASER BOLD: Increased from 6pt to 7pt
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text(`Dir: ${(address || '-').substring(0, 35)}`, x + 2, boxY + 13);
    doc.text(`Tel: ${phone || '-'} | DNI: ${dni || '-'}`, x + 2, boxY + 17);
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

  drawPersonBoxCompact('REMITENTE', remitenteNombre, remitenteDir, remitenteTel, remitenteDni, margin, halfWidth);
  drawPersonBoxCompact('DESTINATARIO', destNombre, destDir, destTel, destDni, margin + halfWidth + 4, halfWidth);
  
  y += boxHeight + 2;

  // ========== CONDICIÓN + DESCRIPCIÓN + CONCEPTOS (3 columns) ==========
  const thirdWidth = contentWidth / 3 - 2;
  
  // Payment condition (small box)
  doc.setDrawColor(180, 180, 180);
  // LASER BOLD: Increased from 0.2 to 0.4
  doc.setLineWidth(0.4);
  doc.rect(margin, y, thirdWidth, 18);
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, thirdWidth, 4, 'F');
  // LASER BOLD: Increased from 6pt to 7pt
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('PAGO', margin + 2, y + 3);
  
  // LASER BOLD: Bold payment type
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  const tipoPago = TIPO_PAGO_LABELS[shipment.tipo_pago || 'contado'] || shipment.tipo_pago || 'Contado';
  doc.text(tipoPago, margin + 2, y + 9);
  
  doc.setFontSize(7);
  doc.text(`Bultos: ${shipment.cantidad_bultos || 1}`, margin + 2, y + 13);
  if (shipment.peso_kg) {
    doc.text(`Peso: ${shipment.peso_kg}kg`, margin + 2, y + 17);
  }
  
  // Description (middle)
  doc.setLineWidth(0.4);
  doc.rect(margin + thirdWidth + 2, y, thirdWidth, 18);
  doc.setFillColor(245, 245, 245);
  doc.rect(margin + thirdWidth + 2, y, thirdWidth, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text('DESCRIPCIÓN', margin + thirdWidth + 4, y + 3);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 30, 30);
  const desc = (shipment.descripcion || '-').substring(0, 45);
  doc.text(desc, margin + thirdWidth + 4, y + 9);
  if (shipment.valor_declarado) {
    doc.text(`V.Decl: ${formatCurrency(shipment.valor_declarado)}`, margin + thirdWidth + 4, y + 14);
  }
  
  // Concepts (right)
  doc.setLineWidth(0.4);
  doc.rect(margin + (thirdWidth + 2) * 2, y, thirdWidth, 18);
  doc.setFillColor(245, 245, 245);
  doc.rect(margin + (thirdWidth + 2) * 2, y, thirdWidth, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text('CONCEPTOS', margin + (thirdWidth + 2) * 2 + 2, y + 3);
  
  // LASER BOLD: Bold concepts
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const conceptX = margin + (thirdWidth + 2) * 2 + 2;
  const conceptXEnd = margin + (thirdWidth + 2) * 2 + thirdWidth - 2;
  
  const totalConceptos = detalles.reduce((sum, d) => sum + (d.monto || 0), 0);
  const flete = shipment.precio_total - totalConceptos;
  
  let conceptY = y + 8;
  doc.setTextColor(30, 30, 30);
  doc.text('Flete:', conceptX, conceptY);
  doc.text(formatCurrency(flete > 0 ? flete : shipment.precio_total), conceptXEnd, conceptY, { align: 'right' });
  
  for (const detalle of detalles.slice(0, 2)) {
    conceptY += 4;
    doc.text(`${detalle.nombre_concepto}:`, conceptX, conceptY);
    doc.text(formatCurrency(detalle.monto), conceptXEnd, conceptY, { align: 'right' });
  }
  
  y += 20;

  // ========== QR + TOTAL + FIRMAS ==========
  const qrSize = 20;
  const qrBoxWidth = 30;
  const totalBoxWidth = 45;
  const sigWidth = (contentWidth - qrBoxWidth - totalBoxWidth - 6) / 2;
  
  // QR Code
  if (assets.qrCodeBase64) {
    try {
      doc.addImage(assets.qrCodeBase64, 'PNG', margin + 2, y + 1, qrSize, qrSize);
    } catch (e) {
      // Continue without QR
    }
  }
  
  // Short code for easy search (last 6 characters of tracking)
  const shortCode = shipment.tracking_number.split('-').pop() || shipment.tracking_number.slice(-6);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Buscar con:', margin + 2, y + 22);
  // LASER BOLD: Large short code for customers
  doc.setFontSize(10);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(shortCode, margin + 2, y + 27);
  
  // Total box - LASER BOLD: Increased border from 0.5 to 1.5
  const totalX = margin + qrBoxWidth + 2;
  doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.setLineWidth(1.5);
  doc.rect(totalX, y, totalBoxWidth, 24);
  
  // LASER BOLD: Increased from 8pt to 9pt
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('TOTAL', totalX + totalBoxWidth / 2, y + 8, { align: 'center' });
  
  // LASER BOLD: Increased from 11pt to 14pt
  doc.setFontSize(14);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(formatCurrency(shipment.precio_total), totalX + totalBoxWidth / 2, y + 17, { align: 'center' });
  
  // Signature boxes (compact)
  const sig1X = totalX + totalBoxWidth + 4;
  const sig2X = sig1X + sigWidth + 2;
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  
  // Remitente signature
  doc.rect(sig1X, y, sigWidth, 24);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('REMITENTE', sig1X + sigWidth / 2, y + 3.5, { align: 'center' });
  doc.setLineWidth(0.15);
  doc.line(sig1X + 3, y + 14, sig1X + sigWidth - 3, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.text('Firma', sig1X + sigWidth / 2, y + 17, { align: 'center' });
  doc.line(sig1X + 3, y + 22, sig1X + sigWidth - 3, y + 22);
  doc.text('DNI', sig1X + sigWidth / 2, y + 24, { align: 'center' });
  
  // Destinatario signature
  doc.rect(sig2X, y, sigWidth, 24);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('DESTINATARIO', sig2X + sigWidth / 2, y + 3.5, { align: 'center' });
  doc.setLineWidth(0.15);
  doc.line(sig2X + 3, y + 14, sig2X + sigWidth - 3, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.text('Firma', sig2X + sigWidth / 2, y + 17, { align: 'center' });
  doc.line(sig2X + 3, y + 22, sig2X + sigWidth / 2 - 2, y + 22);
  doc.line(sig2X + sigWidth / 2 + 2, y + 22, sig2X + sigWidth - 3, y + 22);
  doc.text('DNI', sig2X + sigWidth / 4, y + 24, { align: 'center' });
  doc.text('Fecha', sig2X + sigWidth * 3 / 4, y + 24, { align: 'center' });
  
  y += 26;

  // ========== OBSERVACIONES + BADGE ==========
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, contentWidth - 35, 12);
  
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('OBS:', margin + 2, y + 3.5);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  const obs = (shipment.notas || '').substring(0, 80);
  doc.text(obs, margin + 10, y + 3.5);
  
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('No contiene dinero en efectivo, cheques ni valores. Acepto términos del servicio.', margin + 2, y + 8);
  doc.text('DOCUMENTO NO VÁLIDO COMO FACTURA', margin + 2, y + 11);
  
  // Copy badge
  const badgeWidth = 32;
  const badgeX = pageWidth - margin - badgeWidth;
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(badgeX, y + 2, badgeWidth, 8, 'F');
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const copyLabel = copyType === 'agencia' ? 'COPIA AGENCIA' : 'COPIA CLIENTE';
  doc.text(copyLabel, badgeX + badgeWidth / 2, y + 7, { align: 'center' });
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

  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const pageWidth = doc.internal.pageSize.getWidth();   // 210mm
  const halfHeight = pageHeight / 2;                     // ~148.5mm

  // Load assets once
  const [tenantLogo, qrCodeBase64, defaultLogo] = await Promise.all([
    branding?.logo_light ? loadImageAsBase64(branding.logo_light) : null,
    loadImageAsBase64(generateQRCodeDataUrl(trackingUrl)),
    loadLogoAsBase64(),
  ]);

  const assets: LoadedAssets = { tenantLogo, qrCodeBase64, defaultLogo };

  // Draw top receipt (COPIA AGENCIA)
  drawReceipt(doc, shipment, detalles, branding, assets, 0, 'agencia');
  
  // Draw cut line
  drawCutLine(doc, halfHeight, pageWidth);
  
  // Draw bottom receipt (COPIA CLIENTE)
  drawReceipt(doc, shipment, detalles, branding, assets, halfHeight, 'cliente');

  // Save PDF
  doc.save(`Comprobante_${shipment.tracking_number}.pdf`);
}
