import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Envio {
  id: string;
  tracking_number: string;
  estado: string;
  precio_total: number;
  pago_contra_entrega: boolean;
  fecha_entrega: string | null;
  fecha_recogida: string | null;
  created_at: string | null;
  direccion_entrega: string | null;
  ciudad_entrega: string | null;
  direccion_retiro: string | null;
  ciudad_retiro: string | null;
  descripcion: string | null;
  peso_kg: number | null;
  cantidad_bultos: number | null;
  dimensiones: string | null;
  notas: string | null;
  foto_entrega: string | null;
  firma_destinatario: string | null;
  entrega_lat: number | null;
  entrega_lng: number | null;
  tipo_pago: string | null;
  valor_declarado: number | null;
  remitente?: {
    nombre: string;
    apellido: string | null;
    telefono: string;
    direccion: string;
    ciudad: string | null;
  } | null;
  destinatario?: {
    nombre: string;
    apellido: string | null;
    telefono: string;
    direccion: string;
    ciudad: string | null;
  } | null;
  sucursal_origen?: {
    nombre: string;
    codigo: string | null;
    direccion: string;
    ciudad: string | null;
  } | null;
  sucursal_destino?: {
    nombre: string;
    codigo: string | null;
    direccion: string;
    ciudad: string | null;
  } | null;
}

interface HistorialItem {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  created_at: string | null;
  notas: string | null;
  ubicacion: string | null;
}

interface Incidente {
  id: string;
  tipo: string;
  estado: string;
  descripcion: string | null;
  resolucion: string | null;
  created_at: string;
  foto_evidencia: string | null;
}

// Helper to sanitize text for jsPDF (removes emojis and normalizes accents)
const sanitizeText = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .replace(/á/g, 'a').replace(/Á/g, 'A')
    .replace(/é/g, 'e').replace(/É/g, 'E')
    .replace(/í/g, 'i').replace(/Í/g, 'I')
    .replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ú/g, 'u').replace(/Ú/g, 'U')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/[^\x00-\x7F]/g, ''); // Remove any remaining non-ASCII chars
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  recogido: 'Recogido',
  en_bodega: 'En Bodega',
  en_transito: 'En Transito',
  en_reparto: 'En Reparto',
  entregado: 'Entregado',
  devuelto: 'Devuelto',
  cancelado: 'Cancelado',
};

const TIPO_PAGO_LABELS: Record<string, string> = {
  contado: 'Contado',
  destino: 'Pago en Destino',
  cuenta_corriente: 'Cuenta Corriente',
};

// Helper to load image as base64
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
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

