import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    
    if (authError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub;
    console.log("Sync request from user:", userId);

    // Get request body
    const body = await req.json();
    const { seller_id, since } = body;

    if (!seller_id) {
      return new Response(
        JSON.stringify({ error: "seller_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get seller info
    const { data: seller, error: sellerError } = await supabase
      .from("ecommerce_sellers")
      .select("id, tenant_id, store_id, access_token, tarifa_id, sucursal_pickup_id, tiene_cuenta_corriente")
      .eq("id", seller_id)
      .single();

    if (sellerError || !seller) {
      console.error("Seller not found:", sellerError);
      return new Response(
        JSON.stringify({ error: "Seller not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to same tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile || profile.tenant_id !== seller.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!seller.access_token || !seller.store_id) {
      return new Response(
        JSON.stringify({ error: "Seller not connected to Tiendanube. Please authorize first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build API URL with filters
    let apiUrl = `${TIENDANUBE_API_ENDPOINT}/${seller.store_id}/orders?per_page=50`;
    if (since) {
      apiUrl += `&updated_at_min=${encodeURIComponent(since)}`;
    }

    console.log("Fetching orders from:", apiUrl);

    let allOrders: any[] = [];
    let page = 1;
    let hasMore = true;

    // Paginate through all orders
    while (hasMore) {
      const response = await fetch(`${apiUrl}&page=${page}`, {
        headers: {
          "Authentication": `bearer ${seller.access_token}`,
          "User-Agent": "Geologistick (alfredocbb@gmail.com)",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Tiendanube returns 404 when store has no orders ("Last page is 0")
        if (response.status === 404 && errorText.includes("Last page is 0")) {
          console.log("Store has no orders yet - this is normal for new stores");
          hasMore = false;
          break;
        }
        
        console.error("Failed to fetch orders:", errorText);
        
        if (response.status === 401) {
          return new Response(
            JSON.stringify({ error: "Token expirado. Por favor, reconecta la tienda." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: "Failed to fetch orders from Tiendanube" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const orders = await response.json();
      allOrders = allOrders.concat(orders);

      // Check if there are more pages
      if (orders.length < 50) {
        hasMore = false;
      } else {
        page++;
        // Safety limit
        if (page > 20) {
          console.warn("Reached page limit, stopping pagination");
          hasMore = false;
        }
      }
    }

    console.log(`Fetched ${allOrders.length} orders`);

    let created = 0;
    let updated = 0;
    let errors = 0;

    // Process each order
    for (const order of allOrders) {
      try {
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

        // Check if order exists
        const { data: existing } = await supabase
          .from("ecommerce_orders")
          .select("id")
          .eq("seller_id", seller.id)
          .eq("external_order_id", String(order.id))
          .maybeSingle();

        if (existing) {
          // Update
          const { error } = await supabase
            .from("ecommerce_orders")
            .update(orderData)
            .eq("id", existing.id);

          if (error) throw error;
          updated++;
        } else {
          // Insert
          const { error } = await supabase
            .from("ecommerce_orders")
            .insert(orderData);

          if (error) throw error;
          created++;
        }
      } catch (e) {
        console.error("Error processing order:", order.id, e);
        errors++;
      }
    }

    // Update seller's last sync timestamp
    await supabase
      .from("ecommerce_sellers")
      .update({ ultimo_sync: new Date().toISOString() })
      .eq("id", seller.id);

    console.log(`Sync complete: ${created} created, ${updated} updated, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total: allOrders.length,
        created,
        updated,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in tiendanube-sync:", error);
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
