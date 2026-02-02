import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MercadoLibre OAuth URLs
const ML_AUTH_URL = 'https://auth.mercadolibre.com.ar/authorization';
const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const ML_USER_URL = 'https://api.mercadolibre.com/users/me';

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
        return new Response(
          JSON.stringify({ error: 'seller_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get seller to find tenant_id
      const { data: seller, error: sellerError } = await supabase
        .from('ecommerce_sellers')
        .select('tenant_id')
        .eq('id', sellerId)
        .single();

      if (sellerError || !seller) {
        console.error('[ML OAuth] Seller not found:', sellerError);
        return new Response(
          JSON.stringify({ error: 'Seller not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get ML credentials from system_integrations
      const { data: integration, error: intError } = await supabase
        .from('system_integrations')
        .select('config')
        .eq('tenant_id', seller.tenant_id)
        .eq('integration_type', 'mercado_libre')
        .eq('is_active', true)
        .single();

      if (intError || !integration?.config) {
        console.error('[ML OAuth] Integration config not found:', intError);
        return new Response(
          JSON.stringify({ error: 'MercadoLibre integration not configured for this tenant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const config = integration.config as Record<string, string>;
      const clientId = config.client_id;
      const redirectUri = config.redirect_uri || `${supabaseUrl}/functions/v1/mercadolibre-oauth/callback`;

      if (!clientId) {
        return new Response(
          JSON.stringify({ error: 'MercadoLibre client_id not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
        return new Response(
          generateHtmlResponse(false, `Error de autorización: ${error}`),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
      }

      if (!code || !state) {
        return new Response(
          generateHtmlResponse(false, 'Missing code or state parameter'),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
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
        return new Response(
          generateHtmlResponse(false, 'Seller not found'),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
      }

      // Get ML credentials
      const { data: integration } = await supabase
        .from('system_integrations')
        .select('config')
        .eq('tenant_id', seller.tenant_id)
        .eq('integration_type', 'mercado_libre')
        .eq('is_active', true)
        .single();

      if (!integration?.config) {
        return new Response(
          generateHtmlResponse(false, 'MercadoLibre integration not configured'),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
      }

      const config = integration.config as Record<string, string>;
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
        return new Response(
          generateHtmlResponse(false, 'Error al obtener tokens de MercadoLibre'),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
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
        return new Response(
          generateHtmlResponse(false, 'Error al guardar conexión'),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
      }

      console.log('[ML OAuth] Seller updated successfully');

      return new Response(
        generateHtmlResponse(true, 'Conexión exitosa con MercadoLibre'),
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
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

      // Get ML credentials
      const { data: integration } = await supabase
        .from('system_integrations')
        .select('config')
        .eq('tenant_id', seller.tenant_id)
        .eq('integration_type', 'mercado_libre')
        .eq('is_active', true)
        .single();

      if (!integration?.config) {
        return new Response(
          JSON.stringify({ error: 'MercadoLibre integration not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const config = integration.config as Record<string, string>;

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

    return new Response(
      JSON.stringify({ error: 'Unknown endpoint' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ML OAuth] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateHtmlResponse(success: boolean, message: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? 'Conexión Exitosa' : 'Error'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: ${success ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8d7da'};
    }
    .container {
      text-align: center;
      background: white;
      padding: 3rem;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      max-width: 400px;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      color: ${success ? '#10b981' : '#dc3545'};
      margin-bottom: 1rem;
    }
    p {
      color: #6b7280;
      margin-bottom: 1.5rem;
    }
    .close-btn {
      background: ${success ? '#10b981' : '#dc3545'};
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <h1>${success ? '¡Conectado!' : 'Error'}</h1>
    <p>${message}</p>
    <button class="close-btn" onclick="closeWindow()">Cerrar</button>
  </div>
  <script>
    function closeWindow() {
      if (window.opener) {
        window.opener.postMessage({ type: 'mercadolibre-oauth-${success ? 'success' : 'error'}' }, '*');
      }
      window.close();
    }
    // Auto-close after 3 seconds on success
    ${success ? 'setTimeout(closeWindow, 3000);' : ''}
  </script>
</body>
</html>
  `;
}
