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

function generateQRCodeDataUrl(text: string, size: number = 150): string {
  // Using QR Server API for QR generation
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=png`;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
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

export async function generateShipmentReceiptPDF(
  shipment: ShipmentData,
  detalles: DetalleConcepto[],
  branding: BrandingData | null,
  trackingUrl: string,
  copyType: 'agencia' | 'cliente' = 'cliente'
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  
  // Load assets
  const [tenantLogo, qrCodeBase64, defaultLogo] = await Promise.all([
    branding?.logo_light ? loadImageAsBase64(branding.logo_light) : null,
    loadImageAsBase64(generateQRCodeDataUrl(trackingUrl)),
    loadLogoAsBase64(),
  ]);

  const logoToUse = tenantLogo || defaultLogo;
  const companyName = branding?.nombre_app || 'Geologistick';
  const primaryColor = branding?.color_primario || '#3B82F6';
  
  // Parse primary color to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [59, 130, 246];
  };
  
  const primaryRgb = hexToRgb(primaryColor);
  let y = margin;

  // ========== HEADER ==========
  // Logo and company info
  if (logoToUse) {
    try {
      doc.addImage(logoToUse, 'PNG', margin, y, 25, 25);
    } catch (e) {
      // Continue without logo
    }
  }

  // Company name and branch info
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(companyName, margin + 30, y + 8);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  
  const branchInfo = shipment.sucursal_origen;
  if (branchInfo) {
    doc.text(branchInfo.direccion || '', margin + 30, y + 14);
    doc.text(`${branchInfo.ciudad || ''} ${branchInfo.telefono ? '• Tel: ' + branchInfo.telefono : ''}`, margin + 30, y + 18);
  }

  // Receipt number and date (right side)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(`Guía Nº: ${shipment.tracking_number}`, pageWidth - margin, y + 6, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const fecha = new Date(shipment.created_at).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(`Fecha: ${fecha}`, pageWidth - margin, y + 12, { align: 'right' });
  
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('DOCUMENTO NO VÁLIDO COMO FACTURA', pageWidth - margin, y + 18, { align: 'right' });

  y += 32;

  // Separator line
  doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ========== ORIGEN / DESTINO ==========
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(margin, y, contentWidth / 2 - 2, 8, 'F');
  doc.rect(margin + contentWidth / 2 + 2, y, contentWidth / 2 - 2, 8, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ORIGEN', margin + 4, y + 5.5);
  doc.text('DESTINO', margin + contentWidth / 2 + 6, y + 5.5);
  
  y += 10;
  
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const ciudadOrigen = shipment.sucursal_origen?.ciudad || shipment.ciudad_retiro || '-';
  const ciudadDestino = shipment.sucursal_destino?.ciudad || shipment.ciudad_entrega || '-';
  doc.text(ciudadOrigen, margin + 4, y + 4);
  doc.text(ciudadDestino, margin + contentWidth / 2 + 6, y + 4);
  
  y += 10;

  // ========== REMITENTE / DESTINATARIO ==========
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
    
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(x, boxY, boxWidth, 35);
    
    doc.setFillColor(245, 245, 245);
    doc.rect(x, boxY, boxWidth, 6, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(title, x + 3, boxY + 4);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.text(name || '-', x + 3, boxY + 12);
    
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Domicilio: ${address || '-'}`, x + 3, boxY + 18);
    doc.text(`Teléfono: ${phone || '-'}`, x + 3, boxY + 24);
    doc.text(`DNI/CUIT: ${dni || '-'}`, x + 3, boxY + 30);
  };

  const halfWidth = contentWidth / 2 - 3;
  
  const remitenteNombre = shipment.remitente 
    ? `${shipment.remitente.nombre} ${shipment.remitente.apellido || ''}` 
    : shipment.nombre_remitente || '-';
  const remitenteDir = shipment.remitente?.direccion || shipment.direccion_retiro || '-';
  const remitenteTel = shipment.remitente?.telefono || '-';
  const remitenteDni = shipment.dni_remitente || '-';

  const destNombre = shipment.destinatario 
    ? `${shipment.destinatario.nombre} ${shipment.destinatario.apellido || ''}` 
    : shipment.nombre_destinatario || '-';
  const destDir = shipment.destinatario?.direccion || shipment.direccion_entrega || '-';
  const destTel = shipment.destinatario?.telefono || shipment.whatsapp_destinatario || '-';
  const destDni = shipment.dni_destinatario || '-';

  drawPersonBox('REMITENTE', remitenteNombre, remitenteDir, remitenteTel, remitenteDni, margin, halfWidth);
  drawPersonBox('DESTINATARIO', destNombre, destDir, destTel, destDni, margin + halfWidth + 6, halfWidth);
  
  y += 40;

  // ========== CONDICIÓN DE VENTA ==========
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, contentWidth, 10);
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text(`Condición de Venta: ${TIPO_PAGO_LABELS[shipment.tipo_pago || 'contado'] || shipment.tipo_pago || 'Contado'}`, margin + 4, y + 6.5);
  
  y += 14;

  // ========== DESCRIPCIÓN PRODUCTO / CONCEPTOS ==========
  // Left column: Product details
  const leftColWidth = contentWidth * 0.5;
  const rightColWidth = contentWidth * 0.5;
  
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, leftColWidth - 2, 8, 'F');
  doc.rect(margin + leftColWidth + 2, y, rightColWidth - 2, 8, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('DESCRIPCIÓN DEL ENVÍO', margin + 4, y + 5.5);
  doc.text('CONCEPTOS', margin + leftColWidth + 6, y + 5.5);
  
  y += 10;
  
  const productBoxY = y;
  const productBoxHeight = 40;
  
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, productBoxY, leftColWidth - 2, productBoxHeight);
  doc.rect(margin + leftColWidth + 2, productBoxY, rightColWidth - 2, productBoxHeight);
  
  // Product details (left)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  
  let productY = productBoxY + 7;
  doc.text(`Bultos: ${shipment.cantidad_bultos || 1}`, margin + 4, productY);
  productY += 6;
  
  if (shipment.descripcion) {
    const desc = shipment.descripcion.substring(0, 50) + (shipment.descripcion.length > 50 ? '...' : '');
    doc.text(`Descripción: ${desc}`, margin + 4, productY);
    productY += 6;
  }
  
  if (shipment.peso_kg) {
    doc.text(`Peso: ${shipment.peso_kg} kg`, margin + 4, productY);
    productY += 6;
  }
  
  if (shipment.valor_declarado) {
    doc.text(`Valor Declarado: ${formatCurrency(shipment.valor_declarado)}`, margin + 4, productY);
  }
  
  // Concepts (right)
  let conceptY = productBoxY + 7;
  const conceptX = margin + leftColWidth + 6;
  
  // Calculate flete (total minus additional concepts)
  const totalConceptos = detalles.reduce((sum, d) => sum + (d.monto || 0), 0);
  const flete = shipment.precio_total - totalConceptos;
  
  doc.text('Flete:', conceptX, conceptY);
  doc.text(formatCurrency(flete > 0 ? flete : shipment.precio_total), conceptX + rightColWidth - 30, conceptY, { align: 'right' });
  conceptY += 6;
  
  // Additional concepts from detalles
  for (const detalle of detalles.slice(0, 4)) {
    doc.text(`${detalle.nombre_concepto}:`, conceptX, conceptY);
    doc.text(formatCurrency(detalle.monto), conceptX + rightColWidth - 30, conceptY, { align: 'right' });
    conceptY += 6;
  }
  
  y += productBoxHeight + 4;
  
  // ========== QR CODE + TOTAL ==========
  const qrBoxHeight = 45;
  
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, contentWidth, qrBoxHeight);
  
  // QR Code (left)
  if (qrCodeBase64) {
    try {
      doc.addImage(qrCodeBase64, 'PNG', margin + 5, y + 5, 35, 35);
    } catch (e) {
      // Continue without QR
    }
  }
  
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Escanear para tracking', margin + 5, y + 43);
  
  // Total (right)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('TOTAL:', pageWidth - margin - 50, y + 20);
  
  doc.setFontSize(16);
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(formatCurrency(shipment.precio_total), pageWidth - margin - 5, y + 20, { align: 'right' });
  
  y += qrBoxHeight + 6;

  // ========== FIRMAS ==========
  const signatureBoxHeight = 35;
  
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, halfWidth, signatureBoxHeight);
  doc.rect(margin + halfWidth + 6, y, halfWidth, signatureBoxHeight);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('REMITENTE', margin + halfWidth / 2, y + 5, { align: 'center' });
  doc.text('DESTINATARIO', margin + halfWidth + 6 + halfWidth / 2, y + 5, { align: 'center' });
  
  // Signature lines
  doc.setLineWidth(0.2);
  doc.setDrawColor(150, 150, 150);
  
  // Remitente
  doc.line(margin + 5, y + 20, margin + halfWidth - 5, y + 20);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('FIRMA Y ACLARACIÓN', margin + halfWidth / 2, y + 24, { align: 'center' });
  doc.line(margin + 5, y + 30, margin + halfWidth - 5, y + 30);
  doc.text('DNI', margin + halfWidth / 2, y + 34, { align: 'center' });
  
  // Destinatario  
  doc.line(margin + halfWidth + 11, y + 20, margin + halfWidth + halfWidth + 1, y + 20);
  doc.text('FIRMA Y ACLARACIÓN', margin + halfWidth + 6 + halfWidth / 2, y + 24, { align: 'center' });
  doc.line(margin + halfWidth + 11, y + 30, margin + halfWidth + 6 + halfWidth / 3 - 5, y + 30);
  doc.line(margin + halfWidth + 6 + halfWidth / 3 + 5, y + 30, margin + halfWidth + halfWidth + 1, y + 30);
  doc.text('DNI', margin + halfWidth + 6 + halfWidth / 6, y + 34, { align: 'center' });
  doc.text('FECHA', margin + halfWidth + 6 + halfWidth * 0.75, y + 34, { align: 'center' });
  
  y += signatureBoxHeight + 6;

  // ========== OBSERVACIONES ==========
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, contentWidth, 25);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('OBSERVACIONES:', margin + 4, y + 5);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  
  const observaciones = shipment.notas || '';
  doc.text(observaciones.substring(0, 100), margin + 4, y + 11);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text('Declaro que esta encomienda no contiene dinero en efectivo, cheques ni valores negociables.', margin + 4, y + 18);
  doc.text('El remitente acepta los términos y condiciones del servicio de transporte.', margin + 4, y + 22);
  
  y += 28;

  // ========== COPY TYPE BADGE ==========
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  const copyLabel = copyType === 'agencia' ? 'COPIA AGENCIA' : 'COPIA CLIENTE';
  const badgeWidth = 35;
  doc.rect(pageWidth - margin - badgeWidth, y, badgeWidth, 8, 'F');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(copyLabel, pageWidth - margin - badgeWidth / 2, y + 5.5, { align: 'center' });

  // Save PDF
  doc.save(`Comprobante_${shipment.tracking_number}_${copyType}.pdf`);
}
