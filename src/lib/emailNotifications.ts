import { supabase } from '@/integrations/supabase/client';

/**
 * Fire-and-forget email notification via the tenant's SMTP config.
 * Silently catches errors — never blocks the calling flow.
 */
export async function sendShipmentEmail(params: {
  tenant_id: string;
  to: string;
  template: 'status_change' | 'shipment_created';
  data: Record<string, unknown>;
}) {
  try {
    await supabase.functions.invoke('send-tenant-email', { body: params });
  } catch (e) {
    console.error('[EmailNotification] Error sending email:', e);
  }
}

/** States that trigger an email notification on status change */
export const EMAIL_NOTIFY_STATES = [
  'en_sucursal',
  'en_reparto',
  'entregado',
  'devuelto',
] as const;
