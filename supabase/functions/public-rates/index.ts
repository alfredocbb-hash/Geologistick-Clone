import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PUBLIC-RATES] ${step}${detailsStr}`);
};

function normalizarTexto(str: string): string {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function encontrarTarifaPorDestino(
  ciudad: string | null,
  cp: string | null,
  peso: number,
  tarifas: any[]
): any[] {
  if (!ciudad && !cp) return tarifas;
  const ciudadNorm = ciudad ? normalizarTexto(ciudad) : '';
  const cpTrim = cp?.trim() || '';

  const coincidentesZona = tarifas.filter((t: any) => {
    if (!t.zona_destino) return false;
    const destinos = t.zona_destino.split(',').map((d: string) => normalizarTexto(d.trim()));
    if (ciudadNorm && destinos.some((d: string) => d.includes(ciudadNorm) || ciudadNorm.includes(d))) return true;
    if (cpTrim && destinos.some((d: string) => d === cpTrim)) return true;
    return false;
  });

  if (coincidentesZona.length === 0) return tarifas;
  if (coincidentesZona.length === 1) return coincidentesZona;

  // Desempate por peso si hay múltiples zonas coincidentes
  if (peso > 0) {
    const porPeso = coincidentesZona.filter((t: any) => {
      const rangos = Array.isArray(t.rangos_kg) ? t.rangos_kg : [];
      return rangos.some((r: any) => peso >= r.desde && peso <= r.hasta);
    });
    if (porPeso.length > 0) return porPeso;
  }

  return coincidentesZona;
}

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

    // --- Parse params (POST body or query string) ---
    let params: Record<string, unknown> = {};
    if (req.method === "POST") {
      try { params = await req.json(); } catch { /* empty body */ }
    }
    const url = new URL(req.url);
    // Query string fallback
    const peso = Number(params.peso ?? url.searchParams.get("peso") ?? 0);
    const bultos = Math.max(1, Number(params.bultos ?? url.searchParams.get("bultos") ?? 1));
    const tipoServicio = String(params.tipo_servicio ?? url.searchParams.get("tipo_servicio") ?? "");
    const cpDestino = String(params.cp_destino ?? url.searchParams.get("cp_destino") ?? "");
    const ciudadDestino = String(params.ciudad_destino ?? url.searchParams.get("ciudad_destino") ?? "");
    const valorDeclarado = Number(params.valor_declarado ?? url.searchParams.get("valor_declarado") ?? 0);

    if (!peso || peso <= 0) {
      return errorJson("'peso' es requerido y debe ser mayor a 0", 400);
    }

    logStep("Params", { peso, bultos, tipoServicio, cpDestino, valorDeclarado });

    // Determine which concept filters apply based on tipo_servicio
    const destinoEsPuerta = tipoServicio.endsWith("_puerta") || tipoServicio === "puerta_puerta";
    const origenEsPuerta = tipoServicio.startsWith("puerta_");

    // --- Fetch data in parallel ---
    const [tarifasRes, seguroRes, sucursalesRes] = await Promise.all([
      // Active tarifas for tenant
      supabase
        .from("tarifas")
        .select("id, nombre, precio_base, tipo_tarifa, rangos_precios, multiplicar_flete_por_bultos, zona_destino, rangos_kg")
        .eq("tenant_id", tenantId)
        .eq("activa", true),
      // Insurance config
      valorDeclarado > 0
        ? supabase
            .from("configuracion_seguro")
            .select("seguro_base, porcentaje_excedente, valor_minimo_declarado, valor_maximo_asegurado, activo")
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      // Pickup branches (only if service implies branch destination)
      (tipoServicio === "" || tipoServicio.endsWith("_sucursal") || tipoServicio === "sucursal_sucursal")
        ? supabase
            .from("sucursales")
            .select("nombre, direccion, ciudad, codigo_postal, lat, lng")
            .eq("tenant_id", tenantId)
            .eq("activa", true)
            .eq("permite_retiro_clientes", true)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (tarifasRes.error || !tarifasRes.data?.length) {
      logStep("No active tarifas", { error: tarifasRes.error?.message });
      return jsonResponse({ rates: [], pickup_points: [] });
    }

    const tarifas = tarifasRes.data;
    const seguro = seguroRes.data;

    // Fetch concepto precios for all tarifas in one query
    const tarifaIds = tarifas.map((t: any) => t.id);
    const { data: allConceptos } = await supabase
      .from("tarifa_concepto_precios")
      .select("tarifa_id, monto, concepto:tarifa_conceptos(codigo, nombre, es_basico)")
      .in("tarifa_id", tarifaIds);

    // Group conceptos by tarifa_id
    const conceptosByTarifa: Record<string, any[]> = {};
    for (const c of (allConceptos || [])) {
      if (!conceptosByTarifa[c.tarifa_id]) conceptosByTarifa[c.tarifa_id] = [];
      conceptosByTarifa[c.tarifa_id].push(c);
    }

    // --- Calculate rates ---
    const rates: Array<{ tarifa: string; precio: number; moneda: string; dias_entrega_min: number; dias_entrega_max: number }> = [];

    for (const tarifa of tarifas) {
      let precio = Number(tarifa.precio_base) || 0;

      // Multiply base by bultos if configured
      if (tarifa.multiplicar_flete_por_bultos && bultos > 1) {
        precio *= bultos;
      }

      // Weight-based additions
      if (tarifa.tipo_tarifa === "peso" && tarifa.rangos_precios) {
        const rangos = tarifa.rangos_precios as any;
        const pesoBaseHasta = Number(rangos.peso_base_hasta) || 0;
        const adicionalPorKg = Number(rangos.adicional_por_kg) || 0;
        if (peso > pesoBaseHasta) {
          precio += (peso - pesoBaseHasta) * adicionalPorKg;
        }
      }

      // Add concepts filtered by service type
      const conceptos = conceptosByTarifa[tarifa.id] || [];
      for (const c of conceptos) {
        const concepto = Array.isArray(c.concepto) ? c.concepto[0] : c.concepto;
        if (!concepto || typeof concepto !== "object") continue;

        const codigo = (concepto as any).codigo?.toLowerCase() || "";
        const esBasico = (concepto as any).es_basico;

        // If no tipo_servicio specified, include all basic concepts
        if (!tipoServicio) {
          if (esBasico) precio += Number(c.monto) || 0;
          continue;
        }

        // Filter by service type
        const isEntrega = codigo.includes("entrega") || codigo.includes("domicilio_entrega") || codigo.includes("puerta_entrega");
        const isRetiro = codigo.includes("retiro") || codigo.includes("domicilio_retiro") || codigo.includes("puerta_retiro");

        if (isEntrega && !destinoEsPuerta) continue;
        if (isRetiro && !origenEsPuerta) continue;

        if (esBasico || isEntrega || isRetiro) {
          precio += Number(c.monto) || 0;
        }
      }

      // Insurance calculation
      if (valorDeclarado > 0 && seguro && seguro.activo) {
        const seguroBase = Number(seguro.seguro_base) || 0;
        const porcentajeExcedente = Number(seguro.porcentaje_excedente) || 0;
        const valorMinimo = Number(seguro.valor_minimo_declarado) || 0;
        const clampedValor = Math.min(valorDeclarado, Number(seguro.valor_maximo_asegurado) || Infinity);

        let montoSeguro = seguroBase;
        if (clampedValor > valorMinimo && porcentajeExcedente > 0) {
          montoSeguro += (clampedValor - valorMinimo) * (porcentajeExcedente / 100);
        }
        precio += montoSeguro;
      }

      rates.push({
        tarifa: tarifa.nombre,
        precio: Math.round(precio * 100) / 100,
        moneda: "ARS",
        dias_entrega_min: 3,
        dias_entrega_max: 5,
      });
    }

    // --- Pickup points ---
    const pickupBranches = sucursalesRes.data || [];
    const pickup_points = pickupBranches.map((b: any) => ({
      nombre: b.nombre,
      direccion: b.direccion,
      ciudad: b.ciudad,
      codigo_postal: b.codigo_postal,
      lat: b.lat ? Number(b.lat) : null,
      lng: b.lng ? Number(b.lng) : null,
    }));

    logStep("Returning rates", { count: rates.length, pickups: pickup_points.length });

    return jsonResponse({ rates, pickup_points });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return errorJson(msg, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorJson(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
