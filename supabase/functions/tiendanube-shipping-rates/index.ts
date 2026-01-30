import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SellerData {
  id: string;
  nombre: string;
  tarifa_id: string | null;
  tarifa_express_id: string | null;
  min_delivery_days: number | null;
  max_delivery_days: number | null;
  express_delivery_days: number | null;
  express_surcharge: number | null;
  permite_pickup: boolean | null;
  pickup_surcharge: number | null;
  activo: boolean | null;
  tenant_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
}

interface TarifaData {
  id: string;
  nombre: string;
  precio_base: number;
  tipo_tarifa: string | null;
  rangos_precios: { peso_base_hasta?: number; adicional_por_kg?: number } | null;
  multiplicar_flete_por_bultos: boolean | null;
}

interface ShippingRate {
  code: string;
  name: string;
  price: string;
  currency: string;
  min_delivery_days: number;
  max_delivery_days: number;
  type?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ rates: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload = await req.json();
    console.log("Shipping rate request:", JSON.stringify(payload));

    const storeId = String(payload.store_id);
    const items = payload.items || [];

    // Find seller by store_id with all shipping configuration
    const { data: seller, error: sellerError } = await supabase
      .from("ecommerce_sellers")
      .select(`
        id, nombre, tarifa_id, tarifa_express_id, 
        min_delivery_days, max_delivery_days, express_delivery_days, express_surcharge,
        permite_pickup, pickup_surcharge,
        activo, tenant_id, access_token, refresh_token, token_expires_at
      `)
      .eq("store_id", storeId)
      .maybeSingle();

