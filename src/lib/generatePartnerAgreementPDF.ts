import { jsPDF } from 'jspdf';
import { loadLogoAsBase64, addPageHeader, addPageFooter, drawCoverPage } from './pdfHelpers';

interface PartnerComision {
  concepto_nombre: string;
  porcentaje_contado: number;
  porcentaje_destino: number;
  porcentaje_cta_cte: number;
}

interface PartnerAgreementData {
  empresaA: string;
  empresaB: string;
  fecha: string;
  notas?: string;
  comisiones: PartnerComision[];
}

export async function generatePartnerAgreementPDF(data: PartnerAgreementData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const logoBase64 = await loadLogoAsBase64();
  const primaryColor: [number, number, number] = [59, 130, 246];

  // Cover page
  drawCoverPage(
    doc, logoBase64,
    'Geologistick', 'Plataforma de Logística',
    'Acuerdo de Alianza Comercial',
    `${data.empresaA} — ${data.empresaB}`,
    pageWidth, primaryColor
  );

  // Page 2 - Agreement content
  doc.addPage();
  addPageHeader(doc, logoBase64, 'Acuerdo de Alianza Comercial', pageWidth, margin);
  let y = 28;

  const sectionTitle = (text: string) => {
    y += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(text, margin, y);
    y += 2;
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;
  };

  const bodyText = (text: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5;
  };

  // Parties
  sectionTitle('1. PARTES');
  bodyText(`El presente acuerdo se celebra entre las siguientes empresas:`);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.text(`• Empresa A: ${data.empresaA}`, margin + 4, y); y += 6;
  doc.text(`• Empresa B: ${data.empresaB}`, margin + 4, y); y += 8;
  doc.setFont('helvetica', 'normal');

  // Object
  sectionTitle('2. OBJETO');
  bodyText(
    'Ambas partes acuerdan establecer una alianza comercial para la derivación mutua de envíos, ' +
    'permitiendo ampliar la cobertura geográfica y mejorar la calidad del servicio logístico ofrecido a sus clientes.'
  );
  y += 4;

  // Commissions table
  sectionTitle('3. COMISIONES ACORDADAS');
  if (data.comisiones.length > 0) {
    bodyText('Las siguientes comisiones se aplicarán por concepto de tarifa para cada envío derivado:');
    y += 4;

    // Table header
    const colWidths = [contentWidth * 0.4, contentWidth * 0.2, contentWidth * 0.2, contentWidth * 0.2];
    const colX = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], margin + colWidths[0] + colWidths[1] + colWidths[2]];
    const rowH = 8;

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(margin, y - 1, contentWidth, rowH, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Concepto', colX[0] + 2, y + 5);
    doc.text('% Contado', colX[1] + 2, y + 5);
    doc.text('% Destino', colX[2] + 2, y + 5);
    doc.text('% Cta Cte', colX[3] + 2, y + 5);
    y += rowH;

    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    data.comisiones.forEach((c, i) => {
      if (y > pageHeight - 40) {
        doc.addPage();
        addPageHeader(doc, logoBase64, 'Acuerdo de Alianza Comercial', pageWidth, margin);
        y = 32;
      }
      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y - 1, contentWidth, rowH, 'F');
      }
      doc.text(c.concepto_nombre, colX[0] + 2, y + 5);
      doc.text(`${c.porcentaje_contado}%`, colX[1] + 2, y + 5);
      doc.text(`${c.porcentaje_destino}%`, colX[2] + 2, y + 5);
      doc.text(`${c.porcentaje_cta_cte}%`, colX[3] + 2, y + 5);
      y += rowH;
    });
    // Table border
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(margin, y - rowH * data.comisiones.length - rowH - 1, contentWidth, rowH * (data.comisiones.length + 1) + 1);
  } else {
    bodyText('No se han definido comisiones específicas por concepto.');
  }
  y += 8;

  // Derivation clause
  if (y > pageHeight - 80) {
    doc.addPage();
    addPageHeader(doc, logoBase64, 'Acuerdo de Alianza Comercial', pageWidth, margin);
    y = 32;
  }
  sectionTitle('4. DERIVACIÓN DE ENVÍOS');
  bodyText(
    'Cada parte podrá derivar envíos a la otra parte cuando la zona de entrega corresponda a la cobertura del partner. ' +
    'La empresa que recibe el envío derivado será responsable de la entrega al destinatario final y de la ' +
    'liquidación correspondiente según las comisiones acordadas.'
  );
  y += 4;

  // General conditions
  sectionTitle('5. CONDICIONES GENERALES');
  bodyText(
    '• El presente acuerdo tiene vigencia indefinida y puede ser cancelado por cualquiera de las partes con un preaviso de 30 días.\n' +
    '• Las liquidaciones de comisiones se realizarán de forma mensual.\n' +
    '• Ambas partes se comprometen a mantener la confidencialidad de los datos de los clientes.\n' +
    '• Las modificaciones a este acuerdo deberán ser aceptadas por ambas partes.'
  );
  y += 4;

  if (data.notas) {
    sectionTitle('6. NOTAS ADICIONALES');
    bodyText(data.notas);
    y += 4;
  }

  // Signatures
  if (y > pageHeight - 60) {
    doc.addPage();
    addPageHeader(doc, logoBase64, 'Acuerdo de Alianza Comercial', pageWidth, margin);
    y = 32;
  }
  y += 12;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('Firmas', pageWidth / 2, y, { align: 'center' });
  y += 20;

  const sigWidth = (contentWidth - 20) / 2;
  // Left signature
  doc.setLineWidth(0.5);
  doc.setDrawColor(150, 150, 150);
  doc.line(margin, y, margin + sigWidth, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(data.empresaA, margin, y + 6);
  doc.text(`Fecha: ${data.fecha}`, margin, y + 12);

  // Right signature
  doc.line(margin + sigWidth + 20, y, margin + sigWidth * 2 + 20, y);
  doc.text(data.empresaB, margin + sigWidth + 20, y + 6);
  doc.text(`Fecha: ${data.fecha}`, margin + sigWidth + 20, y + 12);

  // Add footers
  const totalPages = doc.getNumberOfPages();
  const genDate = new Date().toLocaleDateString('es-AR');
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, pageWidth, pageHeight, genDate);
  }

  doc.save(`Acuerdo_Alianza_${data.empresaA}_${data.empresaB}.pdf`);
}
