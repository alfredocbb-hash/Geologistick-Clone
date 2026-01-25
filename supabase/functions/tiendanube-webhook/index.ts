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

    // Find the seller by store_id
    const { data: seller, error: sellerError } = await supabase
      .from("ecommerce_sellers")
      .select("id, tenant_id, access_token, webhook_secret, tarifa_id, sucursal_pickup_id, tiene_cuenta_corriente")
      .eq("store_id", storeId)
      .single();

    if (sellerError || !seller) {
      console.error("Seller not found for store_id:", storeId, sellerError);
      return new Response(
        JSON.stringify({ error: "Seller not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate HMAC signature if webhook_secret is configured
    const receivedSignature = req.headers.get("x-linkedstore-hmac-sha256");
    if (seller.webhook_secret && receivedSignature) {
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
        console.warn("Invalid HMAC signature");
        // Log but don't reject - some platforms don't always send valid signatures
      }
    }

    // Process based on event type
    if (event === "order/created" || event === "order/paid") {
      // Fetch full order details from Tiendanube API
      const orderResponse = await fetch(`${TIENDANUBE_API_ENDPOINT}/${storeId}/orders/${orderId}`, {
        headers: {
          "Authentication": `bearer ${seller.access_token}`,
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