    if (sellerError) {
      console.error("Error fetching seller:", sellerError);
      return new Response(
        JSON.stringify({ rates: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!seller || !seller.tarifa_id || !seller.activo) {
      console.log("Seller not found, inactive, or no tarifa:", storeId);
      return new Response(
        JSON.stringify({ rates: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sellerData = seller as SellerData;

    // Check if token is expired and needs refresh
    if (sellerData.token_expires_at && new Date(sellerData.token_expires_at) < new Date()) {
      console.log("Token expired for seller, attempting refresh...");
      const refreshResult = await refreshAccessToken(supabase, sellerData);
      if (!refreshResult.success) {
        console.warn("Token refresh failed, but continuing with rate calculation");
      } else {
        console.log("Token refreshed successfully");
      }
    }

    // Get tenant branding for company name
    const { data: branding } = await supabase
      .from("tenant_branding")
      .select("nombre_app")
      .eq("tenant_id", sellerData.tenant_id)
      .maybeSingle();

    const companyName = branding?.nombre_app || "Envío Express";

    // Calculate total weight and item count from items
    const totalWeight = items.reduce((sum: number, item: { weight?: string; quantity?: number }) => {
      const weight = parseFloat(item.weight || "0") || 0;
      const qty = parseInt(String(item.quantity || 1)) || 1;
      return sum + (weight * qty);
    }, 0);

    // Total item count (used for multiplicar_flete_por_bultos)
    const totalItemCount = items.reduce((sum: number, item: { quantity?: number }) => {
      const qty = parseInt(String(item.quantity || 1)) || 1;
      return sum + qty;
    }, 0);

    console.log("Total weight:", totalWeight, "kg, Total items:", totalItemCount);

    // Fetch all required data in parallel
    const [tarifaResult, tarifaExpressResult, conceptosResult, sucursalesResult] = await Promise.all([
      // Standard tarifa
      supabase
        .from("tarifas")
        .select("id, nombre, precio_base, tipo_tarifa, rangos_precios, multiplicar_flete_por_bultos")
        .eq("id", sellerData.tarifa_id)
        .maybeSingle(),
      // Express tarifa (if configured)
      sellerData.tarifa_express_id
        ? supabase
            .from("tarifas")
            .select("id, nombre, precio_base, tipo_tarifa, rangos_precios, multiplicar_flete_por_bultos")
            .eq("id", sellerData.tarifa_express_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      // Concepts for standard tarifa
      supabase
        .from("tarifa_concepto_precios")
        .select("monto, concepto:tarifa_conceptos(codigo, nombre, es_basico)")
        .eq("tarifa_id", sellerData.tarifa_id),
      // Pickup branches (if enabled)
      sellerData.permite_pickup
        ? supabase
            .from("sucursales")
            .select("id, nombre, direccion, ciudad, codigo_postal, lat, lng")
            .eq("tenant_id", sellerData.tenant_id)
            .eq("activa", true)
            .eq("permite_retiro_clientes", true)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (tarifaResult.error || !tarifaResult.data) {
      console.error("Error fetching tarifa:", tarifaResult.error);
      return new Response(
        JSON.stringify({ rates: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tarifa = tarifaResult.data as TarifaData;
    const tarifaExpress = tarifaExpressResult.data as TarifaData | null;
    const conceptos = conceptosResult.data || [];
    const pickupBranches = sucursalesResult.data || [];

    // Calculate standard rate (pass totalItemCount for multiplicar_flete_por_bultos)
    const standardPrice = calculateRate(tarifa, totalWeight, conceptos, totalItemCount);
    console.log("Standard price calculated:", standardPrice);

    const rates: ShippingRate[] = [];

    // Add standard shipping rate
    rates.push({
      code: "standard_shipping",
      name: `${companyName} - Envío Estándar`,
      price: standardPrice.toFixed(2),
      currency: "ARS",
      min_delivery_days: sellerData.min_delivery_days || 3,
      max_delivery_days: sellerData.max_delivery_days || 5,
      type: "ship",
    });

    // Add express shipping rate if configured
    if (tarifaExpress) {
      const expressBasePrice = calculateRate(tarifaExpress, totalWeight, [], totalItemCount);
      const expressSurcharge = Number(sellerData.express_surcharge) || 0;
      const expressPrice = expressBasePrice + expressSurcharge;
      
      console.log("Express price calculated:", expressPrice, "(base:", expressBasePrice, "+ surcharge:", expressSurcharge, ")");

      rates.push({
        code: "express_shipping",
        name: `${companyName} - Envío Express`,
        price: expressPrice.toFixed(2),
        currency: "ARS",
        min_delivery_days: sellerData.express_delivery_days || 1,
        max_delivery_days: sellerData.express_delivery_days || 1,
        type: "ship",
      });
    }

    // Add pickup points if enabled
    if (sellerData.permite_pickup && pickupBranches.length > 0) {
      const pickupSurcharge = Number(sellerData.pickup_surcharge) || 0;
      const pickupPrice = Math.max(0, standardPrice + pickupSurcharge);

      for (const branch of pickupBranches) {
        rates.push({
          code: `pickup_${branch.id}`,
          name: `Retiro en ${branch.nombre}`,
          price: pickupPrice.toFixed(2),
          currency: "ARS",
          min_delivery_days: 1,
          max_delivery_days: 2,
          type: "pickup",
          address: branch.direccion || "",
          city: branch.ciudad || "",
          province: "", // Could be added to sucursales if needed
          postal_code: branch.codigo_postal || "",
          latitude: branch.lat ? Number(branch.lat) : undefined,
          longitude: branch.lng ? Number(branch.lng) : undefined,
        });
      }
      
      console.log("Added", pickupBranches.length, "pickup points");
    }

    console.log("Returning", rates.length, "rates");

    return new Response(
      JSON.stringify({ rates }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error calculating shipping:", error);
    return new Response(
      JSON.stringify({ rates: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Calculate rate from tarifa, weight, concepts, and item count
function calculateRate(
  tarifa: TarifaData,
  totalWeight: number,
  conceptos: Array<{ monto: number; concepto: unknown }>,
  itemCount: number = 1
): number {
  let precio = Number(tarifa.precio_base) || 0;

  // Multiply base price by item count if configured
  if (tarifa.multiplicar_flete_por_bultos && itemCount > 1) {
    precio *= itemCount;
  }

  // Add weight-based calculation if applicable
  if (tarifa.tipo_tarifa === "peso" && tarifa.rangos_precios) {
    const rangos = tarifa.rangos_precios;
    const pesoBaseHasta = rangos.peso_base_hasta || 0;
    const adicionalPorKg = rangos.adicional_por_kg || 0;
    if (totalWeight > pesoBaseHasta) {
      precio += (totalWeight - pesoBaseHasta) * adicionalPorKg;
    }
  }

  // Add basic concepts (like "Entrega a Domicilio")
  if (conceptos && conceptos.length > 0) {
    for (const c of conceptos) {
      const concepto = Array.isArray(c.concepto) ? c.concepto[0] : c.concepto;
      if (concepto && typeof concepto === "object" && "es_basico" in concepto && concepto.es_basico) {
        precio += Number(c.monto) || 0;
      }
    }
  }

  return precio;
}

// Helper function to refresh access token
async function refreshAccessToken(
  supabase: any,
  seller: SellerData
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
