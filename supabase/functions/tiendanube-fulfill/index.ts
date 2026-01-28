import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FulfillRequest {
  envio_id: string;
  tracking_url?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: FulfillRequest = await req.json();
    const { envio_id, tracking_url } = body;

    if (!envio_id) {
      return new Response(
        JSON.stringify({ error: "envio_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing fulfillment for envio_id:", envio_id);

    // Get the ecommerce order linked to this shipment
    const { data: ecommerceOrder, error: orderError } = await supabase
      .from("ecommerce_orders")
      .select(`
        id,
        external_order_id,
        plataforma,
        fulfillment_status,
        seller:ecommerce_sellers(
          id,
          store_id,
          access_token,
          refresh_token,
          token_expires_at,
          tenant_id
        )
      `)
      .eq("envio_id", envio_id)
      .maybeSingle();

    if (orderError) {
      console.error("Error fetching ecommerce order:", orderError);
      return new Response(
        JSON.stringify({ error: "Error fetching order", details: orderError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ecommerceOrder) {
      console.log("No ecommerce order found for envio_id:", envio_id);
      return new Response(
        JSON.stringify({ success: true, message: "No ecommerce order linked to this shipment" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only process Tiendanube orders
    if (ecommerceOrder.plataforma !== "tiendanube") {
      console.log("Order is not from Tiendanube, skipping:", ecommerceOrder.plataforma);
      return new Response(
        JSON.stringify({ success: true, message: "Order is not from Tiendanube" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already fulfilled
    if (ecommerceOrder.fulfillment_status === "fulfilled") {
      console.log("Order already fulfilled, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "Order already fulfilled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const seller = Array.isArray(ecommerceOrder.seller) 
      ? ecommerceOrder.seller[0] 
      : ecommerceOrder.seller;

    if (!seller || !seller.store_id || !seller.access_token) {
      console.error("Seller not found or missing credentials");
      return new Response(
        JSON.stringify({ error: "Seller credentials not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = seller.access_token;
    if (seller.token_expires_at && new Date(seller.token_expires_at) < new Date()) {
      console.log("Token expired, attempting refresh...");
      const refreshResult = await refreshAccessToken(supabase, seller);
      if (refreshResult.success && refreshResult.newToken) {
        accessToken = refreshResult.newToken;
      } else {
        console.warn("Token refresh failed:", refreshResult.error);
        // Continue with old token, might still work
      }
    }

    // Get the tracking number from the shipment
    const { data: envio } = await supabase
      .from("envios")
      .select("tracking_number")
      .eq("id", envio_id)
      .single();

    const trackingNumber = envio?.tracking_number || envio_id;
    const trackingUrlFinal = tracking_url || `https://geologic.lovable.app/tracking/${trackingNumber}`;

    // Call Tiendanube fulfill API
    const fulfillUrl = `https://api.tiendanube.com/v1/${seller.store_id}/orders/${ecommerceOrder.external_order_id}/fulfill`;
    
    console.log("Calling Tiendanube fulfill API:", fulfillUrl);

    const fulfillResponse = await fetch(fulfillUrl, {
      method: "POST",
      headers: {
        "Authentication": `bearer ${accessToken}`,
        "User-Agent": "Geologistick App (soporte@geologistick.com)",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shipping_tracking_number: trackingNumber,
        shipping_tracking_url: trackingUrlFinal,
        notify_customer: true,
      }),
    });

    const responseText = await fulfillResponse.text();
    console.log("Tiendanube fulfill response:", fulfillResponse.status, responseText);

    if (!fulfillResponse.ok) {
      // Log error but don't fail - order might already be fulfilled in TN
      console.error("Tiendanube fulfill API error:", fulfillResponse.status, responseText);
      
      // Update local status anyway to prevent retries
      await supabase
        .from("ecommerce_orders")
        .update({
          fulfillment_status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ecommerceOrder.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Tiendanube API error",
          status: fulfillResponse.status,
          details: responseText 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update fulfillment status in local database
    const { error: updateError } = await supabase
      .from("ecommerce_orders")
      .update({
        fulfillment_status: "fulfilled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ecommerceOrder.id);

    if (updateError) {
      console.error("Error updating fulfillment status:", updateError);
    }

    console.log("Fulfillment completed successfully for order:", ecommerceOrder.external_order_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Order fulfilled successfully",
        order_id: ecommerceOrder.external_order_id,
        tracking_number: trackingNumber,
        tracking_url: trackingUrlFinal,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in tiendanube-fulfill:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to refresh access token
async function refreshAccessToken(
  supabase: any,
  seller: { id: string; refresh_token: string | null; tenant_id: string }
): Promise<{ success: boolean; newToken?: string; error?: string }> {
  
  if (!seller.refresh_token) {
    return { success: false, error: "No refresh token available" };
  }

  // Get tenant credentials
  const { data: integrations } = await supabase
    .from("system_integrations")
    .select("config_key, config_value")
    .eq("tenant_id", seller.tenant_id)
    .eq("integration_type", "tiendanube")
    .eq("is_active", true);

  const configMap = Object.fromEntries(
    (integrations || []).map((i: { config_key: string; config_value: string }) => [i.config_key, i.config_value])
  );

  if (!configMap.client_id || !configMap.client_secret) {
    return { success: false, error: "Missing tenant credentials" };
  }

  try {
    const response = await fetch("https://www.tiendanube.com/apps/authorize/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: configMap.client_id,
        client_secret: configMap.client_secret,
        grant_type: "refresh_token",
        refresh_token: seller.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token refresh failed:", errorText);
      return { success: false, error: "Refresh request failed" };
    }

    const tokenData = await response.json();
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Update tokens in database
    await supabase
      .from("ecommerce_sellers")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || seller.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", seller.id);

    return { success: true, newToken: tokenData.access_token };
  } catch (e) {
    console.error("Error refreshing token:", e);
    return { success: false, error: "Refresh exception" };
  }
}
