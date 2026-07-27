import { normalizePhoneAR } from '@/lib/phoneNormalize';
import { format } from 'date-fns';
import { parseDateString } from '@/lib/dateUtils';

export type SettlementTipo = 'seller' | 'chofer' | 'sucursal' | 'terciarizado' | 'partner';

const TIPO_LABEL: Record<SettlementTipo, string> = {
  seller: 'liquidación de eCommerce',
  chofer: 'liquidación de repartos',
  sucursal: 'liquidación de sucursal',
  terciarizado: 'liquidación de servicios',
  partner: 'liquidación de partner',
};

function saludoHorario(d: Date): string {
  const h = d.getHours();
  if (h >= 5 && h < 13) return 'Buenos días';
  if (h >= 13 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function cierreDia(d: Date): string {
  const day = d.getDay(); // 0=Dom .. 6=Sáb
  if (day === 1) return '¡Que tengas un excelente comienzo de semana!';
  if (day >= 2 && day <= 4) return '¡Que tengas un excelente día!';
  if (day === 5) return '¡Buen finde!';
  return '¡Que disfrutes el finde!';
}

function formatMonto(n: number | null | undefined): string {
  const v = Number(n || 0);
  return v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFecha(s?: string | null): string {
  if (!s) return '';
  try {
    return format(parseDateString(s), 'dd/MM/yyyy');
  } catch {
    return s;
  }
}

export interface BuildMessageParams {
  tipo: SettlementTipo;
  nombre?: string | null;
  periodoInicio?: string | null;
  periodoFin?: string | null;
  monto: number | null | undefined;
  now?: Date;
}

export function buildSettlementMessage({
  tipo,
  nombre,
  periodoInicio,
  periodoFin,
  monto,
  now = new Date(),
}: BuildMessageParams): string {
  const saludo = saludoHorario(now);
  const cierre = cierreDia(now);
  const nom = (nombre || '').trim();
  const abre = nom ? `${saludo}, ${nom} 👋` : `${saludo} 👋`;
  const periodo = periodoInicio && periodoFin
    ? ` del período ${formatFecha(periodoInicio)} al ${formatFecha(periodoFin)}`
    : '';
  return (
    `${abre}\n\n` +
    `Te adjunto la ${TIPO_LABEL[tipo]}${periodo}.\n\n` +
    `*Total: $${formatMonto(monto)}*\n\n` +
    `Aguardo comprobante de transferencia, ¡gracias! 😊\n\n` +
    `${cierre}`
  );
}

export interface SendParams extends BuildMessageParams {
  phone?: string | null;
  onDownloadPdf?: () => void | Promise<void>;
}

export async function sendSettlementViaWhatsApp(params: SendParams): Promise<boolean> {
  const normalized = normalizePhoneAR(params.phone || '');
  if (!normalized) return false;
  const message = buildSettlementMessage(params);
  try {
    if (params.onDownloadPdf) await params.onDownloadPdf();
  } catch {
    // no bloquear el envío si la descarga falla
  }
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
