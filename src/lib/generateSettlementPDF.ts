import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface SettlementPDFData {
  type: 'branch' | 'driver';
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
    saldo?: number;
    cantidadEnvios: number;
  };
  items: Array<{
    tracking: string;
    fecha: string;
    destinatario: string;
    monto: number;
    comision?: number;
  }>;
}

export function generateSettlementPDF(data: SettlementPDFData): void {
  const { type, settlement, entityName, totals, items } = data;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;
  const isBranch = type === 'branch';

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(isBranch ? 'LIQUIDACIÓN DE SUCURSAL' : 'LIQUIDACIÓN DE CHOFER', pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Info general
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${isBranch ? 'Sucursal' : 'Chofer'}: ${entityName}`, 20, y);
  y += 7;

  doc.text(`Período: ${format(new Date(settlement.periodo_inicio), 'dd/MM/yyyy')} - ${format(new Date(settlement.periodo_fin), 'dd/MM/yyyy')}`, 20, y);
  y += 7;

  doc.text(`Estado: ${settlement.estado || 'Pendiente'}`, 20, y);
  y += 7;

  if (settlement.fecha_pago) {
    doc.text(`Fecha de Pago: ${format(new Date(settlement.fecha_pago), 'dd/MM/yyyy HH:mm')}`, 20, y);
    y += 7;
  }

  if (settlement.metodo_pago) {
    doc.text(`Método de Pago: ${settlement.metodo_pago}`, 20, y);
    y += 7;
  }

  if (settlement.referencia_pago) {
    doc.text(`Referencia: ${settlement.referencia_pago}`, 20, y);
    y += 7;
  }

  y += 5;

  // Totales
  doc.setFillColor(245, 245, 245);
  doc.rect(20, y, pageWidth - 40, 25, 'F');
  y += 8;

  doc.setFont('helvetica', 'bold');
  if (isBranch && totals.totalCobrado !== undefined) {
    doc.text(`Total Cobrado: $${totals.totalCobrado.toFixed(2)}`, 25, y);
    y += 7;
    doc.text(`Total Comisiones: $${(totals.totalComisiones || 0).toFixed(2)}`, 25, y);
    y += 7;
    doc.setFontSize(13);
    doc.text(`SALDO A TRANSFERIR: $${(totals.saldo || 0).toFixed(2)}`, 25, y);
  } else {
    doc.text(`Cantidad de Envíos: ${totals.cantidadEnvios || 0}`, 25, y);
    y += 7;
    doc.setFontSize(13);
    doc.text(`MONTO TOTAL: $${(totals.montoTotal || 0).toFixed(2)}`, 25, y);
  }
  y += 15;

  // Detalle de envíos
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLE DE ENVÍOS', 20, y);
  y += 8;

  // Headers de tabla
  doc.setFontSize(9);
  doc.setFillColor(230, 230, 230);
  doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
  doc.text('Tracking', 22, y);
  doc.text('Fecha', 70, y);
  doc.text('Destinatario', 100, y);
  doc.text('Monto', 160, y);
  y += 8;

  doc.setFont('helvetica', 'normal');

  items.forEach((item, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(20, y - 4, pageWidth - 40, 7, 'F');
    }

    doc.text(item.tracking.substring(0, 20), 22, y);
    doc.text(item.fecha, 70, y);
    doc.text(item.destinatario.substring(0, 25), 100, y);
    doc.text(`$${item.monto.toFixed(2)}`, 160, y);
    y += 7;
  });

  // Footer
  y = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, y, { align: 'center' });

  // Guardar
  const fileName = isBranch 
    ? `liquidacion-sucursal-${entityName.replace(/\s+/g, '-')}-${format(new Date(settlement.periodo_fin), 'yyyy-MM-dd')}.pdf`
    : `liquidacion-chofer-${entityName.replace(/\s+/g, '-')}-${format(new Date(settlement.periodo_fin), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
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
}): Promise<void> {
  // Fetch comisiones
  const { data: comisiones } = await supabase
    .from('comisiones')
    .select(`
      *,
      envio:envios(tracking_number, estado, created_at, precio_total, destinatario_id, 
        clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
    `)
    .eq('liquidacion_id', liquidacion.id)
    .order('created_at', { ascending: false });

  const items = (comisiones || []).map((c: any) => ({
    tracking: c.envio?.tracking_number || '-',
    fecha: c.envio?.created_at ? format(new Date(c.envio.created_at), 'dd/MM/yy') : '-',
    destinatario: c.envio?.clientes 
      ? `${c.envio.clientes.nombre || ''} ${c.envio.clientes.apellido || ''}`.trim() 
      : '-',
    monto: c.monto || 0,
  }));

  generateSettlementPDF({
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
  });
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
}): Promise<void> {
  // Fetch detalles
  const { data: detalles } = await supabase
    .from('liquidacion_sucursal_detalles')
    .select(`
      *,
      envio:envios(tracking_number, estado, created_at, destinatario_id, 
        clientes:clientes!envios_destinatario_id_fkey(nombre, apellido))
    `)
    .eq('liquidacion_id', liquidacion.id)
    .order('created_at', { ascending: false });

  const items = (detalles || []).map((d: any) => ({
    tracking: d.envio?.tracking_number || '-',
    fecha: d.envio?.created_at ? format(new Date(d.envio.created_at), 'dd/MM/yy') : '-',
    destinatario: d.envio?.clientes 
      ? `${d.envio.clientes.nombre || ''} ${d.envio.clientes.apellido || ''}`.trim() 
      : '-',
    monto: d.monto_envio || 0,
    comision: d.comision_aplicada || 0,
  }));

  generateSettlementPDF({
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
  });
}
