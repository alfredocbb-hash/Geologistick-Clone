import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const destination = payload.destination || {};
    const items = payload.items || [];

    // Find seller by store_id
    const { data: seller, error: sellerError } = await supabase
      .from("ecommerce_sellers")
      .select("id, nombre, tarifa_id, min_delivery_days, max_delivery_days, activo, tenant_id")
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

    // Get tenant branding for company name
    const { data: branding } = await supabase
      .from("tenant_branding")
      .select("nombre_app")
      .eq("tenant_id", seller.tenant_id)
      .maybeSingle();

    const companyName = branding?.nombre_app || "Envío Express";

    // Get tarifa with basic info
    const { data: tarifa, error: tarifaError } = await supabase
      .from("tarifas")
      .select("id, nombre, precio_base, tipo_tarifa, rangos_precios")
      .eq("id", seller.tarifa_id)
      .maybeSingle();

    if (tarifaError || !tarifa) {
      console.error("Error fetching tarifa:", tarifaError);
      return new Response(
        JSON.stringify({ rates: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get basic concepts for this tarifa
    const { data: conceptos } = await supabase
      .from("tarifa_concepto_precios")
      .select("monto, concepto:tarifa_conceptos(codigo, nombre, es_basico)")
      .eq("tarifa_id", seller.tarifa_id);

    // Calculate total weight from items
    const totalWeight = items.reduce((sum: number, item: { weight?: string; quantity?: number }) => {
      const weight = parseFloat(item.weight || "0") || 0;
      const qty = parseInt(String(item.quantity || 1)) || 1;
      return sum + (weight * qty);
    }, 0);

    console.log("Total weight:", totalWeight, "kg");

    // Calculate base price
    let precio = Number(tarifa.precio_base) || 0;

    // Add weight-based calculation if applicable
    if (tarifa.tipo_tarifa === 'peso' && tarifa.rangos_precios) {
      const rangos = tarifa.rangos_precios as { peso_base_hasta?: number; adicional_por_kg?: number };
      const pesoBaseHasta = rangos.peso_base_hasta || 0;
      const adicionalPorKg = rangos.adicional_por_kg || 0;
      if (totalWeight > pesoBaseHasta) {
        precio += (totalWeight - pesoBaseHasta) * adicionalPorKg;
      }
    }

    // Add basic concepts (like "Entrega a Domicilio")
    if (conceptos && conceptos.length > 0) {
      for (const c of conceptos) {
        // concepto can be an array or object depending on the query
        const concepto = Array.isArray(c.concepto) ? c.concepto[0] : c.concepto;
        if (concepto?.es_basico) {
          precio += Number(c.monto) || 0;
        }
      }
    }

    console.log("Calculated price:", precio);

    // Build response with rate
    const rates = [
      {
        code: "custom_shipping",
        name: `${companyName} - Envío Estándar`,
        price: precio.toFixed(2),
        currency: "ARS",
        min_delivery_days: seller.min_delivery_days || 3,
        max_delivery_days: seller.max_delivery_days || 5,
      }
    ];

    console.log("Returning rate:", JSON.stringify(rates[0]));

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
