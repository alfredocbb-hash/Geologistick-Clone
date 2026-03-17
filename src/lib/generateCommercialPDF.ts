import { jsPDF } from 'jspdf';
import { loadLogoAsBase64, addPageHeader, addPageFooter, drawCoverPage, drawSectionHeader } from './pdfHelpers';

interface PlanData {
  name: string;
  description: string | null;
  price_monthly: number;
  max_users: number;
  max_branches: number;
  max_shipments_month: number;
  features: string[];
}

const PRIMARY: [number, number, number] = [20, 184, 166]; // teal
const DARK: [number, number, number] = [24, 24, 27];
const GRAY: [number, number, number] = [100, 100, 100];
const LIGHT_GRAY: [number, number, number] = [150, 150, 150];

const FEATURES = [
  { title: 'Gestión de Envíos', desc: 'Creá, asigná y hacé seguimiento de cada paquete en tiempo real. Control total del ciclo de vida del envío.' },
  { title: 'Tracking en Tiempo Real', desc: 'Seguimiento GPS de choferes, estados automáticos y notificaciones al destinatario por WhatsApp.' },
  { title: 'Inteligencia Artificial', desc: 'Optimización de rutas con IA, análisis predictivo de entregas y asistente administrativo inteligente.' },
  { title: 'Multi-sucursal', desc: 'Operá con múltiples sucursales, centros logísticos y zonas de cobertura con tarifas independientes.' },
  { title: 'Liquidaciones Automáticas', desc: 'Liquidaciones de choferes, sucursales, terciarizados y sellers de e-Commerce con un click.' },
  { title: 'Analytics y Reportes', desc: 'Dashboard con métricas de rendimiento, reportes exportables y análisis de costos operativos.' },
  { title: 'Escaneo QR / Código de Barras', desc: 'Escaneá rótulos para confirmar entregas, recibir paquetes y gestionar hojas de ruta sin errores.' },
  { title: 'Notificaciones Automáticas', desc: 'Alertas por email y WhatsApp en cada cambio de estado. Mantené informados a clientes y operadores.' },
  { title: 'White Label', desc: 'Personalizá colores, logo y nombre de la app. Cada empresa opera con su propia marca.' },
];

const STEPS = [
  { num: '01', title: 'Registrate', desc: 'Creá tu cuenta en minutos. Te asignamos un tenant con sucursal y usuario administrador listo para operar.' },
  { num: '02', title: 'Configurá', desc: 'Agregá sucursales, usuarios, choferes y tarifas. Personalizá tu marca y conectá integraciones.' },
  { num: '03', title: 'Operá', desc: 'Cargá envíos, planificá rutas, hacé seguimiento en vivo y liquidá automáticamente.' },
];

function formatLimit(n: number): string {
  return n === -1 ? 'Ilimitado' : n.toString();
}

function formatPrice(n: number): string {
  return n.toLocaleString('es-AR');
}

