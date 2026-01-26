import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIENDANUBE_API_BASE = "https://www.tiendanube.com";
const TIENDANUBE_API_ENDPOINT = "https://api.tiendanube.com/v1";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  // Extraer el sub-path de forma robusta (funciona con /functions/v1/tiendanube-oauth/authorize)
  const pathname = url.pathname;
  let path = "";
  if (pathname.endsWith("/authorize")) {
    path = "/authorize";
  } else if (pathname.endsWith("/callback")) {
    path = "/callback";
  } else if (pathname.endsWith("/tiendanube-oauth") || pathname.endsWith("/tiendanube-oauth/")) {
    path = "";
  }
  
  console.log("Request path:", pathname, "-> Parsed as:", path || "(root)");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Helper function for friendly error pages
    const errorPage = (title: string, message: string) => `<!DOCTYPE html>
      <html>
      <head>
        <title>Error - Conexión Tiendanube</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
          .card { background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; }
          h1 { color: #ef4444; margin-bottom: 16px; font-size: 24px; }
          p { color: #666; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>⚠️ ${title}</h1>
          <p>${message}</p>
        </div>
      </body>
      </html>`;

    // GET /authorize - Start OAuth flow
    if (req.method === "GET" && (path === "/authorize" || path === "")) {
      const sellerId = url.searchParams.get("seller_id");
      
      if (!sellerId) {
        return new Response(
          errorPage("Link inválido", "Este enlace no es válido. Por favor solicita un nuevo enlace de conexión a tu proveedor logístico."),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      // Get seller and tenant info to fetch client_id
      const { data: seller, error: sellerError } = await supabase
        .from("ecommerce_sellers")
        .select("id, tenant_id, plataforma")
        .eq("id", sellerId)
        .single();

      if (sellerError || !seller) {
        console.error("Seller not found:", sellerError);
        return new Response(
          errorPage("Tienda no encontrada", "No pudimos encontrar tu tienda. Por favor contacta a tu proveedor logístico para obtener un nuevo enlace."),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      if (seller.plataforma !== "tiendanube") {
        return new Response(
          errorPage("Plataforma incorrecta", "Esta tienda no está configurada como Tiendanube. Por favor contacta a tu proveedor logístico."),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      // Get Tiendanube credentials from system_integrations
      const { data: integrations, error: intError } = await supabase
        .from("system_integrations")
        .select("config_key, config_value")
        .eq("tenant_id", seller.tenant_id)
        .eq("integration_type", "tiendanube")
        .eq("is_active", true);

      if (intError || !integrations || integrations.length === 0) {
        console.error("Tiendanube not configured:", intError);
        return new Response(
          errorPage("Integración no configurada", "La integración con Tiendanube aún no está configurada. Por favor contacta a tu proveedor logístico."),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      const configMap = Object.fromEntries(integrations.map(i => [i.config_key, i.config_value]));
      const clientId = configMap["client_id"];

      if (!clientId) {
        return new Response(
          errorPage("Configuración incompleta", "Falta el Client ID de Tiendanube. Por favor contacta a tu proveedor logístico."),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      // Build authorization URL - CORRECTED: Use /apps/{client_id}/authorize path
      const redirectUri = `${supabaseUrl}/functions/v1/tiendanube-oauth/callback`;
      const authUrl = new URL(`${TIENDANUBE_API_BASE}/apps/${clientId}/authorize`);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", sellerId);

      console.log("Redirecting to Tiendanube:", authUrl.toString());

      // Redirect to Tiendanube
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: authUrl.toString(),
        },
      });
    }

    // GET /callback - Handle OAuth callback
    if (req.method === "GET" && path === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state"); // seller_id
      const error = url.searchParams.get("error");

      if (error) {
        console.error("OAuth error:", error);
        return new Response(
          `<html><body><h1>Error de autorizacion</h1><p>${error}</p><script>setTimeout(() => window.close(), 3000)</script></body></html>`,
          { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      if (!code || !state) {
        return new Response(
          JSON.stringify({ error: "Missing code or state" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sellerId = state;

      // Get seller info
      const { data: seller, error: sellerError } = await supabase
        .from("ecommerce_sellers")
        .select("id, tenant_id")
        .eq("id", sellerId)
        .single();

      if (sellerError || !seller) {
        console.error("Seller not found in callback:", sellerError);
        return new Response(
          `<html><body><h1>Error</h1><p>Seller no encontrado</p></body></html>`,
          { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      // Get Tiendanube credentials
      const { data: integrations } = await supabase
        .from("system_integrations")
        .select("config_key, config_value")
        .eq("tenant_id", seller.tenant_id)
        .eq("integration_type", "tiendanube")
        .eq("is_active", true);

      const configMap = Object.fromEntries((integrations || []).map(i => [i.config_key, i.config_value]));
      const clientId = configMap["client_id"];
      const clientSecret = configMap["client_secret"];

      if (!clientId || !clientSecret) {
        return new Response(
          `<html><body><h1>Error</h1><p>Credenciales de Tiendanube no configuradas</p></body></html>`,
          { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      // Exchange code for access token
      const redirectUri = `${supabaseUrl}/functions/v1/tiendanube-oauth/callback`;
      
      const tokenResponse = await fetch(`${TIENDANUBE_API_BASE}/apps/authorize/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", errorText);
        return new Response(
          `<html><body><h1>Error</h1><p>Error al obtener token: ${errorText}</p></body></html>`,
          { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      const tokenData = await tokenResponse.json();
      console.log("Token received:", { store_id: tokenData.user_id, scope: tokenData.scope });

      const accessToken = tokenData.access_token;
      const storeId = String(tokenData.user_id); // Tiendanube uses user_id as store_id

      // Get store info
      const storeResponse = await fetch(`${TIENDANUBE_API_ENDPOINT}/${storeId}/store`, {
        headers: {
          "Authentication": `bearer ${accessToken}`,
          "User-Agent": "Geologistick (alfredocbb@gmail.com)",
        },
      });

      let storeUrl = null;
      if (storeResponse.ok) {
        const storeData = await storeResponse.json();
        storeUrl = storeData.url_with_protocol || storeData.original_domain;
      }

      // Generate webhook secret
      const webhookSecret = crypto.randomUUID().replace(/-/g, '');

      // Update seller with OAuth data
      const { error: updateError } = await supabase
        .from("ecommerce_sellers")
        .update({
          access_token: accessToken,
          store_id: storeId,
          store_url: storeUrl,
          webhook_secret: webhookSecret,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sellerId);

      if (updateError) {
        console.error("Failed to update seller:", updateError);
        return new Response(
          `<html><body><h1>Error</h1><p>Error al guardar credenciales</p></body></html>`,
          { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      // Get tenant branding for carrier name
      const { data: branding } = await supabase
        .from("tenant_branding")
        .select("nombre_app")
        .eq("tenant_id", seller.tenant_id)
        .maybeSingle();

      const companyName = branding?.nombre_app || "Envío Express";

      // Register shipping carrier in Tiendanube
      try {
        const carrierResponse = await fetch(
          `${TIENDANUBE_API_ENDPOINT}/${storeId}/shipping_carriers`,
          {
            method: "POST",
            headers: {
              "Authentication": `bearer ${accessToken}`,
              "Content-Type": "application/json",
              "User-Agent": "Geologistick (alfredocbb@gmail.com)",
            },
            body: JSON.stringify({
              name: companyName,
              callback_url: `${supabaseUrl}/functions/v1/tiendanube-shipping-rates`,
              types: "ship",
              active: true,
            }),
          }
        );

        if (carrierResponse.ok) {
          const carrierData = await carrierResponse.json();
          // Save carrier_id to seller
          await supabase
            .from("ecommerce_sellers")
            .update({ shipping_carrier_id: String(carrierData.id) })
            .eq("id", sellerId);
          console.log("Shipping carrier registered:", carrierData.id);
        } else {
          const errorText = await carrierResponse.text();
          console.error("Failed to register shipping carrier:", errorText);
        }
      } catch (e) {
        console.error("Error registering shipping carrier:", e);
      }

      // Register webhooks in Tiendanube
      const webhookUrl = `${supabaseUrl}/functions/v1/tiendanube-webhook`;
      const webhookEvents = ["order/created", "order/paid", "order/fulfilled", "order/cancelled"];

      for (const event of webhookEvents) {
        try {
          await fetch(`${TIENDANUBE_API_ENDPOINT}/${storeId}/webhooks`, {
            method: "POST",
            headers: {
              "Authentication": `bearer ${accessToken}`,
              "Content-Type": "application/json",
              "User-Agent": "Geologistick (alfredocbb@gmail.com)",
            },
            body: JSON.stringify({
              url: webhookUrl,
              event: event,
            }),
          });
          console.log(`Webhook registered for ${event}`);
        } catch (e) {
          console.error(`Failed to register webhook for ${event}:`, e);
        }
      }

      // Success page with proper charset and professional design
      return new Response(
        `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conexion Exitosa - Tiendanube</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; 
      align-items: center; 
      justify-content: center; 
      min-height: 100vh; 
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .card { 
      background: white; 
      padding: 48px 40px; 
      border-radius: 16px; 
      text-align: center; 
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 420px;
      width: 100%;
      animation: slideUp 0.5s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #1a1a1a; margin-bottom: 12px; font-size: 24px; font-weight: 600; }
    .subtitle { color: #666; font-size: 16px; margin-bottom: 24px; line-height: 1.6; }
    .hint { font-size: 13px; color: #999; margin-top: 24px; }
    .loader { 
      width: 24px; height: 24px; 
      border: 3px solid #eee; 
      border-top-color: #667eea; 
      border-radius: 50%; 
      animation: spin 1s linear infinite;
      margin: 20px auto 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Tienda Conectada</h1>
    <p class="subtitle">Tu tienda de Tiendanube se ha vinculado correctamente con el sistema de envios.</p>
    <p class="hint">Esta ventana se cerrara automaticamente...</p>
    <div class="loader"></div>
  </div>
  <script>
    setTimeout(function() {
      if (window.opener) {
        window.opener.postMessage({ type: 'tiendanube-oauth-success', sellerId: '${sellerId}' }, '*');
      }
      window.close();
    }, 3000);
  </script>
</body>
</html>`,
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in tiendanube-oauth:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
