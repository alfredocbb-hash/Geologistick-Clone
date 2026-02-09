import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIENDANUBE_API_BASE = "https://www.tiendanube.com";
const TIENDANUBE_API_ENDPOINT = "https://api.tiendanube.com/v1";
const FRONTEND_URL = "https://geologic.lovable.app";

function redirectError(title: string, message: string, status = 302) {
  const params = new URLSearchParams({ status: "error", title, message });
  return new Response(null, {
    status,
    headers: { Location: `${FRONTEND_URL}/oauth/tiendanube/result?${params.toString()}` },
  });
}

function redirectSuccess(sellerId: string) {
  const params = new URLSearchParams({ status: "success", seller_id: sellerId });
  return new Response(null, {
    status: 302,
    headers: { Location: `${FRONTEND_URL}/oauth/tiendanube/result?${params.toString()}` },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  // Extraer el sub-path de forma robusta
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
    // GET /authorize - Start OAuth flow
    if (req.method === "GET" && (path === "/authorize" || path === "")) {
      const sellerId = url.searchParams.get("seller_id");
      
      if (!sellerId) {
        return redirectError("Link inválido", "Este enlace no es válido. Por favor solicita un nuevo enlace de conexión a tu proveedor logístico.");
      }

      // Get seller and tenant info to fetch client_id
      const { data: seller, error: sellerError } = await supabase
        .from("ecommerce_sellers")
        .select("id, tenant_id, plataforma")
        .eq("id", sellerId)
        .single();

      if (sellerError || !seller) {
        console.error("Seller not found:", sellerError);
        return redirectError("Tienda no encontrada", "No pudimos encontrar tu tienda. Por favor contacta a tu proveedor logístico para obtener un nuevo enlace.");
      }

      if (seller.plataforma !== "tiendanube") {
        return redirectError("Plataforma incorrecta", "Esta tienda no está configurada como Tiendanube. Por favor contacta a tu proveedor logístico.");
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
        return redirectError("Integración no configurada", "La integración con Tiendanube aún no está configurada. Por favor contacta a tu proveedor logístico.");
      }

      const configMap = Object.fromEntries(integrations.map(i => [i.config_key, i.config_value]));
      const clientId = configMap["client_id"];

      if (!clientId) {
        return redirectError("Configuración incompleta", "Falta el Client ID de Tiendanube. Por favor contacta a tu proveedor logístico.");
      }

      // Build authorization URL
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
        return redirectError("Error de autorización", `Tiendanube respondió con un error: ${error}`);
      }

      if (!code || !state) {
        return redirectError("Parámetros faltantes", "La respuesta de Tiendanube no incluyó los parámetros necesarios.");
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
        return redirectError("Seller no encontrado", "No pudimos encontrar la tienda asociada a esta conexión.");
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
        return redirectError("Credenciales faltantes", "Las credenciales de Tiendanube no están configuradas correctamente.");
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
        return redirectError("Error de token", `No se pudo obtener el token de acceso: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      console.log("Token received:", { store_id: tokenData.user_id, scope: tokenData.scope, expires_in: tokenData.expires_in });

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token || null;
      const storeId = String(tokenData.user_id);
      
      const tokenExpiresAt = tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;

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
          refresh_token: refreshToken,
          token_expires_at: tokenExpiresAt,
          store_id: storeId,
          store_url: storeUrl,
          webhook_secret: webhookSecret,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sellerId);

      if (updateError) {
        console.error("Failed to update seller:", updateError);
        return redirectError("Error al guardar", "No se pudieron guardar las credenciales de conexión.");
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
      const webhookEvents = [
        "order/created", 
        "order/paid", 
        "order/fulfilled", 
        "order/cancelled",
        "app/uninstalled"
      ];

      for (const event of webhookEvents) {
        try {
          const webhookResponse = await fetch(`${TIENDANUBE_API_ENDPOINT}/${storeId}/webhooks`, {
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
          
          if (webhookResponse.ok) {
            console.log(`Webhook registered for ${event}`);
          } else {
            const errorText = await webhookResponse.text();
            console.error(`Failed to register webhook for ${event}:`, errorText);
          }
        } catch (e) {
          console.error(`Failed to register webhook for ${event}:`, e);
        }
      }

      // Redirect to success page
      return redirectSuccess(sellerId);
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in tiendanube-oauth:", error);
    return redirectError("Error inesperado", "Ocurrió un error procesando la conexión. Por favor intenta nuevamente.");
  }
});