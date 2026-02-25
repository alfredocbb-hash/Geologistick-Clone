import { jsPDF } from 'jspdf';
import { loadLogoAsBase64, drawCoverPage, addPageHeader, addPageFooter } from './pdfHelpers';

interface FlexTermsBranding {
  tenantName: string;
  logoUrl: string | null;
  primaryColor: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [59, 130, 246];
}

async function loadTenantLogoAsBase64(url: string): Promise<string | null> {
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 200;
        canvas.height = img.naturalHeight || 200;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch {
    return null;
  }
}

export async function generateFlexTermsPDF(branding: FlexTermsBranding) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const primaryColor = hexToRgb(branding.primaryColor);

  // Load logo
  let logoBase64: string | null = null;
  if (branding.logoUrl) {
    logoBase64 = await loadTenantLogoAsBase64(branding.logoUrl);
  }
  if (!logoBase64) {
    logoBase64 = await loadLogoAsBase64();
  }

  const generatedDate = new Date().toLocaleDateString('es-AR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const docTitle = `${branding.tenantName} - Términos y Condiciones Flex`;

  // Cover page
  drawCoverPage(
    doc, logoBase64, branding.tenantName,
    'Velocidad y confianza en cada entrega.',
    'Términos y Condiciones',
    'Servicio de Logística Flex',
    pageWidth, primaryColor
  );

  // Helper to add a new page with header/footer
  const startNewPage = () => {
    doc.addPage();
    addPageHeader(doc, logoBase64, docTitle, pageWidth, margin);
    return 28; // y start after header
  };

  let y = startNewPage();

  // Section title helper
  const drawSectionTitle = (title: string) => {
    if (y > pageHeight - 40) y = startNewPage();
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(margin, y - 5, contentWidth, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 4, y + 1.5);
    y += 12;
    doc.setTextColor(50, 50, 50);
  };

  // Subsection helper
  const drawSubsection = (label: string) => {
    if (y > pageHeight - 30) y = startNewPage();
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(label, margin, y);
    y += 6;
    doc.setTextColor(50, 50, 50);
  };

  // Paragraph helper
  const drawParagraph = (text: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      if (y > pageHeight - 20) {
        addPageFooter(doc, pageWidth, pageHeight, generatedDate);
        y = startNewPage();
      }
      doc.text(line, margin, y);
      y += 5;
    }
    y += 3;
  };

  // --- Introduction ---
  drawParagraph(
    `El presente documento establece las condiciones comerciales y operativas que rigen la prestación de servicios de logística y distribución de paquetería "Mercado Envíos Flex" por parte de ${branding.tenantName} al cliente solicitante (en adelante, "El Vendedor").`
  );
  drawParagraph('Al utilizar nuestros servicios, El Vendedor acepta los siguientes términos:');

  // --- Section 1 ---
  drawSectionTitle('1. Tarifas y Facturación');

  drawSubsection('1.1. Precios Netos:');
  drawParagraph(
    `Todas las tarifas cotizadas e informadas por ${branding.tenantName} para los servicios de envíos Flex son valores netos, es decir, no incluyen el Impuesto al Valor Agregado (IVA).`
  );

  drawSubsection('1.2. Facturación:');
  drawParagraph(
    'En caso de que El Vendedor solicite la emisión de factura (Tipo A o B) por los servicios prestados, se adicionará automáticamente la alícuota del 21% (veintiuno por ciento) correspondiente al IVA sobre el valor total del servicio liquidado.'
  );

  // --- Section 2 ---
  drawSectionTitle('2. Operatoria de Entregas y Visitas');

  drawParagraph(
    'Con el objetivo de garantizar la eficiencia en la distribución y cumplir con los estándares de Mercado Libre, se establece el siguiente esquema de visitas:'
  );

  drawSubsection('2.1. Primer y Segundo Intento:');
  drawParagraph(
    `El servicio contratado incluye hasta dos (2) intentos de visita al domicilio del destinatario final sin costo adicional para El Vendedor. Si el primer intento resulta fallido (por ausencia del destinatario, dirección incorrecta, etc.), ${branding.tenantName} realizará una segunda visita dentro del circuito logístico habitual.`
  );

  drawSubsection('2.2. Tercer Intento (Costo Adicional):');
  drawParagraph(
    'Si tras realizar los dos intentos mencionados el paquete no pudiera ser entregado, cualquier gestión posterior, incluyendo una tercera visita, será considerada como un nuevo envío y se cobrará la tarifa completa vigente para la zona correspondiente.'
  );

  // --- Section 3 ---
  drawSectionTitle('3. Liquidaciones y Términos de Pago');

  drawSubsection('3.1. Frecuencia de Liquidación:');
  drawParagraph(
    `${branding.tenantName} realizará el cierre de cuentas y emitirá el resumen de los envíos realizados (liquidación) de manera semanal. Dicho resumen será enviado al Vendedor por los canales de comunicación acordados (WhatsApp o correo electrónico).`
  );

  drawSubsection('3.2. Plazo de Pago:');
  drawParagraph(
    'El Vendedor dispone de un plazo máximo de 48 horas hábiles desde la recepción de la liquidación semanal para efectuar el pago total del saldo adeudado.'
  );

  drawSubsection('3.3. Mora e Intereses:');
  drawParagraph(
    `En caso de no acreditarse el pago dentro del plazo estipulado de 48 horas, ${branding.tenantName} aplicará automáticamente un recargo del 5% (cinco por ciento) en concepto de intereses por mora y gastos administrativos sobre el total de la liquidación vencida.`
  );

  // --- Section 4 ---
  drawSectionTitle('4. Compromiso de Servicio');

  drawParagraph(
    `${branding.tenantName} se compromete a realizar sus mayores esfuerzos para cumplir con los tiempos de entrega exigidos por la modalidad "Flex" de Mercado Libre, priorizando la seguridad de la paquetería y la comunicación fluida con El Vendedor ante eventualidades operativas.`
  );

  // Footer line
  y += 8;
  if (y > pageHeight - 30) {
    addPageFooter(doc, pageWidth, pageHeight, generatedDate);
    y = startNewPage();
  }
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text(`${branding.tenantName} — Velocidad y confianza en cada entrega.`, pageWidth / 2, y, { align: 'center' });

  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, pageWidth, pageHeight, generatedDate);
  }

  const safeName = branding.tenantName.replace(/\s+/g, '-');
  doc.save(`${safeName}-Terminos-Flex.pdf`);
}
