// Labels & helpers for MercadoLibre shipment substatuses.
// Single source of truth — used by history view, badges and listings.

export const ML_SUBSTATUS_LABELS: Record<string, string> = {
  rescheduled: 'Reprogramado',
  rescheduled_by_buyer: 'Reprogramado por comprador',
  rescheduled_by_meli: 'Reprogramado por ML',
  returning_to_hub: 'Volviendo a centro',
  returning_to_sender: 'Volviendo al remitente',
  second_visit: 'Segunda visita',
  ready_to_print: 'Listo para imprimir',
  printed: 'Etiqueta impresa',
  in_hub: 'En centro de distribución',
  waiting_for_withdrawal: 'Esperando retiro',
  receiver_absent: 'Destinatario ausente',
  buyer_refused: 'Rechazado por comprador',
  stolen: 'Robado',
  damaged: 'Dañado',
  lost: 'Extraviado',
  in_transit: 'En tránsito',
  out_for_delivery: 'En reparto',
  picked_up: 'Recogido',
};

// Substatuses worth surfacing as a badge in lists (anything operationally meaningful).
const NOTEWORTHY = new Set([
  'rescheduled',
  'rescheduled_by_meli',
  'rescheduled_by_buyer',
  'receiver_absent',
  'second_visit',
  'returning_to_hub',
  'returning_to_sender',
  'buyer_refused',
]);

const RESCHEDULED = new Set([
  'rescheduled',
  'rescheduled_by_meli',
  'rescheduled_by_buyer',
]);

export function getMLSubstatusLabel(substatus?: string | null): string | null {
  if (!substatus) return null;
  return ML_SUBSTATUS_LABELS[substatus] || substatus;
}

export function isNoteworthyMLSubstatus(substatus?: string | null): boolean {
  return !!substatus && NOTEWORTHY.has(substatus);
}

export function isRescheduledMLSubstatus(substatus?: string | null): boolean {
  return !!substatus && RESCHEDULED.has(substatus);
}
