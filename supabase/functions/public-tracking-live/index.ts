import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      .select("id, estado, chofer_id, tracking_number, destinatario_lat, destinatario_lng, direccion_entrega, ciudad_entrega")
      .eq("tracking_number", trackingNumber.toUpperCase())
      .single();

    if (envioError || !envio) {
      return new Response(
        JSON.stringify({ error: "Shipment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only expose live location when en_reparto
    if (envio.estado !== "en_reparto") {
      return new Response(
        JSON.stringify({
          tracking_number: envio.tracking_number,
          estado: envio.estado,
          live: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!envio.chofer_id) {
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
          lat: envio.destinatario_lat,
          lng: envio.destinatario_lng,
          direccion: envio.direccion_entrega,
          ciudad: envio.ciudad_entrega,
        },
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