export async function generateCommercialPDF(plans?: PlanData[]) {
  const doc = new jsPDF();
  const logoBase64 = await loadLogoAsBase64();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const generatedDate = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── PAGE 1: Cover ──
  drawCoverPage(
    doc, logoBase64,
    'Geologistick',
    'Plataforma de Logística Inteligente',
    'Brochure Comercial',
    'Todo lo que necesitás para gestionar tu operación logística',
    pageWidth, PRIMARY
  );

  // ── PAGE 2: ¿Qué es Geologistick? ──
  doc.addPage();
  addPageHeader(doc, logoBase64, 'Geologistick — Brochure Comercial', pageWidth, margin);
  let y = 30;

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY);
  doc.text('¿Qué es Geologistick?', margin, y);
  y += 12;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  const introText = 'Geologistick es una plataforma SaaS integral diseñada para empresas de logística y distribución. Permite gestionar todo el ciclo operativo de envíos: desde la creación del pedido hasta la entrega final, pasando por rutas inteligentes, tracking en tiempo real, liquidaciones automáticas y mucho más.';
  const introLines = doc.splitTextToSize(introText, contentWidth);
  doc.text(introLines, margin, y);
  y += introLines.length * 5 + 10;

  // Key differentiators
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('¿Por qué elegir Geologistick?', margin, y);
  y += 10;

  const differentiators = [
    'Multi-tenant: cada empresa opera en su propio entorno aislado y seguro.',
    'White Label: personalizá la plataforma con tu marca, colores y logo.',
    'Escalable: desde 1 sucursal hasta operaciones nacionales con decenas de choferes.',
    'Integraciones: Mercado Libre, Tiendanube, ARCA (facturación electrónica).',
    'Mobile-first: app para choferes con GPS, escaneo QR y firma digital.',
    'Sin instalación: funciona 100% en la nube, accedé desde cualquier dispositivo.',
  ];

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  differentiators.forEach(d => {
    doc.setTextColor(...PRIMARY);
    doc.text('●', margin + 2, y);
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(d, contentWidth - 10);
    doc.text(lines, margin + 10, y);
    y += lines.length * 5 + 3;
  });

  addPageFooter(doc, pageWidth, pageHeight, generatedDate);

  // ── PAGE 3: Funcionalidades ──
  doc.addPage();
  addPageHeader(doc, logoBase64, 'Geologistick — Brochure Comercial', pageWidth, margin);
  y = 30;

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY);
  doc.text('Funcionalidades', margin, y);
  y += 14;

  FEATURES.forEach((feat, i) => {
    if (y > pageHeight - 40) {
      addPageFooter(doc, pageWidth, pageHeight, generatedDate);
      doc.addPage();
      addPageHeader(doc, logoBase64, 'Geologistick — Brochure Comercial', pageWidth, margin);
      y = 30;
    }

    // Feature number badge
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(margin, y - 5, 8, 8, 1, 1, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), margin + 4, y + 1, { align: 'center' });

    // Title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(feat.title, margin + 12, y);
    y += 6;

    // Description
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const descLines = doc.splitTextToSize(feat.desc, contentWidth - 12);
    doc.text(descLines, margin + 12, y);
    y += descLines.length * 4 + 8;
  });

  addPageFooter(doc, pageWidth, pageHeight, generatedDate);

  // ── PAGE 4: ¿Cómo funciona? ──
  doc.addPage();
  addPageHeader(doc, logoBase64, 'Geologistick — Brochure Comercial', pageWidth, margin);
  y = 30;

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY);
  doc.text('¿Cómo funciona?', margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Empezá a operar en 3 simples pasos', margin, y);
  y += 16;

  STEPS.forEach(step => {
    // Step number circle
    doc.setFillColor(...PRIMARY);
    doc.circle(margin + 10, y, 10, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(step.num, margin + 10, y + 5, { align: 'center' });

    // Title and desc
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(step.title, margin + 26, y - 2);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const stepLines = doc.splitTextToSize(step.desc, contentWidth - 30);
    doc.text(stepLines, margin + 26, y + 6);
    y += stepLines.length * 5 + 22;
  });

  // ── Planes y Precios (on same page if space, else new page) ──
  if (plans && plans.length > 0) {
    if (y > pageHeight - 100) {
      addPageFooter(doc, pageWidth, pageHeight, generatedDate);
      doc.addPage();
      addPageHeader(doc, logoBase64, 'Geologistick — Brochure Comercial', pageWidth, margin);
      y = 30;
    }

    y += 10;
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARY);
    doc.text('Planes y Precios', margin, y);
    y += 14;

    const colWidth = (contentWidth - 10) / Math.min(plans.length, 3);

    plans.slice(0, 3).forEach((plan, idx) => {
      const x = margin + idx * (colWidth + 5);
      const boxY = y;
      const boxH = 85;

      // Card background
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(...PRIMARY);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, boxY, colWidth, boxH, 3, 3, 'FD');

      // Plan name
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(plan.name, x + colWidth / 2, boxY + 10, { align: 'center' });

      // Price
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY);
      doc.text(`$${formatPrice(plan.price_monthly)}`, x + colWidth / 2, boxY + 22, { align: 'center' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...LIGHT_GRAY);
      doc.text('/mes · ARS', x + colWidth / 2, boxY + 27, { align: 'center' });

      // Limits
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text(`${formatLimit(plan.max_shipments_month)} envíos/mes`, x + 6, boxY + 36);
      doc.text(`${formatLimit(plan.max_branches)} sucursales`, x + 6, boxY + 42);
      doc.text(`${formatLimit(plan.max_users)} usuarios`, x + 6, boxY + 48);

      // Features (first 4)
      let fy = boxY + 56;
      plan.features.slice(0, 4).forEach(f => {
        doc.setTextColor(...PRIMARY);
        doc.text('✓', x + 6, fy);
        doc.setTextColor(...DARK);
        doc.setFontSize(7);
        const fLines = doc.splitTextToSize(f, colWidth - 18);
        doc.text(fLines[0], x + 13, fy);
        fy += 6;
      });
    });

    y += 95;
  }

  addPageFooter(doc, pageWidth, pageHeight, generatedDate);

  // ── LAST PAGE: Contact / CTA ──
  doc.addPage();
  addPageHeader(doc, logoBase64, 'Geologistick — Brochure Comercial', pageWidth, margin);
  y = pageHeight / 2 - 40;

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('¿Listo para empezar?', pageWidth / 2, y, { align: 'center' });
  y += 14;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Probá Geologistick gratis durante 14 días.', pageWidth / 2, y, { align: 'center' });
  y += 7;
  doc.text('Sin tarjeta de crédito. Sin compromiso.', pageWidth / 2, y, { align: 'center' });
  y += 20;

  // CTA button
  const btnW = 70;
  const btnH = 14;
  const btnX = (pageWidth - btnW) / 2;
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(btnX, y, btnW, btnH, 4, 4, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Solicitar Demo', pageWidth / 2, y + 9, { align: 'center' });
  y += 30;

  // Contact
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('www.geologistick.com', pageWidth / 2, y, { align: 'center' });
  y += 7;
  doc.text('contacto@geologistick.com', pageWidth / 2, y, { align: 'center' });

  // Footer on last page
  doc.setFillColor(...PRIMARY);
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('© Geologistick — Plataforma de Logística Inteligente', pageWidth / 2, pageHeight - 8, { align: 'center' });

  doc.save('Geologistick-Brochure-Comercial.pdf');
}
