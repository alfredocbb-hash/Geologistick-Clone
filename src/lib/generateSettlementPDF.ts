import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDateString } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';

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
    estado: string;
    precio: number;
  }>;
}

export function generateSettlementPDF(data: SettlementPDFData): void {
  const { type, settlement, entityName, totals, items, shipments } = data;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;
  const isBranch = type === 'branch';
  const isSeller = type === 'seller';

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const title = isSeller 
    ? 'LIQUIDACIÓN DE SELLER' 
    : isBranch 
      ? 'LIQUIDACIÓN DE SUCURSAL' 
      : 'LIQUIDACIÓN DE CHOFER';
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Info general
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const entityLabel = isSeller ? 'Seller' : isBranch ? 'Sucursal' : 'Chofer';
  doc.text(`${entityLabel}: ${entityName}`, 20, y);
  y += 7;

  doc.text(`Período: ${format(parseDateString(settlement.periodo_inicio), 'dd/MM/yyyy')} - ${format(parseDateString(settlement.periodo_fin), 'dd/MM/yyyy')}`, 20, y);
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
  const totalsHeight = isSeller ? 32 : 25;
  doc.rect(20, y, pageWidth - 40, totalsHeight, 'F');
  y += 8;

  doc.setFont('helvetica', 'bold');
  if (isSeller && totals.totalCargos !== undefined) {
    doc.text(`Cantidad de Movimientos: ${totals.cantidadMovimientos || 0}`, 25, y);
    y += 7;
    doc.text(`Total Cargos: $${(totals.totalCargos || 0).toFixed(2)}`, 25, y);
    y += 7;
    doc.text(`Total Pagos: $${(totals.totalPagos || 0).toFixed(2)}`, 25, y);
    y += 7;
    doc.setFontSize(13);
    doc.text(`SALDO DEL PERÍODO: $${(totals.saldo || 0).toFixed(2)}`, 25, y);
  } else if (isBranch && totals.totalCobrado !== undefined) {
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

  // Detalle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(isSeller ? 'DETALLE DE MOVIMIENTOS' : 'DETALLE DE ENVÍOS', 20, y);
  y += 8;

  // Headers de tabla
  doc.setFontSize(9);
  doc.setFillColor(230, 230, 230);
  doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
  
  if (isSeller) {
    doc.text('Fecha', 22, y);
    doc.text('Tipo', 55, y);
    doc.text('Descripción', 85, y);
    doc.text('Monto', 160, y);
  } else {
    doc.text('Tracking', 22, y);
    doc.text('Fecha', 70, y);
    doc.text('Destinatario', 100, y);
    doc.text('Monto', 160, y);
  }
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

    if (isSeller) {
      doc.text(item.fecha, 22, y);
      doc.text((item.tipo || '-').substring(0, 12), 55, y);
      doc.text((item.descripcion || '-').substring(0, 35), 85, y);
      const montoText = item.tipo === 'cargo' ? `+$${item.monto.toFixed(2)}` : `-$${Math.abs(item.monto).toFixed(2)}`;
      doc.text(montoText, 160, y);
    } else {
      doc.text((item.tracking || '-').substring(0, 20), 22, y);
      doc.text(item.fecha, 70, y);
      doc.text((item.destinatario || '-').substring(0, 25), 100, y);
      doc.text(`$${item.monto.toFixed(2)}`, 160, y);
    }
    y += 7;
  });

  // Shipments section for seller
  if (isSeller && shipments && shipments.length > 0) {
    y += 10;
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DE ENVÍOS', 20, y);
    y += 8;

    // Shipments table header
    doc.setFontSize(9);
    doc.setFillColor(230, 230, 230);
    doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
    doc.text('Fecha', 22, y);
    doc.text('Tracking', 50, y);
    doc.text('Destinatario', 95, y);
    doc.text('Estado', 140, y);
    doc.text('Precio', 170, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    let totalEnvios = 0;

    shipments.forEach((shipment, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(20, y - 4, pageWidth - 40, 7, 'F');
      }

      doc.text(shipment.fecha, 22, y);
      doc.text(shipment.tracking.substring(0, 18), 50, y);
      doc.text(shipment.destinatario.substring(0, 20), 95, y);
      doc.text(shipment.estado.substring(0, 12), 140, y);
      doc.text(`$${shipment.precio.toFixed(2)}`, 170, y);
      totalEnvios += shipment.precio;
      y += 7;
    });

    // Subtotal de envíos
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total Envíos (${shipments.length}): $${totalEnvios.toFixed(2)}`, 120, y);
    y += 7;
  }

  // Guardar
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
}): Promise<void> {
  // Fetch movimientos vinculados
  const [{ data: movimientos }, { data: envios }] = await Promise.all([
    supabase
      .from('seller_cuenta_corriente')
      .select('*')
      .eq('liquidacion_id', liquidacion.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('envios')
      .select('id, tracking_number, nombre_destinatario, precio_total, estado, created_at')
      .eq('liquidacion_seller_id', liquidacion.id)
      .order('created_at', { ascending: true }),
  ]);

  const items = (movimientos || []).map((m: any) => ({
    fecha: m.created_at ? format(new Date(m.created_at), 'dd/MM/yy') : '-',
    tipo: m.tipo || '-',
    descripcion: m.descripcion || m.referencia || '-',
    monto: m.monto || 0,
  }));

  const shipmentItems = (envios || []).map((e: any) => ({
    tracking: e.tracking_number || '-',
    fecha: e.created_at ? format(new Date(e.created_at), 'dd/MM/yy') : '-',
    destinatario: e.nombre_destinatario || '-',
    estado: e.estado || '-',
    precio: e.precio_total || 0,
  }));

  generateSettlementPDF({
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
      cantidadMovimientos: liquidacion.cantidad_movimientos || items.length,
    },
    items,
    shipments: shipmentItems,
  });
}
