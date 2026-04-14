import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ML_API_BASE = 'https://api.mercadolibre.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id || '94a9ea85-43c5-49ac-9bfa-86843072c2ce';

    console.log('[RecoverTimeframes] Starting for tenant:', tenantId);

    // 1. Get active ML sellers
    const { data: sellers, error: sellersErr } = await supabase
      .from('ecommerce_sellers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('plataforma', 'mercadolibre')
      .eq('activo', true);

    if (sellersErr || !sellers?.length) {
      return new Response(JSON.stringify({ error: 'No sellers found', detail: sellersErr }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[RecoverTimeframes] Found', sellers.length, 'sellers');

    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const results: any[] = [];

    for (const seller of sellers) {
      // 2. Get envíos without timeframe linked to this seller via ecommerce_orders
      const { data: orders } = await supabase
        .from('ecommerce_orders')
        .select('envio_id, ml_shipment_id')
        .eq('seller_id', seller.id)
        .not('envio_id', 'is', null)
        .not('ml_shipment_id', 'is', null);

      if (!orders?.length) {
        results.push({ seller: seller.nombre, total: 0, updated: 0, skipped: 0, errors: 0 });
        continue;
      }

      const envioIds = orders.map(o => o.envio_id).filter(Boolean);

      // Get envíos that are missing timeframe
      const { data: envios } = await supabase
        .from('envios')
        .select('id, ml_shipment_id, horario_entrega_desde')
        .in('id', envioIds)
        .is('horario_entrega_desde', null)
        .not('estado', 'in', '("entregado","cancelado","devuelto")');

      if (!envios?.length) {
        results.push({ seller: seller.nombre, total: 0, updated: 0, skipped: 0, errors: 0 });
        continue;
      }

      console.log(`[RecoverTimeframes] ${seller.nombre}: ${envios.length} envíos without timeframe`);

      // Get valid token
      const accessToken = await getValidAccessToken(supabase, seller);
      if (!accessToken) {
        console.error(`[RecoverTimeframes] No token for ${seller.nombre}`);
        results.push({ seller: seller.nombre, total: envios.length, updated: 0, skipped: 0, errors: envios.length, error: 'no_token' });
        totalErrors += envios.length;
        continue;
      }

      let sellerUpdated = 0;
      let sellerSkipped = 0;
      let sellerErrors = 0;

      for (const envio of envios) {
        try {
          const shipResp = await fetch(`${ML_API_BASE}/shipments/${envio.ml_shipment_id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!shipResp.ok) {
            console.error(`[RecoverTimeframes] ML API error for ${envio.ml_shipment_id}: ${shipResp.status}`);
            sellerErrors++;
            continue;
          }

          const shipment = await shipResp.json();
          const timeFrame = shipment.lead_time?.estimated_delivery_time?.time_frame;

          if (timeFrame?.from == null || timeFrame?.to == null) {
            sellerSkipped++;
            continue;
          }

          const fromHour = Math.floor(timeFrame.from);
          const fromMin = Math.round((timeFrame.from % 1) * 60);
          const toHour = Math.floor(timeFrame.to);
          const toMin = Math.round((timeFrame.to % 1) * 60);

          const horarioDesde = `${String(fromHour).padStart(2, '0')}:${String(fromMin).padStart(2, '0')}`;
          const horarioHasta = `${String(toHour).padStart(2, '0')}:${String(toMin).padStart(2, '0')}`;

          let horarioPreferido = 'cualquier_hora';
          if (toHour <= 13) horarioPreferido = 'manana';
          else if (fromHour >= 13 && toHour <= 20) horarioPreferido = 'tarde';
          else if (fromHour >= 20) horarioPreferido = 'noche';
          else if (fromHour >= 8 && toHour <= 21) horarioPreferido = 'comercial';

          const { error: updateErr } = await supabase
            .from('envios')
            .update({
              horario_entrega_desde: horarioDesde,
              horario_entrega_hasta: horarioHasta,
              horario_preferido_entrega: horarioPreferido,
            })
            .eq('id', envio.id);

          if (updateErr) {
            console.error(`[RecoverTimeframes] Update error for ${envio.id}:`, updateErr);
            sellerErrors++;
          } else {
            sellerUpdated++;
            console.log(`[RecoverTimeframes] Updated ${envio.ml_shipment_id}: ${horarioDesde}-${horarioHasta} (${horarioPreferido})`);
          }

          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`[RecoverTimeframes] Error for ${envio.ml_shipment_id}:`, err);
          sellerErrors++;
        }
      }

      totalUpdated += sellerUpdated;
      totalSkipped += sellerSkipped;
      totalErrors += sellerErrors;
      results.push({ seller: seller.nombre, total: envios.length, updated: sellerUpdated, skipped: sellerSkipped, errors: sellerErrors });
      console.log(`[RecoverTimeframes] ${seller.nombre}: updated=${sellerUpdated} skipped=${sellerSkipped} errors=${sellerErrors}`);
    }

    return new Response(JSON.stringify({
      success: true,
      summary: { totalUpdated, totalSkipped, totalErrors },
      details: results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[RecoverTimeframes] Fatal:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getValidAccessToken(supabase: any, seller: any): Promise<string | null> {
  const now = new Date();
  const expiresAt = seller.token_expires_at ? new Date(seller.token_expires_at) : null;

  if (seller.access_token && expiresAt && expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return seller.access_token;
  }

  if (!seller.refresh_token) return null;

  const { data: credentials } = await supabase
    .from('system_integrations')
    .select('config_key, config_value')
    .eq('tenant_id', seller.tenant_id)
    .eq('integration_type', 'mercadolibre')
    .in('config_key', ['client_id', 'client_secret']);

  const config: Record<string, string> = {};
  for (const row of credentials || []) config[row.config_key] = row.config_value;

  if (!config.client_id || !config.client_secret) return null;

  const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: seller.refresh_token,
    }),
  });

  if (!tokenResponse.ok) return null;

  const tokenData = await tokenResponse.json();
  const newExpiresAt = new Date();
  newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in);

  await supabase.from('ecommerce_sellers').update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: newExpiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', seller.id);

  seller.access_token = tokenData.access_token;
  seller.refresh_token = tokenData.refresh_token;
  seller.token_expires_at = newExpiresAt.toISOString();

  return tokenData.access_token;
}
