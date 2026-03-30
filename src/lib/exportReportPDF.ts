import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { loadLogoAsBase64, drawCoverPage, addPageHeader, addPageFooter } from './pdfHelpers';

const PRIMARY: [number, number, number] = [59, 130, 246];
const ROW_HEIGHT = 7;

// ── Capture a DOM element (chart) as a PNG data URL ──
async function captureChart(ref: React.RefObject<HTMLDivElement | null>): Promise<string | null> {
  if (!ref.current) return null;
  try {
    const canvas = await html2canvas(ref.current, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// ── Draw a styled table ──
function drawTable(
  doc: jsPDF,
  headers: { label: string; align: 'left' | 'right' }[],
  rows: string[][],
  startY: number,
  pageWidth: number,
  margin: number,
  effectivityColIndex?: number
) {
  const usable = pageWidth - margin * 2;
  const colW = usable / headers.length;
  let y = startY;

  // Header row
  doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
  doc.rect(margin, y - 5, usable, ROW_HEIGHT + 1, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  headers.forEach((h, i) => {
    const x = h.align === 'right' ? margin + (i + 1) * colW - 2 : margin + i * colW + 2;
    doc.text(h.label, x, y, { align: h.align === 'right' ? 'right' : 'left' });
  });
  y += ROW_HEIGHT + 1;

  // Data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  const pageHeight = doc.internal.pageSize.getHeight();

  for (let r = 0; r < rows.length; r++) {
    if (y > pageHeight - 20) {
      addPageFooter(doc, pageWidth, pageHeight, format(new Date(), 'dd/MM/yyyy HH:mm'));
      doc.addPage();
      y = 30;
    }

    // Alternating row background
    if (r % 2 === 1) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y - 4.5, usable, ROW_HEIGHT, 'F');
    }

    // Subtle row border
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 2.5, margin + usable, y + 2.5);

    rows[r].forEach((cell, i) => {
      const align = headers[i].align;
      const x = align === 'right' ? margin + (i + 1) * colW - 2 : margin + i * colW + 2;

      // Effectivity badge
      if (effectivityColIndex !== undefined && i === effectivityColIndex) {
        const pct = parseInt(cell);
        const badgeColor: [number, number, number] = pct >= 80 ? [34, 197, 94] : pct >= 50 ? [234, 179, 8] : [239, 68, 68];
        const badgeW = 18;
        const badgeX = margin + (i + 1) * colW - badgeW - 2;
        doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
        doc.roundedRect(badgeX, y - 3.5, badgeW, 5.5, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text(cell, badgeX + badgeW / 2, y, { align: 'center' });
        doc.setFontSize(7.5);
        doc.setTextColor(50, 50, 50);
      } else {
        doc.setTextColor(50, 50, 50);
        doc.text(String(cell), x, y, { align: align === 'right' ? 'right' : 'left' });
      }
    });
    y += ROW_HEIGHT;
  }
  return y;
}

// ── Add chart image to PDF ──
function addChartImage(doc: jsPDF, imgData: string, pageWidth: number, margin: number, y: number): number {
  const maxW = pageWidth - margin * 2;
  const maxH = 90;
  // Get aspect ratio from the image
  const img = new Image();
  img.src = imgData;
  const aspectRatio = img.width / img.height || 16 / 9;
  let w = maxW;
  let h = w / aspectRatio;
  if (h > maxH) {
    h = maxH;
    w = h * aspectRatio;
  }
  const x = margin + (maxW - w) / 2;
  doc.addImage(imgData, 'PNG', x, y, w, h);
  return y + h + 8;
}

// ── Main export function ──
export interface ReportExportOptions {
  tab: 'sucursales' | 'destinos' | 'choferes' | 'resumen' | 'envios';
  title: string;
  subtitle: string;
  dateRange: string;
  chartRefs: React.RefObject<HTMLDivElement | null>[];
  data: any;
}

export async function exportReportPDF(opts: ReportExportOptions) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const logoBase64 = await loadLogoAsBase64();
  const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm');

  // ── Page 1: Cover ──
  drawCoverPage(doc, logoBase64, 'Geologistick', 'Sistema de Logistica', opts.title, `Periodo: ${opts.dateRange}`, pageWidth, PRIMARY);

  // ── Page 2+: Content ──
  doc.addPage();
  addPageHeader(doc, logoBase64, opts.title, pageWidth, margin);

  let y = 28;

  // Capture and add charts
  for (const ref of opts.chartRefs) {
    const chartImg = await captureChart(ref);
    if (chartImg) {
      if (y > pageHeight - 110) {
        addPageFooter(doc, pageWidth, pageHeight, dateStr);
        doc.addPage();
        addPageHeader(doc, logoBase64, opts.title, pageWidth, margin);
        y = 28;
      }
      y = addChartImage(doc, chartImg, pageWidth, margin, y);
    }
  }

  // Build table based on tab
  if (opts.tab === 'sucursales') {
    const data = opts.data as { sucursal_nombre: string; total: number; entregados: number; pendientes: number; cancelados: number; efectividad: number }[];
    if (y > pageHeight - 60) {
      addPageFooter(doc, pageWidth, pageHeight, dateStr);
      doc.addPage();
      addPageHeader(doc, logoBase64, opts.title, pageWidth, margin);
      y = 28;
    }
    drawTable(
      doc,
      [
        { label: 'Sucursal', align: 'left' },
        { label: 'Total', align: 'right' },
        { label: 'Entregados', align: 'right' },
        { label: 'Pendientes', align: 'right' },
        { label: 'Cancelados', align: 'right' },
        { label: '% Efect.', align: 'right' },
      ],
      data.map(d => [d.sucursal_nombre, String(d.total), String(d.entregados), String(d.pendientes), String(d.cancelados), `${d.efectividad}%`]),
      y,
      pageWidth,
      margin,
      5
    );
  } else if (opts.tab === 'destinos') {
    const data = opts.data as { ciudad: string; provincia: string; cantidad: number; ingresos: number }[];
    if (y > pageHeight - 60) {
      addPageFooter(doc, pageWidth, pageHeight, dateStr);
      doc.addPage();
      addPageHeader(doc, logoBase64, opts.title, pageWidth, margin);
      y = 28;
    }
    drawTable(
      doc,
      [
        { label: 'Ciudad', align: 'left' },
        { label: 'Provincia', align: 'left' },
        { label: 'Cantidad', align: 'right' },
        { label: 'Ingresos', align: 'right' },
      ],
      data.slice(0, 30).map(d => [d.ciudad, d.provincia, String(d.cantidad), `$${d.ingresos.toLocaleString()}`]),
      y,
      pageWidth,
      margin
    );
  } else if (opts.tab === 'choferes') {
    const data = opts.data as { chofer_nombre: string; total: number; entregados: number; no_entregados: number; efectividad: number; tiempo_promedio_minutos: number | null }[];
    if (y > pageHeight - 60) {
      addPageFooter(doc, pageWidth, pageHeight, dateStr);
      doc.addPage();
      addPageHeader(doc, logoBase64, opts.title, pageWidth, margin);
      y = 28;
    }
    drawTable(
      doc,
      [
        { label: '#', align: 'left' },
        { label: 'Chofer', align: 'left' },
        { label: 'Total', align: 'right' },
        { label: 'Entreg.', align: 'right' },
        { label: 'No Entreg.', align: 'right' },
        { label: '% Efect.', align: 'right' },
        { label: 'T. Prom.', align: 'right' },
      ],
      data.map((d, i) => [String(i + 1), d.chofer_nombre, String(d.total), String(d.entregados), String(d.no_entregados), `${d.efectividad}%`, d.tiempo_promedio_minutos ? `${d.tiempo_promedio_minutos} min` : '-']),
      y,
      pageWidth,
      margin,
      5
    );
  } else if (opts.tab === 'envios') {
    const data = opts.data as { tracking_number: string; nombre_remitente: string; nombre_destinatario: string; ciudad_entrega: string; precio_total: number; estado_liquidacion: string; comision_chofer: number; importe_abonado: number; diferencia: number }[];
    if (y > pageHeight - 60) {
      addPageFooter(doc, pageWidth, pageHeight, dateStr);
      doc.addPage();
      addPageHeader(doc, logoBase64, opts.title, pageWidth, margin);
      y = 28;
    }
    drawTable(
      doc,
      [
        { label: 'Tracking', align: 'left' },
        { label: 'Remitente', align: 'left' },
        { label: 'Destinatario', align: 'left' },
        { label: 'Localidad', align: 'left' },
        { label: 'Importe', align: 'right' },
        { label: 'Liq.', align: 'left' },
        { label: 'Comisión', align: 'right' },
        { label: 'Abonado', align: 'right' },
        { label: 'Diferencia', align: 'right' },
      ],
      data.map(d => [
        d.tracking_number,
        d.nombre_remitente.substring(0, 15),
        d.nombre_destinatario.substring(0, 15),
        d.ciudad_entrega.substring(0, 12),
        `$${d.precio_total.toLocaleString()}`,
        d.estado_liquidacion,
        `$${d.comision_chofer.toLocaleString()}`,
        `$${d.importe_abonado.toLocaleString()}`,
        `$${d.diferencia.toLocaleString()}`,
      ]),
      y,
      pageWidth,
      margin
    );
  } else if (opts.tab === 'resumen') {
    const data = opts.data as { totalEnvios: number; tasaEntrega: number; tiempoPromedio: number | null; ingresosTotales: number; evolucionDiaria: any[]; distribucionEstados: { estado: string; cantidad: number }[] };

    // KPI boxes
    if (y > pageHeight - 50) {
      addPageFooter(doc, pageWidth, pageHeight, dateStr);
      doc.addPage();
      addPageHeader(doc, logoBase64, opts.title, pageWidth, margin);
      y = 28;
    }
    const kpis = [
      { label: 'Total Envios', value: String(data.totalEnvios) },
      { label: 'Tasa de Entrega', value: `${data.tasaEntrega}%` },
      { label: 'Tiempo Promedio', value: data.tiempoPromedio ? `${data.tiempoPromedio} min` : 'N/A' },
      { label: 'Ingresos Totales', value: `$${data.ingresosTotales.toLocaleString()}` },
    ];
    const kpiW = (pageWidth - margin * 2 - 12) / 4;
    kpis.forEach((kpi, i) => {
      const kx = margin + i * (kpiW + 4);
      doc.setFillColor(240, 245, 255);
      doc.roundedRect(kx, y, kpiW, 22, 3, 3, 'F');
      doc.setDrawColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
      doc.setLineWidth(0.5);
      doc.roundedRect(kx, y, kpiW, 22, 3, 3, 'S');
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(kpi.label, kx + kpiW / 2, y + 8, { align: 'center' });
      doc.setFontSize(13);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.value, kx + kpiW / 2, y + 18, { align: 'center' });
      doc.setFont('helvetica', 'normal');
    });
    y += 30;

    // Distribution table
    if (data.distribucionEstados.length > 0) {
      const STATUS_LABELS: Record<string, string> = {
        pendiente: 'Pendiente', en_bodega: 'En Bodega', en_transito: 'En Transito',
        en_sucursal: 'En Sucursal', en_reparto: 'En Reparto', entregado: 'Entregado',
        cancelado: 'Cancelado', devuelto: 'Devuelto', recogido: 'Recogido', incidencia: 'Incidencia',
      };
      if (y > pageHeight - 60) {
        addPageFooter(doc, pageWidth, pageHeight, dateStr);
        doc.addPage();
        addPageHeader(doc, logoBase64, opts.title, pageWidth, margin);
        y = 28;
      }
      drawTable(
        doc,
        [
          { label: 'Estado', align: 'left' },
          { label: 'Cantidad', align: 'right' },
        ],
        data.distribucionEstados.map(d => [STATUS_LABELS[d.estado] || d.estado, String(d.cantidad)]),
        y,
        pageWidth,
        margin
      );
    }
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, pageWidth, pageHeight, dateStr);
  }

  doc.save(`${opts.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}
