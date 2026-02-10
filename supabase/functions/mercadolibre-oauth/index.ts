import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MercadoLibre OAuth URLs
const ML_AUTH_URL = 'https://auth.mercadolibre.com.ar/authorization';
const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const ML_USER_URL = 'https://api.mercadolibre.com/users/me';
const FRONTEND_URL = 'https://geologic.lovable.app';

function redirectSuccess(sellerId: string) {
  const url = `${FRONTEND_URL}/oauth/mercadolibre/result?status=success&seller_id=${encodeURIComponent(sellerId)}`;
  return Response.redirect(url, 302);
}

function redirectError(title: string, message: string) {
  const url = `${FRONTEND_URL}/oauth/mercadolibre/result?status=error&title=${encodeURIComponent(title)}&message=${encodeURIComponent(message)}`;
  return Response.redirect(url, 302);
}

// Helper to get integration config as object from key-value rows
async function getIntegrationConfig(
  supabase: any,
  tenantId: string
): Promise<Record<string, string> | null> {
  const { data, error } = await supabase
    .from('system_integrations')
    .select('config_key, config_value')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'mercadolibre')
    .eq('is_active', true);

  if (error || !data || data.length === 0) {
    console.error('[ML OAuth] Config query error:', error);
    return null;
  }

  // Convert key-value rows to object
  const config: Record<string, string> = {};
  for (const row of data) {
    config[row.config_key] = row.config_value;
  }
  return config;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // =====================================================
    // AUTHORIZE ENDPOINT - Redirect to ML OAuth
    // =====================================================
    if (path === 'authorize') {
      const sellerId = url.searchParams.get('seller_id');
      
      if (!sellerId) {
        return redirectError('Enlace inválido', 'Por favor solicita un nuevo enlace de conexión a tu proveedor logístico.');
      }

      // Get seller to find tenant_id
      const { data: seller, error: sellerError } = await supabase
        .from('ecommerce_sellers')
        .select('tenant_id')
        .eq('id', sellerId)
        .single();

      if (sellerError || !seller) {
        console.error('[ML OAuth] Seller not found:', sellerError);
        return redirectError('Tienda no encontrada', 'No pudimos encontrar tu tienda. Por favor contacta a tu proveedor logístico para obtener un nuevo enlace.');
      }

      // Get ML credentials from system_integrations (key-value schema)
      const config = await getIntegrationConfig(supabase, seller.tenant_id);

      if (!config || !config.client_id) {
        console.error('[ML OAuth] Integration config not found for tenant:', seller.tenant_id);
        return redirectError('Integración no configurada', 'La integración con MercadoLibre aún no está configurada. Por favor contacta a tu proveedor logístico.');
      }

      const clientId = config.client_id;
      const redirectUri = config.redirect_uri || `${supabaseUrl}/functions/v1/mercadolibre-oauth/callback`;

      // Build OAuth URL
      const authUrl = new URL(ML_AUTH_URL);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', sellerId);

      console.log('[ML OAuth] Redirecting to:', authUrl.toString());

      return Response.redirect(authUrl.toString(), 302);
    }

    // =====================================================
    // CALLBACK ENDPOINT - Exchange code for tokens
    // =====================================================
    if (path === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state'); // seller_id
      const error = url.searchParams.get('error');

      if (error) {
        console.error('[ML OAuth] Error from ML:', error);
        return redirectError('Error de autorización', error);
      }

      if (!code || !state) {
        return redirectError('Parámetros faltantes', 'Faltan parámetros necesarios para completar la conexión.');
      }

      const sellerId = state;

      // Get seller to find tenant_id
      const { data: seller, error: sellerError } = await supabase
        .from('ecommerce_sellers')
        .select('tenant_id')
        .eq('id', sellerId)
        .single();

      if (sellerError || !seller) {
        console.error('[ML OAuth] Seller not found:', sellerError);
        return redirectError('Tienda no encontrada', 'No se encontró la tienda asociada.');
      }

      // Get ML credentials (key-value schema)
      const config = await getIntegrationConfig(supabase, seller.tenant_id);

      if (!config || !config.client_id || !config.client_secret) {
        return redirectError('Configuración faltante', 'La integración con MercadoLibre no está configurada correctamente.');
      }

      const clientId = config.client_id;
      const clientSecret = config.client_secret;
      const redirectUri = config.redirect_uri || `${supabaseUrl}/functions/v1/mercadolibre-oauth/callback`;

      // Exchange code for tokens
      console.log('[ML OAuth] Exchanging code for tokens...');
      const tokenResponse = await fetch(ML_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('[ML OAuth] Token exchange failed:', errorText);
        return redirectError('Error de tokens', 'Error al obtener tokens de MercadoLibre.');
      }

      const tokenData = await tokenResponse.json();
      console.log('[ML OAuth] Token received, user_id:', tokenData.user_id);

      // Get user info
      const userResponse = await fetch(ML_USER_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      
      let mlUserId = tokenData.user_id;
      if (userResponse.ok) {
        const userData = await userResponse.json();
        mlUserId = userData.id;
        console.log('[ML OAuth] User info:', userData.nickname);
      }

      // Calculate token expiration
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      // Update seller with tokens
      const { error: updateError } = await supabase
        .from('ecommerce_sellers')
        .update({
          store_id: String(mlUserId),
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          plataforma: 'mercadolibre',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sellerId);

      if (updateError) {
        console.error('[ML OAuth] Error updating seller:', updateError);
        return redirectError('Error al guardar', 'Error al guardar la conexión con MercadoLibre.');
      }

      console.log('[ML OAuth] Seller updated successfully');

      return redirectSuccess(sellerId);
    }

    // =====================================================
    // REFRESH TOKEN ENDPOINT
    // =====================================================
    if (path === 'refresh' && req.method === 'POST') {
      const body = await req.json();
      const { seller_id } = body;

      if (!seller_id) {
        return new Response(
          JSON.stringify({ error: 'seller_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get seller
      const { data: seller, error: sellerError } = await supabase
        .from('ecommerce_sellers')
        .select('tenant_id, refresh_token')
        .eq('id', seller_id)
        .single();

      if (sellerError || !seller?.refresh_token) {
        return new Response(
          JSON.stringify({ error: 'Seller not found or no refresh token' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get ML credentials (key-value schema)
      const config = await getIntegrationConfig(supabase, seller.tenant_id);

      if (!config || !config.client_id || !config.client_secret) {
        return new Response(
          JSON.stringify({ error: 'MercadoLibre integration not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Refresh token
      const tokenResponse = await fetch(ML_TOKEN_URL, {
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
        const errorText = await tokenResponse.text();
        console.error('[ML OAuth] Token refresh failed:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to refresh token' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await tokenResponse.json();

      // Calculate token expiration
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      // Update seller
      await supabase
        .from('ecommerce_sellers')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', seller_id);

      return new Response(
        JSON.stringify({ success: true, expires_at: expiresAt.toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return redirectError('Página no encontrada', 'Verifica el enlace e intenta nuevamente.');

  } catch (error) {
    console.error('[ML OAuth] Error:', error);
    return redirectError('Error inesperado', 'Ocurrió un error inesperado procesando la conexión. Por favor intenta nuevamente.');
  }
});
