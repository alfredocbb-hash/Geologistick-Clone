import geologistickLogo from '@/assets/geologistick-logo.png';
import { jsPDF } from 'jspdf';

// Load logo as base64 for PDF embedding
export async function loadLogoAsBase64(): Promise<string | null> {
  try {
    const response = await fetch(geologistickLogo);
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

// Add header with logo to a page
export function addPageHeader(
  doc: jsPDF,
  logoBase64: string | null,
  title: string,
  pageWidth: number,
  margin: number
) {
  // Logo pequeño a la izquierda
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, 5, 12, 12);
    } catch (e) {
      // Si falla la imagen, continuar sin ella
    }
  }

  // Línea separadora azul
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(margin, 19, pageWidth - margin, 19);

  // Título del documento centrado
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.setFont('helvetica', 'normal');
  doc.text(title, pageWidth / 2, 14, { align: 'center' });
}

// Add footer with page number and date
export function addPageFooter(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  generatedDate: string
) {
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.setFont('helvetica', 'normal');
  
  // Fecha a la izquierda
  doc.text(generatedDate, 20, pageHeight - 10);
  
  // Página a la derecha
  doc.text(
    `Página ${pageCount}`,
    pageWidth - 20,
    pageHeight - 10,
    { align: 'right' }
  );
}

// Draw professional cover page
export function drawCoverPage(
  doc: jsPDF,
  logoBase64: string | null,
  mainTitle: string,
  subtitle: string,
  documentTitle: string,
  documentSubtitle: string,
  pageWidth: number,
  primaryColor: [number, number, number] = [59, 130, 246]
) {
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Fondo de encabezado con color primario
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 90, 'F');

  // Logo centrado grande en el header con medallón blanco
  if (logoBase64) {
    try {
      const logoSize = 45;
      const medallionSize = logoSize + 6;
      const cx = pageWidth / 2;
      const cy = 12 + logoSize / 2;
      doc.setFillColor(255, 255, 255);
      doc.circle(cx, cy, medallionSize / 2, 'F');
      doc.addImage(
        logoBase64,
        'PNG',
        (pageWidth - logoSize) / 2,
        12,
        logoSize,
        logoSize
      );
    } catch (e) {
      // Si falla la imagen, continuar sin ella
    }
  }

  // Nombre de la empresa debajo del logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(mainTitle, pageWidth / 2, 70, { align: 'center' });

  // Subtítulo
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, pageWidth / 2, 82, { align: 'center' });

  // Título del documento (zona blanca)
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(documentTitle, pageWidth / 2, 130, { align: 'center' });

  // Línea decorativa bajo el título
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(2);
  const lineWidth = 80;
  doc.line((pageWidth - lineWidth) / 2, 140, (pageWidth + lineWidth) / 2, 140);

  // Subtítulo del documento
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(documentSubtitle, pageWidth / 2, 155, { align: 'center' });

  // Fecha de generación
  const date = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.setFontSize(11);
  doc.text(`Generado: ${date}`, pageWidth / 2, 180, { align: 'center' });

  // Versión
  doc.setFontSize(10);
  doc.text('Versión 1.0', pageWidth / 2, 192, { align: 'center' });

  // Footer decorativo en portada
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('www.geologistick.com', pageWidth / 2, pageHeight - 8, { align: 'center' });
}

// Draw section header with colored bar
export function drawSectionHeader(
  doc: jsPDF,
  title: string,
  pageWidth: number,
  primaryColor: [number, number, number] = [59, 130, 246]
) {
  // Barra de color con título
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, 18);
}