export async function generateEPODPDF(
  envio: Envio,
  historial: HistorialItem[] = [],
  incidentes: Incidente[] = []
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Load images in parallel
  const [photoBase64, signatureBase64] = await Promise.all([
    envio.foto_entrega ? loadImageAsBase64(envio.foto_entrega) : Promise.resolve(null),
    envio.firma_destinatario ? loadImageAsBase64(envio.firma_destinatario) : Promise.resolve(null),
  ]);

  // Helper function to add page number
  const addPageNumber = () => {
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(
      `Generado: ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  };

  // Helper function to check if we need a new page
  const checkNewPage = (neededHeight: number): boolean => {
    if (yPosition + neededHeight > pageHeight - 25) {
      addPageNumber();
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // ===== HEADER =====
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROBANTE DE ENTREGA', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Prueba Electrónica de Entrega (EPOD)', pageWidth / 2, 22, { align: 'center' });

  // Tracking number prominent
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 28, contentWidth, 12, 2, 2, 'F');
  doc.setTextColor(59, 130, 246);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`TRACKING: ${envio.tracking_number}`, pageWidth / 2, 36, { align: 'center' });

  yPosition = 48;

  // ===== STATUS BANNER =====
  const isDelivered = envio.estado === 'entregado';
  const statusLabel = STATUS_LABELS[envio.estado] || envio.estado;
  
  if (isDelivered) {
    doc.setFillColor(34, 197, 94); // Green
  } else if (envio.estado === 'cancelado' || envio.estado === 'devuelto') {
    doc.setFillColor(239, 68, 68); // Red
  } else {
    doc.setFillColor(234, 179, 8); // Yellow
  }
  
  doc.roundedRect(margin, yPosition, contentWidth, 20, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Estado: ${statusLabel.toUpperCase()}`, pageWidth / 2, yPosition + 9, { align: 'center' });
  
  if (envio.fecha_entrega) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Entregado: ${format(new Date(envio.fecha_entrega), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}`,
      pageWidth / 2,
      yPosition + 16,
      { align: 'center' }
    );
  }

  yPosition += 28;

  // ===== GEOLOCATION =====
  if (envio.entrega_lat && envio.entrega_lng) {
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(margin, yPosition, contentWidth, 14, 2, 2, 'F');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('[GPS] Ubicacion:', margin + 4, yPosition + 6);
    
    doc.setFont('helvetica', 'normal');
    const coords = `${envio.entrega_lat.toFixed(6)}, ${envio.entrega_lng.toFixed(6)}`;
    doc.text(coords, margin + 40, yPosition + 6);
    
    doc.setTextColor(59, 130, 246);
    const mapsUrl = `maps.google.com/?q=${envio.entrega_lat},${envio.entrega_lng}`;
    doc.text(mapsUrl, margin + 4, yPosition + 12);
    
    yPosition += 20;
  }

  // ===== SENDER & RECIPIENT =====
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('REMITENTE', margin, yPosition);
  doc.text('DESTINATARIO', pageWidth / 2 + 5, yPosition);
  yPosition += 5;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth / 2 - 5, yPosition);
  doc.line(pageWidth / 2 + 5, yPosition, pageWidth - margin, yPosition);
  yPosition += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  // Sender
  const senderName = envio.remitente 
    ? sanitizeText(`${envio.remitente.nombre} ${envio.remitente.apellido || ''}`.trim())
    : 'No especificado';
  const senderAddress = envio.remitente
    ? sanitizeText(`${envio.remitente.direccion}${envio.remitente.ciudad ? `, ${envio.remitente.ciudad}` : ''}`)
    : sanitizeText(envio.direccion_retiro || '');
  const senderPhone = envio.remitente?.telefono || '';

  doc.text(senderName, margin, yPosition);
  if (senderAddress) {
    const wrappedAddress = doc.splitTextToSize(senderAddress, contentWidth / 2 - 10);
    wrappedAddress.forEach((line: string, i: number) => {
      doc.text(line, margin, yPosition + 5 + (i * 4));
    });
  }
  if (senderPhone) {
    doc.text(`Tel: ${senderPhone}`, margin, yPosition + 15);
  }

  // Recipient
  const recipientName = envio.destinatario
    ? sanitizeText(`${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}`.trim())
    : 'No especificado';
  const recipientAddress = envio.destinatario
    ? sanitizeText(`${envio.destinatario.direccion}${envio.destinatario.ciudad ? `, ${envio.destinatario.ciudad}` : ''}`)
    : sanitizeText(envio.direccion_entrega || '');
  const recipientPhone = envio.destinatario?.telefono || '';

  doc.text(recipientName, pageWidth / 2 + 5, yPosition);
  if (recipientAddress) {
    const wrappedAddress = doc.splitTextToSize(recipientAddress, contentWidth / 2 - 10);
    wrappedAddress.forEach((line: string, i: number) => {
      doc.text(line, pageWidth / 2 + 5, yPosition + 5 + (i * 4));
    });
  }
  if (recipientPhone) {
    doc.text(`Tel: ${recipientPhone}`, pageWidth / 2 + 5, yPosition + 15);
  }

  yPosition += 25;

  // ===== PACKAGE INFO =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('INFORMACIÓN DEL ENVÍO', margin, yPosition);
  yPosition += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const infoCol1 = [
    `Bultos: ${envio.cantidad_bultos || 1}`,
    `Peso: ${envio.peso_kg ? `${envio.peso_kg} kg` : '-'}`,
    `Dimensiones: ${envio.dimensiones || '-'}`,
  ];

  const infoCol2 = [
    `Total: $${envio.precio_total?.toLocaleString('es-AR') || '0'}`,
    `Tipo Pago: ${TIPO_PAGO_LABELS[envio.tipo_pago || 'contado'] || envio.tipo_pago || 'Contado'}`,
    `Contra Entrega: ${envio.pago_contra_entrega ? 'Sí' : 'No'}`,
  ];

  infoCol1.forEach((text, i) => {
    doc.text(text, margin, yPosition + (i * 5));
  });

  infoCol2.forEach((text, i) => {
    doc.text(text, pageWidth / 2, yPosition + (i * 5));
  });

  yPosition += 18;

  if (envio.descripcion) {
    doc.text(`Descripcion: ${sanitizeText(envio.descripcion)}`, margin, yPosition);
    yPosition += 6;
  }

  // ===== EVIDENCE SECTION =====
  checkNewPage(70);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('EVIDENCIA DE ENTREGA', margin, yPosition);
  yPosition += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  const evidenceStartY = yPosition;
  const halfWidth = contentWidth / 2 - 5;

  // Photo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Foto de Entrega', margin, yPosition);
  yPosition += 3;

  if (photoBase64) {
    try {
      doc.addImage(photoBase64, 'JPEG', margin, yPosition, halfWidth, 45);
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('Foto no disponible', margin, yPosition + 20);
    }
  } else {
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPosition, halfWidth, 45, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Sin foto de entrega', margin + halfWidth / 2, yPosition + 22, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  // Signature
  let signatureY = evidenceStartY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Firma del Destinatario', pageWidth / 2 + 5, signatureY);
  signatureY += 3;

  if (signatureBase64) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.rect(pageWidth / 2 + 5, signatureY, halfWidth, 45, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(pageWidth / 2 + 5, signatureY, halfWidth, 45, 'S');
      doc.addImage(signatureBase64, 'PNG', pageWidth / 2 + 8, signatureY + 2, halfWidth - 6, 41);
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('Firma no disponible', pageWidth / 2 + 5 + halfWidth / 2, signatureY + 22, { align: 'center' });
    }
  } else {
    doc.setFillColor(245, 245, 245);
    doc.rect(pageWidth / 2 + 5, signatureY, halfWidth, 45, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Sin firma registrada', pageWidth / 2 + 5 + halfWidth / 2, signatureY + 22, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  yPosition = evidenceStartY + 55;

  // ===== HISTORY =====
  if (historial.length > 0) {
    checkNewPage(30);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('HISTORIAL DE ESTADOS', margin, yPosition);
    yPosition += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    // Sort by date ascending
    const sortedHistorial = [...historial].sort((a, b) => 
      new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );

    sortedHistorial.forEach((item, index) => {
      if (checkNewPage(12)) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('HISTORIAL DE ESTADOS (continuación)', margin, yPosition);
        yPosition += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
      }

      const isLast = index === sortedHistorial.length - 1;
      const statusLabel = STATUS_LABELS[item.estado_nuevo] || item.estado_nuevo;
      const dateStr = item.created_at 
        ? format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: es })
        : '';

      // Timeline dot
      if (isLast) {
        doc.setFillColor(34, 197, 94);
      } else {
        doc.setFillColor(59, 130, 246);
      }
      doc.circle(margin + 3, yPosition, 2, 'F');

      // Timeline line
      if (!isLast) {
        doc.setDrawColor(200, 200, 200);
        doc.line(margin + 3, yPosition + 3, margin + 3, yPosition + 10);
      }

      doc.text(`${dateStr}  -  ${statusLabel}`, margin + 10, yPosition + 1);
      
      if (item.ubicacion) {
        doc.setTextColor(128, 128, 128);
        doc.text(`   Ubicacion: ${sanitizeText(item.ubicacion)}`, margin + 10, yPosition + 5);
        doc.setTextColor(0, 0, 0);
        yPosition += 4;
      }

      yPosition += 8;
    });
  }

  // ===== INCIDENTS =====
  if (incidentes.length > 0) {
    checkNewPage(30);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('INCIDENTES REPORTADOS', margin, yPosition);
    yPosition += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    incidentes.forEach((incidente) => {
      checkNewPage(20);

      doc.setFillColor(255, 243, 224);
      doc.roundedRect(margin, yPosition, contentWidth, 15, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(194, 65, 12);
      doc.text(incidente.tipo, margin + 4, yPosition + 5);

      doc.setTextColor(128, 128, 128);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(
        format(new Date(incidente.created_at), "dd/MM/yy", { locale: es }),
        pageWidth - margin - 4,
        yPosition + 5,
        { align: 'right' }
      );

      doc.setTextColor(0, 0, 0);
      if (incidente.descripcion) {
        const wrapped = doc.splitTextToSize(sanitizeText(incidente.descripcion), contentWidth - 8);
        doc.text(wrapped[0] || '', margin + 4, yPosition + 11);
      }

      yPosition += 20;
    });
  }

  // ===== FOOTER =====
  checkNewPage(25);
  yPosition = pageHeight - 35;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 5;

  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Este documento constituye prueba electrónica de la operación logística.',
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  yPosition += 4;
  doc.text(
    'Las coordenadas GPS y la firma digital garantizan la autenticidad de la entrega.',
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );

  // Add page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageNumber();
  }

  // Download
  doc.save(`epod-${envio.tracking_number}.pdf`);
}
