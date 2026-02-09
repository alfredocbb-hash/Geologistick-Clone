import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get shipment_id from query params
    const url = new URL(req.url);
    const shipmentId = url.searchParams.get('shipment_id');

    if (!shipmentId) {
      return new Response(
        JSON.stringify({ error: 'shipment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the envio with this ML shipment ID
    const { data: envio, error: envioError } = await supabase
      .from('envios')
      .select('tenant_id')
      .eq('ml_shipment_id', parseInt(shipmentId))
      .maybeSingle();

    if (envioError || !envio) {
      return new Response(
        JSON.stringify({ error: 'Envío no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find ML seller for this tenant
    const { data: seller } = await supabase
      .from('ecommerce_sellers')
      .select('*')
      .eq('tenant_id', envio.tenant_id)
      .eq('plataforma', 'mercadolibre')
      .eq('activo', true)
      .not('access_token', 'is', null)
      .limit(1)
      .single();

    if (!seller) {
      return new Response(
        JSON.stringify({ error: 'No hay seller ML conectado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get valid access token (refresh if needed)
    let accessToken = seller.access_token;
    const tokenExpiresAt = seller.token_expires_at ? new Date(seller.token_expires_at) : null;
    const now = new Date();

    if (!accessToken || (tokenExpiresAt && tokenExpiresAt < now)) {
      const { data: credentials } = await supabase
        .from('system_integrations')
        .select('config_key, config_value')
        .eq('tenant_id', seller.tenant_id)
        .eq('integration_type', 'mercadolibre')
        .in('config_key', ['client_id', 'client_secret']);

      const credMap = Object.fromEntries((credentials || []).map((c: any) => [c.config_key, c.config_value]));

      if (!credMap.client_id || !credMap.client_secret || !seller.refresh_token) {
        return new Response(
          JSON.stringify({ error: 'Credenciales ML no disponibles' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: credMap.client_id,
          client_secret: credMap.client_secret,
          refresh_token: seller.refresh_token,
        }),
      });

      if (!tokenResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Error al renovar token ML' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;

      await supabase
        .from('ecommerce_sellers')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', seller.id);
    }

    // Fetch label PDF from ML API
    const labelResponse = await fetch(
      `https://api.mercadolibre.com/shipment_labels?shipment_ids=${shipmentId}&response_type=pdf`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!labelResponse.ok) {
      const errorText = await labelResponse.text();
      console.error('[ML Label] API error:', labelResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Error al obtener etiqueta de ML' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stream the PDF back to the client
    const pdfBuffer = await labelResponse.arrayBuffer();
    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="etiqueta-ML-${shipmentId}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[ML Label] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
