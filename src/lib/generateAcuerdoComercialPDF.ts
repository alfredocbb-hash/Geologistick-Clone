import { jsPDF } from 'jspdf';
import { loadLogoAsBase64, drawCoverPage, addPageHeader, addPageFooter } from './pdfHelpers';

interface AcuerdoComercialParams {
  tenantName: string;
  planName: string;
  planDescription?: string;
  priceMonthly: number;
  maxUsers: number;
  maxBranches: number;
  maxShipmentsMonth: number;
  features: string[];
}

export async function generateAcuerdoComercialPDF(params: AcuerdoComercialParams) {
  const {
    tenantName, planName, planDescription, priceMonthly,
    maxUsers, maxBranches, maxShipmentsMonth, features,
  } = params;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const logoBase64 = await loadLogoAsBase64();
  const primaryColor: [number, number, number] = [59, 130, 246];

  const generatedDate = new Date().toLocaleDateString('es-AR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // ── Page 1: Cover ──
  drawCoverPage(
    doc, logoBase64,
    'GeoLogistick', 'Plataforma de Logística Inteligente',
    'Acuerdo Comercial de Servicio',
    tenantName || 'Plantilla Genérica',
    pageWidth, primaryColor,
  );

  // ── Page 2: Contract body ──
  doc.addPage();
  addPageHeader(doc, logoBase64, 'Acuerdo Comercial de Servicio', pageWidth, margin);

  let y = 30;

  const sectionTitle = (title: string) => {
    y += 6;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(title, margin, y);
    y += 2;
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.4);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;
  };

  const bodyText = (text: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 2;
  };

  const labelValue = (label: string, value: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(label + ':', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + doc.getTextWidth(label + ': ') + 1, y);
    y += 6;
  };

  // 1. Parties
  sectionTitle('1. Partes');
  bodyText(
    `El presente acuerdo se celebra entre GeoLogistick (en adelante "El Proveedor") y ${tenantName || '[Nombre de la Empresa]'} (en adelante "El Cliente").`,
  );

  // 2. Plan details
  sectionTitle('2. Plan Contratado');
  labelValue('Plan', planName);
  if (planDescription) labelValue('Descripción', planDescription);
  labelValue('Precio Mensual', `US$ ${priceMonthly.toLocaleString('es-AR')}`);
  labelValue('Máx. Usuarios', maxUsers === -1 ? 'Ilimitado' : String(maxUsers));
  labelValue('Máx. Sucursales', maxBranches === -1 ? 'Ilimitado' : String(maxBranches));
  labelValue('Máx. Envíos/Mes', maxShipmentsMonth === -1 ? 'Ilimitado' : String(maxShipmentsMonth));

  // 3. Features
  if (features.length > 0) {
    sectionTitle('3. Funcionalidades Incluidas');
    features.forEach(f => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.text(`•  ${f}`, margin + 2, y);
      y += 5;
    });
    y += 2;
  }

  // 4. Payment terms
  sectionTitle(features.length > 0 ? '4. Condiciones de Pago' : '3. Condiciones de Pago');
  bodyText(
    'El pago del servicio deberá realizarse entre el 1 y el 10 de cada mes. ' +
    'El incumplimiento del pago dentro de dicho plazo podrá resultar en la suspensión temporal del servicio hasta la regularización de la cuenta.',
  );
  bodyText(
    'Los medios de pago aceptados son: transferencia bancaria, efectivo o Mercado Pago. ' +
    'El Proveedor emitirá un comprobante de pago por cada período abonado.',
  );

  // 5. General conditions
  const nextSection = features.length > 0 ? 5 : 4;
  sectionTitle(`${nextSection}. Vigencia y Cancelación`);
  bodyText(
    'El presente acuerdo tiene vigencia mensual renovable automáticamente. ' +
    'Cualquiera de las partes podrá solicitar la cancelación con un preaviso mínimo de 30 días.',
  );
  bodyText(
    'En caso de cancelación, el servicio permanecerá activo hasta la finalización del período ya abonado.',
  );

  // Check if we need a new page for signatures
  if (y > pageHeight - 80) {
    addPageFooter(doc, pageWidth, pageHeight, generatedDate);
    doc.addPage();
    addPageHeader(doc, logoBase64, 'Acuerdo Comercial de Servicio', pageWidth, margin);
    y = 30;
  }

  // Signatures
  sectionTitle(`${nextSection + 1}. Firma de las Partes`);
  y += 10;

  const signY = y;
  const col1 = margin;
  const col2 = pageWidth / 2 + 10;

  // Provider signature
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(col1, signY + 20, col1 + 60, signY + 20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('El Proveedor', col1, signY + 26);
  doc.text('GeoLogistick', col1, signY + 32);

  // Client signature
  doc.line(col2, signY + 20, col2 + 60, signY + 20);
  doc.text('El Cliente', col2, signY + 26);
  doc.text(tenantName || '[Nombre de la Empresa]', col2, signY + 32);

  y = signY + 40;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Fecha: ______ / ______ / ________`, margin, y);

  addPageFooter(doc, pageWidth, pageHeight, generatedDate);

  // Save
  const fileName = tenantName
    ? `Acuerdo_Comercial_${tenantName.replace(/\s+/g, '_')}.pdf`
    : 'Acuerdo_Comercial_Plantilla.pdf';
  doc.save(fileName);
}
