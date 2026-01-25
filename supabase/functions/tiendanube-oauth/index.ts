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
  const path = url.pathname.replace("/tiendanube-oauth", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // GET /authorize - Start OAuth flow
    if (req.method === "GET" && (path === "/authorize" || path === "")) {
      const sellerId = url.searchParams.get("seller_id");
      
      if (!sellerId) {
        return new Response(
          JSON.stringify({ error: "seller_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          JSON.stringify({ error: "Seller not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (seller.plataforma !== "tiendanube") {
        return new Response(
          JSON.stringify({ error: "Seller is not a Tiendanube store" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          JSON.stringify({ error: "Tiendanube integration not configured. Please set up client_id and client_secret in Integraciones." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const configMap = Object.fromEntries(integrations.map(i => [i.config_key, i.config_value]));
      const clientId = configMap["client_id"];

      if (!clientId) {
        return new Response(
          JSON.stringify({ error: "client_id not configured for Tiendanube" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build authorization URL
      const redirectUri = `${supabaseUrl}/functions/v1/tiendanube-oauth/callback`;
      const authUrl = new URL(`${TIENDANUBE_API_BASE}/apps/authorize/token`);
      authUrl.searchParams.set("client_id", clientId);
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

      // Register webhook in Tiendanube
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

      // Success page
      return new Response(
        `<!DOCTYPE html>
        <html>
        <head>
          <title>Conexión exitosa</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
            .card { background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            h1 { color: #22c55e; margin-bottom: 16px; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✓ Tienda conectada exitosamente</h1>
            <p>Puedes cerrar esta ventana y volver al panel de administración.</p>
            <p style="font-size: 12px; margin-top: 20px;">Esta ventana se cerrará automáticamente...</p>
          </div>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.opener.postMessage({ type: 'tiendanube-oauth-success', sellerId: '${sellerId}' }, '*');
              }
              window.close();
            }, 2000);
          </script>
        </body>
        </html>`,
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } }
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
