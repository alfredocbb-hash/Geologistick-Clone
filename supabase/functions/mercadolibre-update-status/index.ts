import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ML_API_BASE = 'https://api.mercadolibre.com';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token if provided
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: claims } = await supabase.auth.getUser(token);
      userId = claims?.user?.id || null;
    }

    const body = await req.json();
    const { envio_id, estado } = body;

    if (!envio_id || !estado) {
      return new Response(
        JSON.stringify({ error: 'envio_id and estado are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ML Update] Processing:', { envio_id, estado });

    // Get envio with ML shipment ID
    const { data: envio, error: envioError } = await supabase
      .from('envios')
      .select('*, tenant_id')
      .eq('id', envio_id)
      .single();

    if (envioError || !envio) {
      console.error('[ML Update] Envio not found:', envioError);
      return new Response(
        JSON.stringify({ error: 'Shipment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is an ML shipment
    if (!envio.ml_shipment_id) {
      console.log('[ML Update] Not an ML shipment, skipping sync');
      return new Response(
        JSON.stringify({ message: 'Not a MercadoLibre shipment', synced: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get status mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('ml_status_mapping')
      .select('ml_status, ml_substatus')
      .eq('estado_interno', estado)
      .single();

    if (mappingError || !mapping) {
      console.log('[ML Update] No mapping found for estado:', estado);
      return new Response(
        JSON.stringify({ message: 'No ML mapping for this status', synced: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ML Update] Status mapping:', mapping);

    // Find seller for this tenant with ML connection
    const { data: seller, error: sellerError } = await supabase
      .from('ecommerce_sellers')
      .select('*')
      .eq('tenant_id', envio.tenant_id)
      .eq('plataforma', 'mercadolibre')
      .eq('activo', true)
      .not('access_token', 'is', null)
      .limit(1)
      .single();

    if (sellerError || !seller) {
      console.error('[ML Update] No connected ML seller found');
      
      // Update envio sync status to error
      await supabase
        .from('envios')
        .update({
          ml_sync_status: 'error',
          ml_last_sync_at: new Date().toISOString(),
        })
        .eq('id', envio_id);

      return new Response(
        JSON.stringify({ error: 'No connected MercadoLibre seller found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(supabase, seller);
    if (!accessToken) {
      console.error('[ML Update] Could not get valid access token');
      
      await supabase
        .from('envios')
        .update({
          ml_sync_status: 'error',
          ml_last_sync_at: new Date().toISOString(),
        })
        .eq('id', envio_id);

      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build update payload
    const updatePayload: Record<string, string> = {
      status: mapping.ml_status,
    };
    if (mapping.ml_substatus) {
      updatePayload.substatus = mapping.ml_substatus;
    }

    console.log('[ML Update] Sending to ML API:', updatePayload);

    // Update shipment status in ML
    const mlResponse = await fetch(`${ML_API_BASE}/shipments/${envio.ml_shipment_id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    const mlResponseText = await mlResponse.text();
    console.log('[ML Update] ML API response:', mlResponse.status, mlResponseText);

    if (!mlResponse.ok) {
      // Some status transitions might not be allowed by ML
      // Log but don't fail the operation
      console.warn('[ML Update] ML API returned error:', mlResponseText);
      
      await supabase
        .from('envios')
        .update({
          ml_sync_status: 'error',
          ml_last_sync_at: new Date().toISOString(),
        })
        .eq('id', envio_id);

      return new Response(
        JSON.stringify({ 
          error: 'ML API rejected status update',
          details: mlResponseText,
          synced: false 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update envio sync status
    await supabase
      .from('envios')
      .update({
        ml_sync_status: 'synced',
        ml_last_sync_at: new Date().toISOString(),
      })
      .eq('id', envio_id);

    console.log('[ML Update] Successfully synced status to ML');

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: true,
        ml_shipment_id: envio.ml_shipment_id,
        ml_status: mapping.ml_status,
        ml_substatus: mapping.ml_substatus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ML Update] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper to get valid access token, refreshing if needed
async function getValidAccessToken(supabase: any, seller: any): Promise<string | null> {
  const now = new Date();
  const expiresAt = seller.token_expires_at ? new Date(seller.token_expires_at) : null;

  // Check if token is expired or about to expire (5 min buffer)
  if (expiresAt && expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return seller.access_token;
  }

  console.log('[ML Update] Token expired, refreshing...');

  // Get ML credentials
  const { data: integration } = await supabase
    .from('system_integrations')
    .select('config')
    .eq('tenant_id', seller.tenant_id)
    .eq('integration_type', 'mercado_libre')
    .eq('is_active', true)
    .single();

  if (!integration?.config) {
    console.error('[ML Update] No integration config found');
    return null;
  }

  const config = integration.config as Record<string, string>;

  // Refresh token
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

  if (!tokenResponse.ok) {
    console.error('[ML Update] Token refresh failed');
    return null;
  }

  const tokenData = await tokenResponse.json();

  // Update seller with new tokens
  const newExpiresAt = new Date();
  newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in);

  await supabase
    .from('ecommerce_sellers')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', seller.id);

  return tokenData.access_token;
}
