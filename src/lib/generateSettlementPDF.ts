import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { parseDateString } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';

interface ConceptoResumenPDF {
  nombre: string;
  ventas: number;
  porcentaje: number;
  comision: number;
  sinConfiguracion?: boolean;
}

interface ResumenConceptosPDF {
  contado: ConceptoResumenPDF[];
  destino: ConceptoResumenPDF[];
  cta_cte: ConceptoResumenPDF[];
}

interface SettlementPDFData {
  type: 'branch' | 'driver' | 'seller';
  settlement: {
    id: string;
    periodo_inicio: string;
    periodo_fin: string;
    estado: string | null;
    fecha_pago: string | null;
    metodo_pago: string | null;
    referencia_pago: string | null;
    notas: string | null;
  };
  entityName: string;
  totals: {
    montoTotal?: number;
    totalCobrado?: number;
    totalComisiones?: number;
    totalCargos?: number;
    totalPagos?: number;
    saldo?: number;
    cantidadEnvios?: number;
    cantidadMovimientos?: number;
  };
  items: Array<{
    tracking?: string;
    fecha: string;
    destinatario?: string;
    tipo?: string;
    descripcion?: string;
    monto: number;
    comision?: number;
  }>;
  shipments?: Array<{
    tracking: string;
    fecha: string;
    destinatario: string;
    localidad: string;
    precio: number;
  }>;
  resumenConceptos?: ResumenConceptosPDF | null;
}

interface BrandingData {
  logo_light?: string | null;
  nombre_app?: string | null;
  color_primario?: string | null;
}

// Load image as base64 via canvas (supports SVG and CORS)
async function loadImageAsBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Convert hex color to RGB tuple
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return [59, 130, 246];
  return [r, g, b];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

