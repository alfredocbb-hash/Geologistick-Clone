import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Simple in-memory rate limit (per isolate)
const requestLog = new Map<string, number>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Basic rate limit by IP
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();
    const lastRequest = requestLog.get(ip) || 0;
    if (now - lastRequest < 1000) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    requestLog.set(ip, now);
    // Cleanup old entries periodically
    if (requestLog.size > 10000) {
      for (const [k, v] of requestLog) {
        if (now - v > 60000) requestLog.delete(k);
      }
    }

    const url = new URL(req.url);
    const trackingNumber = url.searchParams.get("code");

    if (!trackingNumber || trackingNumber.length < 8) {
      return new Response(
        JSON.stringify({ error: "Invalid tracking number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find shipment by tracking number
    const { data: envio, error: envioError } = await supabase
      .from("envios")
      .select("id, estado, chofer_id, tracking_number, destinatario_lat, destinatario_lng, direccion_entrega, ciudad_entrega, tenant_id")
      .eq("tracking_number", trackingNumber.toUpperCase())
      .single();

    if (envioError || !envio) {
      return new Response(
        JSON.stringify({ error: "Shipment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only expose live location when en_reparto
    if (envio.estado !== "en_reparto" || !envio.chofer_id) {
      return new Response(
        JSON.stringify({
          tracking_number: envio.tracking_number,
          estado: envio.estado,
          live: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get driver's current location
    const { data: location } = await supabase
      .from("driver_locations")
      .select("lat, lng, updated_at")
      .eq("chofer_id", envio.chofer_id)
      .single();

    if (!location) {
      return new Response(
        JSON.stringify({
          tracking_number: envio.tracking_number,
          estado: envio.estado,
          live: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check distance: only show live if driver is within 4km of destination
    const destLat = envio.destinatario_lat;
    const destLng = envio.destinatario_lng;
    
    if (!destLat || !destLng) {
      return new Response(
        JSON.stringify({
          tracking_number: envio.tracking_number,
          estado: envio.estado,
          live: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const distance = haversineKm(location.lat, location.lng, destLat, destLng);
    
    if (distance > 4) {
      return new Response(
        JSON.stringify({
          tracking_number: envio.tracking_number,
          estado: envio.estado,
          live: false,
          message: "El repartidor aún no está cerca de tu ubicación",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get maps API key for this tenant
    let mapsApiKey: string | null = null;
    if (envio.tenant_id) {
      const { data: integration } = await supabase
        .from("system_integrations")
        .select("api_key")
        .eq("tenant_id", envio.tenant_id)
        .eq("integration_type", "google_maps")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      
      if (integration?.api_key) {
        mapsApiKey = integration.api_key;
      }
    }

    return new Response(
      JSON.stringify({
        tracking_number: envio.tracking_number,
        estado: envio.estado,
        live: true,
        driver: {
          lat: location.lat,
          lng: location.lng,
          updated_at: location.updated_at,
        },
        destination: {
          lat: destLat,
          lng: destLng,
          direccion: envio.direccion_entrega,
          ciudad: envio.ciudad_entrega,
        },
        maps_api_key: mapsApiKey,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("public-tracking-live error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
