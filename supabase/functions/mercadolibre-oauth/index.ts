import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MercadoLibre OAuth URLs
const ML_AUTH_URL = 'https://auth.mercadolibre.com.ar/authorization';
const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const ML_USER_URL = 'https://api.mercadolibre.com/users/me';

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

      // Get ML credentials from system_integrations (key-value schema)
      const config = await getIntegrationConfig(supabase, seller.tenant_id);

      if (!config || !config.client_id) {
        console.error('[ML OAuth] Integration config not found for tenant:', seller.tenant_id);
        return new Response(
          JSON.stringify({ error: 'MercadoLibre integration not configured for this tenant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        return new Response(
          generateHtmlResponse(false, `Error de autorización: ${error}`, ''),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      if (!code || !state) {
        return new Response(
          generateHtmlResponse(false, 'Missing code or state parameter', ''),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
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
          generateHtmlResponse(false, 'Seller not found', ''),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      // Get ML credentials (key-value schema)
      const config = await getIntegrationConfig(supabase, seller.tenant_id);

      if (!config || !config.client_id || !config.client_secret) {
        return new Response(
          generateHtmlResponse(false, 'MercadoLibre integration not configured', ''),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
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
        return new Response(
          generateHtmlResponse(false, 'Error al obtener tokens de MercadoLibre', ''),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
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
          generateHtmlResponse(false, 'Error al guardar conexión', ''),
          { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }

      console.log('[ML OAuth] Seller updated successfully');

      return new Response(
        generateHtmlResponse(true, 'Conexión exitosa con MercadoLibre', sellerId),
        { headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
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

function generateHtmlResponse(success: boolean, message: string, sellerId: string): string {
  if (success) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conexión Exitosa - MercadoLibre</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center; 
      min-height: 100vh; padding: 20px;
      background: linear-gradient(135deg, #FFF159 0%, #FFE600 100%);
    }
    .card { 
      background: white; padding: 48px 40px; border-radius: 20px; 
      text-align: center; box-shadow: 0 25px 80px rgba(0,0,0,0.15);
      max-width: 440px; width: 100%;
      animation: slideUp 0.6s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .platform-logo { margin-bottom: 24px; }
    .platform-logo svg { width: 180px; height: auto; }
    .success-icon { 
      font-size: 72px; margin-bottom: 16px;
      animation: bounce 0.6s ease-out 0.3s both;
    }
    @keyframes bounce {
      0% { transform: scale(0); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }
    h1 { color: #1a1a1a; margin-bottom: 16px; font-size: 28px; font-weight: 700; }
    .message { color: #4b5563; font-size: 16px; line-height: 1.7; margin-bottom: 28px; }
    .divider { 
      height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
      margin: 24px 0;
    }
    .thanks { 
      background: linear-gradient(135deg, #f0fdf4, #dcfce7);
      padding: 20px; border-radius: 12px; margin-bottom: 24px;
    }
    .thanks-title { color: #166534; font-weight: 600; margin-bottom: 8px; font-size: 16px; }
    .thanks-text { color: #15803d; font-size: 14px; line-height: 1.6; }
    .hint { font-size: 13px; color: #9ca3af; margin-top: 20px; }
    .loader { 
      width: 28px; height: 28px; 
      border: 3px solid #e5e7eb; border-top-color: #FFE600;
      border-radius: 50%; animation: spin 1s linear infinite;
      margin: 16px auto 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="platform-logo">
      <svg viewBox="0 0 134 34" xmlns="http://www.w3.org/2000/svg">
        <path fill="#FFE600" d="M67 0C52.8 0 41.5 7.6 41.5 17s11.3 17 25.5 17 25.5-7.6 25.5-17S81.2 0 67 0z"/>
        <path fill="#2D3277" d="M67.1 6.5c-9.1 0-16.4 4.7-16.4 10.5s7.4 10.5 16.4 10.5c9.1 0 16.4-4.7 16.4-10.5S76.1 6.5 67.1 6.5zm-5.7 12.7c-1.4 0-2.5-1.4-2.5-3.1s1.1-3.1 2.5-3.1 2.5 1.4 2.5 3.1-1.2 3.1-2.5 3.1zm11.3 0c-1.4 0-2.5-1.4-2.5-3.1s1.1-3.1 2.5-3.1 2.5 1.4 2.5 3.1-1.1 3.1-2.5 3.1z"/>
        <path fill="#2D3277" d="M7.4 17.8V26H3.1v-5.2H0V17h3.1v-3.2c0-3.7 2-5.8 5.7-5.8 1 0 2.1.2 2.8.4v3.5c-.5-.2-1.2-.3-1.9-.3-1.6 0-2.3.8-2.3 2.5v3h3.8v3.7H7.4zm13.7-9.4l-.1 3.3c-.4-.1-1-.1-1.3-.1-2.2 0-3.5 1.2-3.5 4V26h-4.1V8.6h3.9v2.5c.8-1.8 2.3-2.8 4.2-2.8.4 0 .7 0 .9.1zm10.7 15c-.9 1.7-2.8 2.9-5.3 2.9-4.3 0-7.3-3.2-7.3-8.2 0-4.8 3-8.4 7.3-8.4 2.5 0 4.3 1.2 5.2 2.9V10h4.1v16h-4v-2.6zm-4.2-.1c2.3 0 4.1-1.9 4.1-4.9 0-3.1-1.8-4.9-4.1-4.9s-4 1.8-4 4.9c0 3 1.7 4.9 4 4.9z"/>
        <path fill="#2D3277" d="M129.4 23.4c-.9 1.7-2.8 2.9-5.3 2.9-4.3 0-7.3-3.2-7.3-8.2 0-4.8 3-8.4 7.3-8.4 2.5 0 4.3 1.2 5.2 2.9V10h4.1v16h-4v-2.6zm-4.2-.1c2.3 0 4.1-1.9 4.1-4.9 0-3.1-1.8-4.9-4.1-4.9s-4 1.8-4 4.9c0 3 1.7 4.9 4 4.9zm-16.6.5c2.2 0 3.6-1 4.1-2.8h4.4c-.6 3.8-3.8 6.3-8.5 6.3-5.4 0-8.8-3.6-8.8-8.8 0-5.2 3.4-8.8 8.8-8.8 4.7 0 7.9 2.5 8.5 6.3h-4.4c-.5-1.8-1.9-2.8-4.1-2.8-2.8 0-4.5 2.1-4.5 5.3 0 3.2 1.7 5.3 4.5 5.3z"/>
        <path fill="#2D3277" d="M96.2 9.8c4.9 0 8.4 3.6 8.4 8.6 0 5-3.5 8.6-8.4 8.6s-8.4-3.6-8.4-8.6c0-5 3.5-8.6 8.4-8.6zm0 13.5c2.6 0 4.2-2 4.2-4.9s-1.6-4.9-4.2-4.9-4.2 2-4.2 4.9 1.6 4.9 4.2 4.9z"/>
      </svg>
    </div>
    <div class="success-icon">✅</div>
    <h1>¡Conexión Exitosa!</h1>
    <p class="message">
      Tu tienda de <strong>MercadoLibre</strong> se ha vinculado 
      correctamente con el sistema de envíos.
    </p>
    <div class="divider"></div>
    <div class="thanks">
      <div class="thanks-title">🎉 ¡Gracias por confiar en nosotros!</div>
      <div class="thanks-text">
        A partir de ahora, recibirás tus pedidos automáticamente 
        y podrás gestionar tus envíos de forma sencilla.
      </div>
    </div>
    <p class="hint">Esta ventana se cerrará automáticamente...</p>
    <div class="loader"></div>
  </div>
  <script>
    setTimeout(function() {
      if (window.opener) {
        window.opener.postMessage({ 
          type: 'mercadolibre-oauth-success', 
          sellerId: '${sellerId}' 
        }, '*');
      }
      window.close();
    }, 4000);
  </script>
</body>
</html>`;
  }
  
  // Error page
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - MercadoLibre</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center; 
      min-height: 100vh; padding: 20px;
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    }
    .card { 
      background: white; padding: 48px 40px; border-radius: 20px; 
      text-align: center; box-shadow: 0 25px 80px rgba(0,0,0,0.1);
      max-width: 440px; width: 100%;
      animation: slideUp 0.6s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .error-icon { font-size: 72px; margin-bottom: 16px; }
    h1 { color: #dc2626; margin-bottom: 16px; font-size: 28px; font-weight: 700; }
    .message { color: #4b5563; font-size: 16px; line-height: 1.7; margin-bottom: 28px; }
    .close-btn {
      background: #dc2626; color: white; border: none;
      padding: 14px 32px; border-radius: 10px; cursor: pointer;
      font-size: 16px; font-weight: 500; transition: background 0.2s;
    }
    .close-btn:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="card">
    <div class="error-icon">❌</div>
    <h1>Error de Conexión</h1>
    <p class="message">${message}</p>
    <button class="close-btn" onclick="closeWindow()">Cerrar Ventana</button>
  </div>
  <script>
    function closeWindow() {
      if (window.opener) {
        window.opener.postMessage({ type: 'mercadolibre-oauth-error' }, '*');
      }
      window.close();
    }
  </script>
</body>
</html>`;
}