export async function generateSettlementPDF(
  data: SettlementPDFData,
  branding?: BrandingData
): Promise<void> {
  const { type, settlement, entityName, totals, items, shipments } = data;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const isBranch = type === 'branch';
  const isSeller = type === 'seller';

  const primaryHex = branding?.color_primario || '#3B82F6';
  const primaryRgb = hexToRgb(primaryHex);
  const appName = branding?.nombre_app || 'Geologistick';

  // Load logo if available
  let logoBase64: string | null = null;
  if (branding?.logo_light) {
    logoBase64 = await loadImageAsBase64(branding.logo_light);
  }

  const periodoStr = `${format(parseDateString(settlement.periodo_inicio), 'dd/MM/yyyy')} - ${format(parseDateString(settlement.periodo_fin), 'dd/MM/yyyy')}`;

  const headerH = 32;
  const bodyStart = 40;

  const drawHeader = () => {
    // White header bar with colored bottom border
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, headerH, 'F');
    doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.setLineWidth(1.5);
    doc.line(0, headerH, pageWidth, headerH);

    let logoEndX = 12;

    // Logo with correct aspect ratio
    if (logoBase64) {
      try {
        const imgProps = doc.getImageProperties(logoBase64);
        const maxLogoH = 22;
        const maxLogoW = 44;
        const ratio = imgProps.width / imgProps.height;
        let logoW = maxLogoH * ratio;
        let logoH = maxLogoH;
        if (logoW > maxLogoW) {
          logoW = maxLogoW;
          logoH = maxLogoW / ratio;
        }
        const logoY = (headerH - logoH) / 2;
        doc.addImage(logoBase64, 'PNG', 10, logoY, logoW, logoH);
        logoEndX = 10 + logoW + 5;
      } catch { /* continue without logo */ }
    }

    // Company name - dark text on white background
    doc.setTextColor(24, 24, 27);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(appName, logoEndX, headerH / 2 - 2);

    // Settlement type title
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(isSeller
      ? 'LIQUIDACIÓN DE SELLER'
      : isBranch
        ? 'LIQUIDACIÓN DE SUCURSAL'
        : 'LIQUIDACIÓN DE CHOFER', logoEndX, headerH / 2 + 6);

    // Period on the right
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(`Período: ${periodoStr}`, pageWidth - 10, headerH / 2 + 6, { align: 'right' });
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(10, pageHeight - 15, pageWidth - 10, pageHeight - 15);
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.setFont('helvetica', 'normal');
    doc.text(appName, 10, pageHeight - 9);
    doc.text(`Período: ${periodoStr}`, pageWidth / 2, pageHeight - 9, { align: 'center' });
    doc.text(`Pág. ${pageNum} de ${totalPages}`, pageWidth - 10, pageHeight - 9, { align: 'right' });
  };

  // --- Page 1 ---
  drawHeader();
  let y = bodyStart;

  // Info block
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);

  const entityLabel = isSeller ? 'Seller' : isBranch ? 'Sucursal' : 'Chofer';
  doc.setFont('helvetica', 'bold');
  doc.text(`${entityLabel}:`, 10, y);
  doc.setFont('helvetica', 'normal');
  doc.text(entityName, 38, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Estado:', pageWidth / 2, y);
  doc.setFont('helvetica', 'normal');
  doc.text((settlement.estado || 'Pendiente').toUpperCase(), pageWidth / 2 + 18, y);
  y += 7;

  if (settlement.fecha_pago) {
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha de Pago:', 10, y);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(settlement.fecha_pago), 'dd/MM/yyyy'), 48, y);
    y += 6;
  }

  if (settlement.metodo_pago) {
    doc.setFont('helvetica', 'bold');
    doc.text('Método de Pago:', 10, y);
    doc.setFont('helvetica', 'normal');
    doc.text(settlement.metodo_pago, 50, y);
    if (settlement.referencia_pago) {
      doc.setFont('helvetica', 'bold');
      doc.text('Referencia:', pageWidth / 2, y);
      doc.setFont('helvetica', 'normal');
      doc.text(settlement.referencia_pago, pageWidth / 2 + 28, y);
    }
    y += 6;
  }

  y += 4;

  // Ensure we don't overlap with header
  if (y < bodyStart) y = bodyStart;

  // Financial summary box
  const boxH = isSeller ? 36 : isBranch ? 32 : 28;
  const lightR = Math.min(255, primaryRgb[0] + Math.round((255 - primaryRgb[0]) * 0.88));
  const lightG = Math.min(255, primaryRgb[1] + Math.round((255 - primaryRgb[1]) * 0.88));
  const lightB = Math.min(255, primaryRgb[2] + Math.round((255 - primaryRgb[2]) * 0.88));
  doc.setFillColor(lightR, lightG, lightB);
  doc.rect(10, y, pageWidth - 20, boxH, 'F');
  doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.setLineWidth(0.5);
  doc.rect(10, y, pageWidth - 20, boxH, 'S');

  y += 9;
  doc.setTextColor(50, 50, 50);

  if (isSeller && totals.totalCargos !== undefined) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Movimientos: ${totals.cantidadMovimientos || 0}`, 15, y);
    doc.text(`Total Envíos: ${formatCurrency(totals.totalCargos || 0)}`, pageWidth / 2, y);
    y += 7;
    doc.text(`Total Pagos: ${formatCurrency(totals.totalPagos || 0)}`, 15, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(`SALDO DEL PERÍODO: ${formatCurrency(totals.saldo || 0)}`, 15, y);
  } else if (isBranch && totals.totalCobrado !== undefined) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total Cobrado: ${formatCurrency(totals.totalCobrado)}`, 15, y);
    doc.text(`Comisiones: ${formatCurrency(totals.totalComisiones || 0)}`, pageWidth / 2, y);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(`SALDO A TRANSFERIR: ${formatCurrency(totals.saldo || 0)}`, 15, y);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Cantidad de Envíos: ${totals.cantidadEnvios || 0}`, 15, y);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(`MONTO TOTAL: ${formatCurrency(totals.montoTotal || 0)}`, 15, y);
  }

  y += 14;

  // --- Concept breakdown for branch settlements ---
  if (isBranch && data.resumenConceptos) {
    const { contado, destino, cta_cte } = data.resumenConceptos;
    const allGroups: { label: string; conceptos: typeof contado }[] = [
      { label: 'CONTADO', conceptos: contado },
      { label: 'PAGO DESTINO', conceptos: destino },
      { label: 'CUENTA CORRIENTE', conceptos: cta_cte },
    ].filter(g => g.conceptos.length > 0);

    if (allGroups.length > 0) {
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('RESUMEN POR CONCEPTO', 10, y);
      y += 6;

      for (const group of allGroups) {
        if (y > pageHeight - 50) {
          doc.addPage();
          drawHeader();
          y = bodyStart;
        }

        // Group label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        doc.text(group.label, 12, y);
        y += 5;

        // Table header
        doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        doc.rect(10, y - 4, pageWidth - 20, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('Concepto', 12, y);
        doc.text('Ventas', 90, y, { align: 'right' });
        doc.text('Comisión %', 130, y, { align: 'right' });
        doc.text('Total Comisión', pageWidth - 12, y, { align: 'right' });
        y += 7;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        let groupVentas = 0;
        let groupComision = 0;

        group.conceptos.forEach((c, idx) => {
          if (y > pageHeight - 25) {
            doc.addPage();
            drawHeader();
            y = bodyStart;
          }
          if (idx % 2 === 0) {
            doc.setFillColor(247, 247, 250);
            doc.rect(10, y - 4, pageWidth - 20, 7, 'F');
          }
          doc.setFontSize(7.5);
          doc.text(c.nombre.substring(0, 35), 12, y);
          doc.text(formatCurrency(c.ventas), 90, y, { align: 'right' });
          const pctEfectivo = c.ventas > 0 ? (c.comision / c.ventas) * 100 : 0;
          doc.text(c.sinConfiguracion ? 'sin config' : `${pctEfectivo.toFixed(2)}%`, 130, y, { align: 'right' });
          doc.text(formatCurrency(c.comision), pageWidth - 12, y, { align: 'right' });
          groupVentas += c.ventas;
          groupComision += c.comision;
          y += 7;
        });

        // Subtotal row
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(10, y - 1, pageWidth - 10, y - 1);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('SUBTOTAL', 12, y + 3);
        doc.text(formatCurrency(groupVentas), 90, y + 3, { align: 'right' });
        doc.text('-', 130, y + 3, { align: 'right' });
        doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        doc.text(formatCurrency(groupComision), pageWidth - 12, y + 3, { align: 'right' });
        doc.setTextColor(50, 50, 50);
        y += 12;
      }

      y += 4;
    }
  }

  // --- Detail table ---
  const tableData = !isSeller ? items : [];
  const shipmentData = isSeller && shipments ? shipments : [];
  const allRows = isSeller ? shipmentData : tableData;

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DETALLE DE ENVÍOS', 10, y);
  y += 6;

  // Column positions — redesigned to fit within 10–200mm (190mm usable)
  // Seller: Tracking | Fecha | Destinatario | Estado | Monto
  // Driver/Branch: Tracking | Fecha | Destinatario | Monto
  const colTracking = 12;
  const colFecha = isSeller ? 62 : 68;
  const colDest = isSeller ? 84 : 88;
  const colEstado = isSeller ? 138 : null;
  const colMonto = pageWidth - 12; // right-aligned

  const drawTableHeader = () => {
    doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.rect(10, y - 4, pageWidth - 20, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Tracking', colTracking, y);
    doc.text('Fecha', colFecha, y);
    doc.text('Destinatario', colDest, y);
    if (colEstado) doc.text('Localidad', colEstado, y);
    doc.text('Monto', colMonto, y, { align: 'right' });
  };

  drawTableHeader();
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);

  let rowTotal = 0;

  allRows.forEach((row: any, index: number) => {
    if (y > pageHeight - 25) {
      doc.addPage();
      drawHeader();
      y = bodyStart;
      drawTableHeader();
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
    }

    if (index % 2 === 0) {
      doc.setFillColor(247, 247, 250);
      doc.rect(10, y - 4, pageWidth - 20, 7, 'F');
    }

    doc.setFontSize(7.5);

    const tracking = (row.tracking || '-').substring(0, isSeller ? 18 : 22);
    const fecha = row.fecha || '-';
    const dest = (row.destinatario || '-').substring(0, isSeller ? 20 : 28);
    const monto = isSeller ? (row.precio || 0) : (row.monto || 0);

    doc.text(tracking, colTracking, y);
    doc.text(fecha, colFecha, y);
    doc.text(dest, colDest, y);
    if (colEstado && isSeller) {
      doc.text((row.localidad || '-').substring(0, 14), colEstado, y);
    }
    doc.text(formatCurrency(monto), colMonto, y, { align: 'right' });
    rowTotal += monto;
    y += 7;
  });

  // Total row at bottom of table
  if (allRows.length > 0) {
    y += 2;
    doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.setLineWidth(0.4);
    doc.line(10, y, pageWidth - 10, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.text(`Total (${allRows.length} envíos): ${formatCurrency(rowTotal)}`, colMonto, y, { align: 'right' });
  }

  // Add footers to all pages
  const numPages = doc.getNumberOfPages();
  for (let p = 1; p <= numPages; p++) {
    doc.setPage(p);
    drawFooter(p, numPages);
  }

  // Save
  let fileName: string;
  if (isSeller) {
    fileName = `liquidacion-seller-${entityName.replace(/\s+/g, '-')}-${format(parseDateString(settlement.periodo_fin), 'yyyy-MM-dd')}.pdf`;
  } else if (isBranch) {
    fileName = `liquidacion-sucursal-${entityName.replace(/\s+/g, '-')}-${format(parseDateString(settlement.periodo_fin), 'yyyy-MM-dd')}.pdf`;
  } else {
    fileName = `liquidacion-chofer-${entityName.replace(/\s+/g, '-')}-${format(parseDateString(settlement.periodo_fin), 'yyyy-MM-dd')}.pdf`;
  }
  doc.save(fileName);
}

// Helper: fetch branding for the current user's tenant
async function fetchTenantBranding(): Promise<BrandingData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();
  if (!profile?.tenant_id) return null;
  const { data: brandingData } = await supabase
    .from('tenant_branding')
    .select('logo_light, nombre_app, color_primario')
    .eq('tenant_id', profile.tenant_id)
    .single();
  return brandingData || null;
}

// Quick download function for driver settlements
export async function downloadDriverSettlementPDF(liquidacion: {
  id: string;
  chofer_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  monto_total: number;
  cantidad_envios: number | null;
  estado: string | null;
  notas: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  chofer?: { nombre: string; apellido: string | null };
}, branding?: BrandingData): Promise<void> {
  const resolvedBranding = branding || await fetchTenantBranding();

  // Load logo
  let logoBase64: string | null = null;
  if (resolvedBranding?.logo_light) {
    logoBase64 = await loadImageAsBase64(resolvedBranding.logo_light);
  }

  // Fetch comisiones
  const { data: comisiones } = await supabase
    .from('comisiones')
    .select(`
      *,
      envio:envios(tracking_number, estado, created_at, precio_total, nombre_destinatario, destinatario_id, 
        clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
    `)
    .eq('liquidacion_id', liquidacion.id)
    .order('created_at', { ascending: false });

  const items = (comisiones || []).map((c: any) => ({
    tracking: c.envio?.tracking_number || '-',
    fecha: c.envio?.created_at ? format(new Date(c.envio.created_at), 'dd/MM/yy') : '-',
    destinatario: c.envio?.clientes
      ? `${c.envio.clientes.nombre || ''} ${c.envio.clientes.apellido || ''}`.trim()
      : c.envio?.nombre_destinatario || '-',
    monto: c.monto || 0,
  }));

  await generateSettlementPDF({
    type: 'driver',
    settlement: {
      id: liquidacion.id,
      periodo_inicio: liquidacion.periodo_inicio,
      periodo_fin: liquidacion.periodo_fin,
      estado: liquidacion.estado,
      fecha_pago: liquidacion.fecha_pago,
      metodo_pago: liquidacion.metodo_pago,
      referencia_pago: liquidacion.referencia_pago,
      notas: liquidacion.notas,
    },
    entityName: `${liquidacion.chofer?.nombre || ''} ${liquidacion.chofer?.apellido || ''}`.trim() || 'N-A',
    totals: {
      montoTotal: liquidacion.monto_total,
      cantidadEnvios: liquidacion.cantidad_envios || items.length,
    },
    items,
  }, resolvedBranding ? { ...resolvedBranding, logo_light: logoBase64 || resolvedBranding.logo_light } : undefined);
}

// Quick download function for branch settlements
export async function downloadBranchSettlementPDF(liquidacion: {
  id: string;
  sucursal_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  total_cobrado: number | null;
  total_comisiones: number | null;
  saldo: number | null;
  estado: string | null;
  notas: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  sucursal?: { nombre: string };
  resumen_conceptos?: ResumenConceptosPDF | null;
}, branding?: BrandingData): Promise<void> {
  const resolvedBranding = branding || await fetchTenantBranding();

  let logoBase64: string | null = null;
  if (resolvedBranding?.logo_light) {
    logoBase64 = await loadImageAsBase64(resolvedBranding.logo_light);
  }

  const { data: detalles } = await supabase
    .from('liquidacion_sucursal_detalles')
    .select(`
      *,
      envio:envios(tracking_number, estado, created_at, nombre_destinatario, destinatario_id, 
        clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
    `)
    .eq('liquidacion_id', liquidacion.id)
    .order('created_at', { ascending: false });

  const items = (detalles || []).map((d: any) => ({
    tracking: d.envio?.tracking_number || '-',
    fecha: d.envio?.created_at ? format(new Date(d.envio.created_at), 'dd/MM/yy') : '-',
    destinatario: d.envio?.clientes
      ? `${d.envio.clientes.nombre || ''} ${d.envio.clientes.apellido || ''}`.trim()
      : d.envio?.nombre_destinatario || '-',
    monto: d.monto_envio || 0,
    comision: d.comision_aplicada || 0,
  }));

  await generateSettlementPDF({
    type: 'branch',
    settlement: {
      id: liquidacion.id,
      periodo_inicio: liquidacion.periodo_inicio,
      periodo_fin: liquidacion.periodo_fin,
      estado: liquidacion.estado,
      fecha_pago: liquidacion.fecha_pago,
      metodo_pago: liquidacion.metodo_pago,
      referencia_pago: liquidacion.referencia_pago,
      notas: liquidacion.notas,
    },
    entityName: liquidacion.sucursal?.nombre || 'N-A',
    totals: {
      totalCobrado: liquidacion.total_cobrado || 0,
      totalComisiones: liquidacion.total_comisiones || 0,
      saldo: liquidacion.saldo || 0,
      cantidadEnvios: items.length,
    },
    items,
  }, resolvedBranding ? { ...resolvedBranding, logo_light: logoBase64 || resolvedBranding.logo_light } : undefined);
}

// Quick download function for seller settlements
export async function downloadSellerSettlementPDF(liquidacion: {
  id: string;
  seller_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  total_cargos: number | null;
  total_pagos: number | null;
  saldo_periodo: number | null;
  saldo_anterior: number | null;
  saldo_final: number | null;
  cantidad_movimientos: number | null;
  estado: string | null;
  notas: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  seller?: { nombre: string };
}, branding?: BrandingData): Promise<void> {
  const resolvedBranding = branding || await fetchTenantBranding();

  let logoBase64: string | null = null;
  if (resolvedBranding?.logo_light) {
    logoBase64 = await loadImageAsBase64(resolvedBranding.logo_light);
  }

  // Fetch envíos vinculados
  const { data: envios } = await supabase
    .from('envios')
    .select('id, tracking_number, nombre_destinatario, precio_total, estado, ciudad_entrega, created_at')
    .eq('liquidacion_seller_id', liquidacion.id)
    .neq('estado', 'pendiente')
    .order('created_at', { ascending: true });

  const shipmentItems = (envios || []).map((e: any) => ({
    tracking: e.tracking_number || '-',
    fecha: e.created_at ? format(new Date(e.created_at), 'dd/MM/yy') : '-',
    destinatario: e.nombre_destinatario || '-',
    localidad: e.ciudad_entrega || '-',
    precio: e.estado === 'cancelado' ? 0 : (e.precio_total || 0),
  }));

  await generateSettlementPDF({
    type: 'seller',
    settlement: {
      id: liquidacion.id,
      periodo_inicio: liquidacion.periodo_inicio,
      periodo_fin: liquidacion.periodo_fin,
      estado: liquidacion.estado,
      fecha_pago: liquidacion.fecha_pago,
      metodo_pago: liquidacion.metodo_pago,
      referencia_pago: liquidacion.referencia_pago,
      notas: liquidacion.notas,
    },
    entityName: liquidacion.seller?.nombre || 'N-A',
    totals: {
      totalCargos: liquidacion.total_cargos || 0,
      totalPagos: liquidacion.total_pagos || 0,
      saldo: liquidacion.saldo_periodo || 0,
      cantidadMovimientos: liquidacion.cantidad_movimientos || 0,
    },
    items: [],
    shipments: shipmentItems,
  }, resolvedBranding ? { ...resolvedBranding, logo_light: logoBase64 || resolvedBranding.logo_light } : undefined);
}

// Quick download function for third-party settlements
export async function downloadThirdPartySettlementPDF(liquidacion: {
  id: string;
  empresa_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  monto_neto: number;
  monto_iva: number;
  monto_total: number;
  cantidad_envios: number;
  estado: string;
  notas: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  empresa?: { nombre: string; cuit?: string | null };
}, branding?: BrandingData): Promise<void> {
  const resolvedBranding = branding || await fetchTenantBranding();

  let logoBase64: string | null = null;
  if (resolvedBranding?.logo_light) {
    logoBase64 = await loadImageAsBase64(resolvedBranding.logo_light);
  }

  // Fetch detalles con envíos
  const { data: detalles } = await (supabase
    .from('liquidacion_terciarizado_detalles') as any)
    .select(`
      *,
      envio:envios(tracking_number, tracking_externo, nombre_destinatario, precio_total, estado, fecha_entrega, created_at, requiere_retiro,
        clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
    `)
    .eq('liquidacion_id', liquidacion.id)
    .order('created_at', { ascending: true });

  const items = (detalles || []).map((d: any) => {
    const operacion = d.envio?.requiere_retiro ? 'Retiro' : 'Entrega';
    const destName = d.envio?.clientes
      ? `${d.envio.clientes.nombre || ''} ${d.envio.clientes.apellido || ''}`.trim()
      : d.envio?.nombre_destinatario || '-';
    return {
      tracking: d.envio?.tracking_externo || d.envio?.tracking_number || '-',
      fecha: d.envio?.fecha_entrega ? format(new Date(d.envio.fecha_entrega), 'dd/MM/yy') : '-',
      destinatario: `[${operacion}] ${destName}`,
      monto: d.monto || 0,
    };
  });

  await generateSettlementPDF({
    type: 'branch', // reuse branch layout (has neto/iva/total structure)
    settlement: {
      id: liquidacion.id,
      periodo_inicio: liquidacion.periodo_inicio,
      periodo_fin: liquidacion.periodo_fin,
      estado: liquidacion.estado,
      fecha_pago: liquidacion.fecha_pago,
      metodo_pago: liquidacion.metodo_pago,
      referencia_pago: liquidacion.referencia_pago,
      notas: liquidacion.notas,
    },
    entityName: liquidacion.empresa?.nombre || 'N-A',
    totals: {
      totalCobrado: liquidacion.monto_neto,
      totalComisiones: liquidacion.monto_iva,
      saldo: liquidacion.monto_total,
      cantidadEnvios: liquidacion.cantidad_envios,
    },
    items,
  }, resolvedBranding ? { ...resolvedBranding, logo_light: logoBase64 || resolvedBranding.logo_light } : undefined);
}
