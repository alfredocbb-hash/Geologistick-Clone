import { jsPDF } from 'jspdf';
import { drawCoverPage, addPageHeader, addPageFooter } from './pdfHelpers';

interface FlexGuideOptions {
  tenantName: string;
  logoUrl: string | null;
  primaryColor: string; // hex
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}

export async function generateFlexGuidePDF(options: FlexGuideOptions) {
  const { tenantName, logoUrl, primaryColor } = options;
  const color = hexToRgb(primaryColor || '#EAB308');
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const title = 'Guía Operativa Envíos Flex';
  const generatedDate = new Date().toLocaleDateString('es-AR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Load tenant logo
  let logoBase64: string | null = null;
  if (logoUrl) {
    logoBase64 = await loadImageAsBase64(logoUrl);
  }

  // ── Cover Page ──
  drawCoverPage(doc, logoBase64, tenantName, 'Sistema de Logística', title, 'Mercado Libre Flex', pageWidth, color);

  // ── Section 1: Onboarding ──
  doc.addPage();
  addPageHeader(doc, logoBase64, title, pageWidth, margin);

  let y = 30;

  // Section title
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(margin, y, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Proceso de Onboarding (Alta de Servicio)', margin + 4, y + 7);
  y += 16;

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const onboardingIntro = 'Para comenzar la gestión de tus envíos:';
  doc.text(onboardingIntro, margin, y);
  y += 10;

  const onboardingSteps = [
    { title: 'Apertura de Cuenta', desc: 'Generamos tu usuario en nuestro sistema.' },
    { title: 'Sincronización', desc: 'Te enviaremos dos (2) links de sincronización.' },
    { title: 'Autorización', desc: 'Una vez que autorices ambos links, nuestro sistema queda vinculado con tus ventas de Mercado Libre y estamos listos para operar.' },
  ];

  for (const step of onboardingSteps) {
    doc.setFont('helvetica', 'bold');
    doc.text(`• ${step.title}:`, margin + 4, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(step.desc, contentWidth - 10);
    doc.text(lines, margin + 8, y + 6);
    y += 6 + lines.length * 6 + 4;
  }

  // ── Section 2: Horarios y Logística ──
  y += 6;
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(margin, y, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Horarios y Logística de Retiro', margin + 4, y + 7);
  y += 16;

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const logisticItems = [
    { title: 'Horario de Corte', desc: 'El horario límite para recibir ventas que se entregan en el mismo día es a las 12:00 hs.' },
    { title: 'Rango de Retiro', desc: 'Nuestro equipo pasará por tu domicilio/depósito entre las 12:10 hs y las 13:00 hs.' },
    { title: 'Condición de Retiro sin Costo', desc: 'El retiro es bonificado (gratis) a partir de una base mínima de 5 pedidos en adelante. (Consultar costo de retiro por menos de 5 paquetes).' },
  ];

  for (const item of logisticItems) {
    doc.setFont('helvetica', 'bold');
    doc.text(`• ${item.title}:`, margin + 4, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(item.desc, contentWidth - 10);
    doc.text(lines, margin + 8, y + 6);
    y += 6 + lines.length * 6 + 4;
  }

  // ── Section 3: Tarifario ──
  y += 6;
  if (y > pageHeight - 80) {
    doc.addPage();
    addPageHeader(doc, logoBase64, title, pageWidth, margin);
    y = 30;
  }

  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(margin, y, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Tarifario Vigente (Mercado Libre Flex)', margin + 4, y + 7);
  y += 16;

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('Los valores corresponden a las tarifas oficiales hasta la próxima actualización.', margin, y);
  y += 10;

  // Table
  const colWidths = [35, 70, 65];
  const headers = ['Zona', 'Alcance', 'Tarifa por Envío'];
  const rows = [
    ['Zona 1', 'Berazategui (Local)', '$4,610.99'],
    ['Zona 2', 'Quilmes y Florencio Varela (Cercana)', '$7,370.99'],
    ['Zona 3', 'CABA y Alrededores (Lejana)', '$10,245.99'],
  ];

  const rowHeight = 10;
  let tableX = margin;

  // Header row
  doc.setFillColor(color[0], color[1], color[2]);
  for (let i = 0; i < headers.length; i++) {
    doc.rect(tableX, y, colWidths[i], rowHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(headers[i], tableX + 3, y + 7);
    tableX += colWidths[i];
  }
  y += rowHeight;

  // Data rows
  for (let r = 0; r < rows.length; r++) {
    tableX = margin;
    const bg = r % 2 === 0 ? 245 : 255;
    for (let c = 0; c < rows[r].length; c++) {
      doc.setFillColor(bg, bg, bg);
      doc.rect(tableX, y, colWidths[c], rowHeight, 'FD');
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      doc.setFont('helvetica', c === 2 ? 'bold' : 'normal');
      doc.text(rows[r][c], tableX + 3, y + 7);
      tableX += colWidths[c];
    }
    y += rowHeight;
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, pageWidth, pageHeight, generatedDate);
  }

  doc.save(`${tenantName}-Guia-Flex.pdf`);
}
