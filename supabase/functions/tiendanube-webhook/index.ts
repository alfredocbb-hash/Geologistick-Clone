import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-linkedstore-hmac-sha256",
};

const TIENDANUBE_API_ENDPOINT = "https://api.tiendanube.com/v1";

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
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    
    console.log("Webhook received:", { store_id: payload.store_id, event: payload.event, id: payload.id });

    const storeId = String(payload.store_id);
    const event = payload.event;
    const orderId = payload.id;

    // Handle GDPR/Privacy requests (required for Tiendanube Partners portal)
    if (event === "store/redact" || event === "customers/redact" || event === "customers/data_request") {
      console.log("GDPR request received:", event);
      // Acknowledge the request - actual data handling would depend on requirements
      return new Response(
        JSON.stringify({ success: true, message: `${event} acknowledged` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle app/uninstalled event (REQUIRED for TiendaNube marketplace approval)
    if (event === "app/uninstalled") {
      console.log("App uninstalled for store:", storeId);

      // Find seller first, then remove tokens from protected table
      const { data: uninstalledSeller } = await supabase
        .from("ecommerce_sellers")
        .select("id")
        .eq("store_id", storeId)
        .maybeSingle();

      if (uninstalledSeller?.id) {
        await supabase
          .from("ecommerce_seller_tokens")
          .delete()
          .eq("seller_id", uninstalledSeller.id);
      }

      // Clean up non-token credentials on seller row
      const { error } = await supabase
        .from("ecommerce_sellers")
        .update({
          has_valid_token: false,
          webhook_secret: null,
          shipping_carrier_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("store_id", storeId);

      if (error) {
        console.error("Failed to clean credentials:", error);
      } else {
        console.log("Credentials cleaned successfully for store:", storeId);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the seller by store_id
    const { data: seller, error: sellerError } = await supabase
      .from("ecommerce_sellers")
      .select("id, tenant_id, webhook_secret, tarifa_id, sucursal_pickup_id, tiene_cuenta_corriente")
      .eq("store_id", storeId)
      .single();

    if (sellerError || !seller) {
      console.error("Seller not found for store_id:", storeId, sellerError);
      return new Response(
        JSON.stringify({ error: "Seller not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate HMAC signature
    const receivedSignature = req.headers.get("x-linkedstore-hmac-sha256");
    if (seller.webhook_secret) {
      if (!receivedSignature) {
        console.error("Missing HMAC signature header for store:", storeId);
        return new Response(
          JSON.stringify({ error: "Missing signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(seller.webhook_secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const calculatedSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (calculatedSignature !== receivedSignature) {
        console.error("Invalid HMAC signature - REJECTING webhook for store:", storeId);
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("HMAC signature verified successfully");
    } else {
      console.warn("No webhook_secret configured for seller, skipping HMAC validation");
    }

    // Load tokens from protected table
    const { data: tokenRow } = await supabase
      .from("ecommerce_seller_tokens")
      .select("access_token, refresh_token, token_expires_at")
      .eq("seller_id", seller.id)
      .maybeSingle();
    seller.access_token = tokenRow?.access_token ?? null;
    seller.refresh_token = tokenRow?.refresh_token ?? null;
    seller.token_expires_at = tokenRow?.token_expires_at ?? null;

    // Check if token needs refresh before making API calls
    let accessToken = seller.access_token;
    if (seller.token_expires_at && new Date(seller.token_expires_at) < new Date()) {
      console.log("Token expired, attempting refresh...");
      const refreshResult = await refreshAccessToken(supabase, seller);
      if (refreshResult.success && refreshResult.newToken) {
        accessToken = refreshResult.newToken;
        console.log("Token refreshed successfully");
      } else {
        console.warn("Token refresh failed:", refreshResult.error);
      }
    }

    // Process based on event type
    if (event === "order/created" || event === "order/paid") {
      // Fetch full order details from Tiendanube API
      const orderResponse = await fetch(`${TIENDANUBE_API_ENDPOINT}/${storeId}/orders/${orderId}`, {
        headers: {
          "Authentication": `bearer ${accessToken}`,
          "User-Agent": "Geologistick (alfredocbb@gmail.com)",
        },
      });

      if (!orderResponse.ok) {
        const errorText = await orderResponse.text();
        console.error("Failed to fetch order:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to fetch order details" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const order = await orderResponse.json();
      console.log("Order fetched:", { number: order.number, status: order.status });

      // Map order data to ecommerce_orders
      // Calculate fecha_entrega_estimada based on Argentina time
      const nowArgTN = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const horaArgTN = nowArgTN.getUTCHours();
      let fechaEntregaEstimadaTN: string;
      if (horaArgTN >= 12) {
        const tomorrow = new Date(nowArgTN);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        fechaEntregaEstimadaTN = tomorrow.toISOString().substring(0, 10);
      } else {
        fechaEntregaEstimadaTN = nowArgTN.toISOString().substring(0, 10);
      }

      const orderData = {
        seller_id: seller.id,
        tenant_id: seller.tenant_id,
        external_order_id: String(order.id),
        external_order_number: String(order.number),
        plataforma: "tiendanube",
        order_status: mapOrderStatus(order.status),
        payment_status: mapPaymentStatus(order.payment_status),
        fulfillment_status: order.shipped ? "shipped" : "pending",
        buyer_name: order.customer?.name || order.contact_name || "Sin nombre",
        buyer_email: order.customer?.email || order.contact_email || null,
        buyer_phone: order.customer?.phone || order.contact_phone || null,
        buyer_dni: order.customer?.identification || null,
        shipping_address: order.shipping_address?.address || "",
        shipping_city: order.shipping_address?.city || null,
        shipping_province: order.shipping_address?.province || null,
        shipping_postal_code: order.shipping_address?.zipcode || null,
        shipping_lat: order.shipping_address?.latitude ? parseFloat(order.shipping_address.latitude) : null,
        shipping_lng: order.shipping_address?.longitude ? parseFloat(order.shipping_address.longitude) : null,
        shipping_notes: order.shipping_address?.floor || null,
        subtotal: parseFloat(order.subtotal) || 0,
        shipping_cost: parseFloat(order.shipping_cost_owner) || 0,
        total: parseFloat(order.total) || 0,
        items: order.products || [],
        raw_data: order,
        synced_at: new Date().toISOString(),
        fecha_entrega_estimada: fechaEntregaEstimadaTN,
      };

      // Upsert order
      const { error: upsertError } = await supabase
        .from("ecommerce_orders")
        .upsert(orderData, {
          onConflict: "seller_id,external_order_id",
        });

      if (upsertError) {
        console.error("Failed to upsert order:", upsertError);
        return new Response(
          JSON.stringify({ error: "Failed to save order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Order saved successfully:", order.number);

    } else if (event === "order/fulfilled") {
      // Update fulfillment status
      const { error } = await supabase
        .from("ecommerce_orders")
        .update({ 
          fulfillment_status: "shipped",
          updated_at: new Date().toISOString(),
        })
        .eq("seller_id", seller.id)
        .eq("external_order_id", String(orderId));

      if (error) {
        console.error("Failed to update order fulfillment:", error);
      }

    } else if (event === "order/cancelled") {
      // Update order status to cancelled
      const { error } = await supabase
        .from("ecommerce_orders")
        .update({ 
          order_status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("seller_id", seller.id)
        .eq("external_order_id", String(orderId));

      if (error) {
        console.error("Failed to update order cancellation:", error);
      }
    }

    // Update seller's last sync timestamp
    await supabase
      .from("ecommerce_sellers")
      .update({ ultimo_sync: new Date().toISOString() })
      .eq("id", seller.id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in tiendanube-webhook:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
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

    // Save tokens in protected table
    await supabase
      .from("ecommerce_seller_tokens")
      .upsert({
        seller_id: seller.id,
        tenant_id: seller.tenant_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || seller.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "seller_id" });

    await supabase
      .from("ecommerce_sellers")
      .update({ has_valid_token: true, updated_at: new Date().toISOString() })
      .eq("id", seller.id);

    return { success: true, newToken: tokenData.access_token };
  } catch (e) {
    console.error("Error refreshing token:", e);
    return { success: false, error: "Refresh exception" };
  }
}

// Map Tiendanube order status to our status
function mapOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    open: "pending",
    closed: "completed",
    cancelled: "cancelled",
  };
  return statusMap[status] || status;
}

// Map Tiendanube payment status to our status
function mapPaymentStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: "pending",
    authorized: "authorized",
    paid: "paid",
    voided: "voided",
    refunded: "refunded",
  };
  return statusMap[status] || status;
}
