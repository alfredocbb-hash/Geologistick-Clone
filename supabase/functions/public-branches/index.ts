import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PUBLIC-BRANCHES] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // --- Validate API Key ---
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return errorJson("API key required", 401);
    }

    const { data: tenantId, error: keyErr } = await supabase.rpc("validate_api_key", { p_api_key: apiKey });
    if (keyErr || !tenantId) {
      logStep("Invalid API key", { error: keyErr?.message });
      return errorJson("Invalid or inactive API key", 401);
    }
    logStep("Authenticated", { tenantId });

    // --- Parse filter ---
    const url = new URL(req.url);
    const tipo = url.searchParams.get("tipo") || "todas";

    // --- Query branches ---
    let query = supabase
      .from("sucursales")
      .select("nombre, codigo, direccion, ciudad, telefono, email, lat, lng, horario_apertura, horario_cierre, permite_retiro_clientes, puede_despachar, realiza_entregas")
      .eq("tenant_id", tenantId)
      .eq("activa", true)
      .order("nombre");

    // Apply filter
    if (tipo === "retiro") {
      query = query.eq("permite_retiro_clientes", true);
    } else if (tipo === "despacho") {
      query = query.eq("puede_despachar", true);
    } else if (tipo === "entrega") {
      query = query.eq("realiza_entregas", true);
    }

    const { data: sucursales, error } = await query;

    if (error) {
      logStep("Query error", { error: error.message });
      return errorJson("Error fetching branches", 500);
    }

    const result = (sucursales || []).map((s: any) => ({
      nombre: s.nombre,
      codigo: s.codigo,
      direccion: s.direccion,
      ciudad: s.ciudad,
      telefono: s.telefono || null,
      email: s.email || null,
      lat: s.lat ? Number(s.lat) : null,
      lng: s.lng ? Number(s.lng) : null,
      horario_apertura: s.horario_apertura || null,
      horario_cierre: s.horario_cierre || null,
      permite_retiro_clientes: s.permite_retiro_clientes || false,
      puede_despachar: s.puede_despachar || false,
      realiza_entregas: s.realiza_entregas || false,
    }));

    logStep("Returning branches", { count: result.length, tipo });

    return new Response(JSON.stringify({ sucursales: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return errorJson(msg, 500);
  }
});

function errorJson(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
