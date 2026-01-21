import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PUBLIC-TRACKING] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const url = new URL(req.url);
    const trackingCode = url.searchParams.get("code");
    const apiKey = req.headers.get("x-api-key");

    if (!trackingCode) {
      logStep("Missing tracking code");
      return new Response(
        JSON.stringify({ error: "Missing 'code' parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Looking up tracking", { code: trackingCode });

    let tenantId: string | null = null;

    // If API key is provided, validate it and get tenant_id
    if (apiKey) {
      logStep("Validating API key");
      const { data: validationResult, error: validationError } = await supabaseClient.rpc(
        "validate_api_key",
        { p_api_key: apiKey }
      );

      if (validationError) {
        logStep("API key validation error", { error: validationError.message });
        return new Response(
          JSON.stringify({ error: "Invalid API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!validationResult) {
        logStep("API key not found or inactive");
        return new Response(
          JSON.stringify({ error: "Invalid or inactive API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      tenantId = validationResult;
      logStep("API key validated", { tenantId });
    }

    // Build the query
    let query = supabaseClient
      .from("envios")
      .select(`
        id,
        tracking_number,
        estado,
        estado_retiro,
        created_at,
        updated_at,
        fecha_entrega,
        ciudad_retiro,
        direccion_retiro,
        ciudad_entrega,
        direccion_entrega,
        cantidad_bultos,
        peso_kg,
        descripcion,
        sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(nombre, ciudad, codigo),
        sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre, ciudad, codigo),
        remitente:clientes!envios_remitente_id_fkey(nombre, ciudad),
        destinatario:clientes!envios_destinatario_id_fkey(nombre, ciudad)
      `)
      .eq("tracking_number", trackingCode.toUpperCase());

    // If tenant_id from API key, filter by tenant
    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: envio, error: envioError } = await query.single();

    if (envioError || !envio) {
      logStep("Shipment not found", { error: envioError?.message });
      return new Response(
        JSON.stringify({ error: "Shipment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Shipment found", { id: envio.id });

    // Fetch history
    const { data: historial } = await supabaseClient
      .from("envio_historial")
      .select("id, estado_anterior, estado_nuevo, notas, ubicacion, created_at")
      .eq("envio_id", envio.id)
      .order("created_at", { ascending: false });

    logStep("History fetched", { count: historial?.length || 0 });

    // Handle potential array from Supabase join (use first element if array)
    const sucursalOrigen = Array.isArray(envio.sucursal_origen) ? envio.sucursal_origen[0] : envio.sucursal_origen;
    const sucursalDestino = Array.isArray(envio.sucursal_destino) ? envio.sucursal_destino[0] : envio.sucursal_destino;
    const remitente = Array.isArray(envio.remitente) ? envio.remitente[0] : envio.remitente;
    const destinatario = Array.isArray(envio.destinatario) ? envio.destinatario[0] : envio.destinatario;

    // Build response
    const response = {
      tracking_number: envio.tracking_number,
      estado: envio.estado,
      estado_retiro: envio.estado_retiro,
      created_at: envio.created_at,
      updated_at: envio.updated_at,
      fecha_entrega: envio.fecha_entrega,
      origen: {
        ciudad: envio.ciudad_retiro || sucursalOrigen?.ciudad,
        direccion: envio.direccion_retiro,
        sucursal: sucursalOrigen?.nombre,
      },
      destino: {
        ciudad: envio.ciudad_entrega || sucursalDestino?.ciudad,
        direccion: envio.direccion_entrega,
        sucursal: sucursalDestino?.nombre,
      },
      detalles: {
        bultos: envio.cantidad_bultos,
        peso_kg: envio.peso_kg,
        descripcion: envio.descripcion,
      },
      remitente: remitente ? {
        nombre: remitente.nombre,
        ciudad: remitente.ciudad,
      } : null,
      destinatario: destinatario ? {
        nombre: destinatario.nombre,
        ciudad: destinatario.ciudad,
      } : null,
      historial: (historial || []).map((h) => ({
        id: h.id,
        estado_anterior: h.estado_anterior,
        estado_nuevo: h.estado_nuevo,
        notas: h.notas,
        ubicacion: h.ubicacion,
        fecha: h.created_at,
      })),
    };

    logStep("Response built successfully");

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
