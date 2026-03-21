import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PUBLIC-TRACKING] ${step}${detailsStr}`);
};

// Sanitize notes to remove sensitive data (DNI, CUIT) for public tracking
const sanitizeNotasForPublic = (notas: string | null): string | null => {
  if (!notas) return null;
  
  // Remove DNI patterns: "(DNI: XXXXX)" or "DNI: XXXXX" 
  let sanitized = notas.replace(/\s*\(?DNI:\s*\d+\)?/gi, '');
  
  // Remove CUIT patterns: "(CUIT: XX-XXXXXXXX-X)" or similar
  sanitized = sanitized.replace(/\s*\(?CUIT:\s*[\d-]+\)?/gi, '');
  
  // Remove trailing " a Name Lastname" after "sucursal" if DNI was removed
  sanitized = sanitized.replace(/(\ben sucursal)\s+a\s+[^(]+$/i, '$1');
  
  return sanitized.trim() || null;
};

// Mask a name for public access: "Juan Pérez" -> "Juan P***"
const maskName = (name: string | null): string | null => {
  if (!name || name.length < 2) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2) + "***";
  }
  // Show first name, mask last name
  return parts[0] + " " + parts[parts.length - 1].substring(0, 1) + "***";
};

// Mask an address: "Av. Rivadavia 1234, CABA" -> "Av. Rivadavia ****, CABA"
const maskAddress = (address: string | null): string | null => {
  if (!address) return null;
  // Replace house numbers with ****
  return address.replace(/\b(\d{2,})\b/g, '****');
};

serve(async (req: Request) => {
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

    // Input validation: limit tracking code length
    if (trackingCode.length > 100) {
      return new Response(
        JSON.stringify({ error: "Invalid tracking code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Looking up tracking", { code: trackingCode });

    let tenantId: string | null = null;
    const isAuthenticated = !!apiKey;

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

    // SECURITY: Require full tracking number for unauthenticated public access
    // This prevents enumeration attacks via short suffix matching
    const isShortCode = trackingCode.length < 8;
    if (isShortCode && !isAuthenticated) {
      return new Response(
        JSON.stringify({ error: "Full tracking number required for public access" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchPattern = isShortCode ? `%${trackingCode}` : trackingCode;
    
    logStep("Search mode", { isShortCode, authenticated: isAuthenticated });
    
    let query = supabaseClient
      .from("envios")
      .select(`
        id,
        tenant_id,
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
        nombre_remitente,
        nombre_destinatario,
        entregado_en_sucursal,
        sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(nombre, ciudad, codigo, es_centro_logistico),
        sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre, ciudad, codigo, es_centro_logistico),
        sucursal_entrega:sucursales!envios_sucursal_entrega_id_fkey(nombre, ciudad, codigo, es_centro_logistico),
        remitente:clientes!envios_remitente_id_fkey(nombre, ciudad),
        destinatario:clientes!envios_destinatario_id_fkey(nombre, ciudad)
      `)
      .ilike("tracking_number", searchPattern);

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

    logStep("Shipment found", { id: envio.id, tenant_id: envio.tenant_id });

    // Fetch tenant branding
    let branding = null;
    if (envio.tenant_id) {
      const { data: brandingData } = await supabaseClient
        .from("tenant_branding")
        .select("nombre_app, logo_light, logo_dark, color_primario")
        .eq("tenant_id", envio.tenant_id)
        .maybeSingle();

      if (brandingData) {
        branding = {
          nombre_app: brandingData.nombre_app,
          logo: brandingData.logo_light || brandingData.logo_dark,
          color_primario: brandingData.color_primario,
        };
        logStep("Branding found", { nombre_app: branding.nombre_app });
      } else {
        logStep("No branding found for tenant");
      }
    }

    // Fetch history with user profiles
    const { data: historial } = await supabaseClient
      .from("envio_historial")
      .select("id, estado_anterior, estado_nuevo, notas, ubicacion, created_at, created_by")
      .eq("envio_id", envio.id)
      .order("created_at", { ascending: false });

    logStep("History fetched", { count: historial?.length || 0 });

    // Fetch user display names for history entries (only for authenticated requests)
    let userNamesMap: Record<string, string> = {};
    if (isAuthenticated && historial && historial.length > 0) {
      const userIds = [...new Set(historial.map((h: any) => h.created_by).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseClient
          .from("profiles")
          .select("user_id, nombre, apellido")
          .in("user_id", userIds);
        if (profiles) {
          for (const p of profiles) {
            const fullName = [p.nombre, p.apellido].filter(Boolean).join(" ").trim();
            if (fullName) userNamesMap[p.user_id] = fullName;
          }
        }
      }
      logStep("User profiles fetched for history", { count: Object.keys(userNamesMap).length });
    }

    // Fetch planned routes (rutas_planificadas) via ruta_paradas
    let rutasResponse: any[] = [];
    const { data: rutaParadas } = await supabaseClient
      .from("ruta_paradas")
      .select(`
        ruta:rutas_planificadas(
          numero,
          estado,
          tipo
        )
      `)
      .eq("envio_id", envio.id);

    if (rutaParadas) {
      const seenRutas = new Set<string>();
      rutasResponse = rutaParadas
        .map((rp: any) => {
          const ruta = Array.isArray(rp.ruta) ? rp.ruta[0] : rp.ruta;
          if (!ruta || seenRutas.has(ruta.numero)) return null;
          seenRutas.add(ruta.numero);
          return {
            numero: ruta.numero,
            estado: ruta.estado,
            tipo: ruta.tipo || null,
          };
        })
        .filter(Boolean);
    }
    logStep("Planned routes fetched", { count: rutasResponse.length });

    // Fetch hojas de ruta (only for authenticated requests)
    let hojasRutaResponse: any[] = [];
    if (isAuthenticated) {
      const { data: hojasRutaData } = await supabaseClient
        .from("hoja_ruta_envios")
        .select(`
          hoja_ruta:hojas_ruta(
            numero,
            estado,
            fecha_salida,
            cantidad_envios,
            sucursal_origen:sucursales!hojas_ruta_sucursal_origen_id_fkey(nombre, ciudad),
            sucursal_destino:sucursales!hojas_ruta_sucursal_destino_id_fkey(nombre, ciudad)
          )
        `)
        .eq("envio_id", envio.id);

      if (hojasRutaData) {
        hojasRutaResponse = hojasRutaData
          .map((hre: any) => {
            const hr = Array.isArray(hre.hoja_ruta) ? hre.hoja_ruta[0] : hre.hoja_ruta;
            if (!hr) return null;
            const origen = Array.isArray(hr.sucursal_origen) ? hr.sucursal_origen[0] : hr.sucursal_origen;
            const destino = Array.isArray(hr.sucursal_destino) ? hr.sucursal_destino[0] : hr.sucursal_destino;
            return {
              numero: hr.numero,
              estado: hr.estado,
              fecha_salida: hr.fecha_salida,
              cantidad_envios: hr.cantidad_envios,
              origen: origen ? { nombre: origen.nombre, ciudad: origen.ciudad } : null,
              destino: destino ? { nombre: destino.nombre, ciudad: destino.ciudad } : null,
            };
          })
          .filter(Boolean);
      }
      logStep("Hojas de ruta fetched", { count: hojasRutaResponse.length });
    }

    // Handle potential array from Supabase join (use first element if array)
    const sucursalOrigen = Array.isArray(envio.sucursal_origen) ? envio.sucursal_origen[0] : envio.sucursal_origen;
    const sucursalDestino = Array.isArray(envio.sucursal_destino) ? envio.sucursal_destino[0] : envio.sucursal_destino;
    const sucursalEntrega = Array.isArray(envio.sucursal_entrega) ? envio.sucursal_entrega[0] : envio.sucursal_entrega;
    const remitente = Array.isArray(envio.remitente) ? envio.remitente[0] : envio.remitente;
    const destinatario = Array.isArray(envio.destinatario) ? envio.destinatario[0] : envio.destinatario;

    // Determine current branch as detailed object
    let sucursalActualObj: { nombre: string; ciudad: string | null; codigo: string | null; es_centro_logistico: boolean } | null = null;
    const buildSucursalObj = (suc: any) => suc ? {
      nombre: suc.nombre,
      ciudad: suc.ciudad || null,
      codigo: suc.codigo || null,
      es_centro_logistico: suc.es_centro_logistico || false,
    } : null;

    if (envio.estado === 'en_sucursal' || envio.estado === 'pendiente' || envio.estado === 'recogido') {
      sucursalActualObj = buildSucursalObj(sucursalEntrega) || buildSucursalObj(sucursalOrigen);
    } else if (envio.estado === 'entregado') {
      sucursalActualObj = buildSucursalObj(sucursalEntrega) || buildSucursalObj(sucursalDestino);
    } else {
      sucursalActualObj = buildSucursalObj(sucursalDestino);
    }

    // Build response - mask PII for public (unauthenticated) access
    const response = {
      tracking_number: envio.tracking_number,
      estado: envio.estado,
      estado_retiro: envio.estado_retiro,
      created_at: envio.created_at,
      updated_at: envio.updated_at,
      fecha_entrega: envio.fecha_entrega,
      origen: {
        ciudad: envio.ciudad_retiro || sucursalOrigen?.ciudad,
        direccion: isAuthenticated ? envio.direccion_retiro : maskAddress(envio.direccion_retiro),
        sucursal: sucursalOrigen?.nombre,
      },
      destino: {
        ciudad: envio.ciudad_entrega || sucursalDestino?.ciudad,
        direccion: isAuthenticated ? envio.direccion_entrega : maskAddress(envio.direccion_entrega),
        sucursal: sucursalDestino?.nombre,
      },
      detalles: {
        bultos: envio.cantidad_bultos,
        ...(isAuthenticated ? {
          peso_kg: envio.peso_kg,
          descripcion: envio.descripcion,
        } : {}),
      },
      remitente: {
        nombre: isAuthenticated
          ? (envio.nombre_remitente || remitente?.nombre || null)
          : maskName(envio.nombre_remitente || remitente?.nombre || null),
        ciudad: remitente?.ciudad || null,
      },
      destinatario: {
        nombre: isAuthenticated
          ? (envio.nombre_destinatario || destinatario?.nombre || null)
          : maskName(envio.nombre_destinatario || destinatario?.nombre || null),
        ciudad: destinatario?.ciudad || null,
      },
      branding,
      sucursal_actual: sucursalActualObj,
      entregado_en_sucursal: envio.entregado_en_sucursal || false,
      hojas_ruta: hojasRutaResponse,
      rutas: rutasResponse,
      historial: (historial || []).map((h: any) => ({
        id: h.id,
        estado_anterior: h.estado_anterior,
        estado_nuevo: h.estado_nuevo,
        notas: isAuthenticated ? sanitizeNotasForPublic(h.notas) : null,
        ubicacion: h.ubicacion,
        fecha: h.created_at,
        usuario: isAuthenticated ? (userNamesMap[h.created_by] || null) : null,
      })),
    };

    let mapsApiKey: string | null = null;
    if (envio.tenant_id) {
      for (const env of ['production', 'sandbox']) {
        const { data: integration } = await supabaseClient
          .from('system_integrations')
          .select('config_value')
          .eq('tenant_id', envio.tenant_id)
          .eq('integration_type', 'google_maps')
          .eq('config_key', 'api_key')
          .eq('environment', env)
          .eq('is_active', true)
          .maybeSingle();
        if (integration?.config_value) {
          mapsApiKey = integration.config_value;
          break;
        }
      }
      if (!mapsApiKey) {
        mapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('VITE_GOOGLE_MAPS_API_KEY') || null;
      }
    }

    const finalResponse = { ...response, maps_api_key: mapsApiKey };

    logStep("Response built successfully");

    return new Response(JSON.stringify(finalResponse), {
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
