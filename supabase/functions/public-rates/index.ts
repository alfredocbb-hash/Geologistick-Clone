import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ciudadMatchPartial } from "../_shared/ciudadMatch.ts";


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

function extractNumericCP(cp: string): number {
  const cleaned = cp.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : NaN;
}

function cpInRange(cp: string, from: string, to: string): boolean {
  const cpNum = extractNumericCP(cp);
  const fromNum = extractNumericCP(from);
  const toNum = extractNumericCP(to);
  if (!isNaN(cpNum) && !isNaN(fromNum) && !isNaN(toNum)) {
    return cpNum >= fromNum && cpNum <= toNum;
  }
  return cp >= from && cp <= to;
}

function encontrarTarifaPorDestino(
  ciudad: string | null,
  cp: string | null,
  peso: number,
  tarifas: any[]
): any | null {
  if (!ciudad && !cp) return null; // No destination = no match (same as NewShipment)
  const ciudadNorm = ciudad ? normalizarTexto(ciudad) : '';
  const cpTrim = cp?.trim() || '';

  const coincidentesZona = tarifas.filter((t: any) => {
    if (!t.zona_destino) return false;
    const destinos = t.zona_destino.split(',').map((d: string) => normalizarTexto(d.trim()));
    if (ciudadNorm && destinos.some((d: string) => d.includes(ciudadNorm) || ciudadNorm.includes(d))) return true;
    if (cpTrim && destinos.some((d: string) => d === cpTrim)) return true;
    return false;
  });

  if (coincidentesZona.length === 0) return null; // No match = no rate
  if (coincidentesZona.length === 1) return coincidentesZona[0];

  // Multiple matches: pick the one whose weight range fits best
  if (peso > 0) {
    const porPeso = coincidentesZona.filter((t: any) => {
      const rangos = Array.isArray(t.rangos_kg) ? t.rangos_kg : [];
      return rangos.some((r: any) => peso >= r.desde && peso <= r.hasta);
    });
    if (porPeso.length > 0) return porPeso[0]; // Best match by weight
  }

  return coincidentesZona[0]; // Return first match (single tariff)
}

// --- Auto-resolution helpers ---

async function resolveOrigen(
  supabase: any,
  tenantId: string,
  cpOrigen: string,
  ciudadOrigen: string
): Promise<{ cpOrigen: string; ciudadOrigen: string; sucursalNombre: string | null; resolved: boolean }> {
  // Both provided or neither — nothing to resolve
  if ((cpOrigen && ciudadOrigen) || (!cpOrigen && !ciudadOrigen)) {
    return { cpOrigen, ciudadOrigen, sucursalNombre: null, resolved: false };
  }

  // sucursales does NOT have codigo_postal, so we can only resolve by ciudad
  const orConditions: string[] = [];
  if (ciudadOrigen) orConditions.push(`ciudad.ilike.%${ciudadOrigen.trim()}%`);
  // For CP we try to match against the address field as a fallback (unlikely to help much)
  // But since sucursales has no CP column, if only CP is given we can try sucursal_zonas
  if (cpOrigen && !ciudadOrigen) {
    // Try sucursal_zonas to find city for this CP
    const { data: zones } = await supabase
      .from('sucursal_zonas')
      .select('ciudad, codigo_postal_desde, codigo_postal_hasta, sucursal_id, sucursales:sucursal_id(nombre, ciudad, tenant_id)')
      .eq('activa', true);

    if (zones && zones.length > 0) {
      for (const z of zones) {
        const suc = Array.isArray(z.sucursales) ? z.sucursales[0] : z.sucursales;
        if (!suc || suc.tenant_id !== tenantId) continue;
        if (z.codigo_postal_desde && cpInRange(cpOrigen, z.codigo_postal_desde, z.codigo_postal_hasta || z.codigo_postal_desde)) {
          return {
            cpOrigen,
            ciudadOrigen: z.ciudad || suc.ciudad || '',
            sucursalNombre: suc.nombre || null,
            resolved: true,
          };
        }
      }
    }
    return { cpOrigen, ciudadOrigen: '', sucursalNombre: null, resolved: false };
  }

  // ciudadOrigen provided, no CP — just return as-is (no CP column on sucursales)
  return { cpOrigen: '', ciudadOrigen, sucursalNombre: null, resolved: false };
}

async function resolveDestino(
  supabase: any,
  tenantId: string,
  cpDestino: string,
  ciudadDestino: string
): Promise<{ cpDestino: string; ciudadDestino: string; resolved: boolean }> {
  if ((cpDestino && ciudadDestino) || (!cpDestino && !ciudadDestino)) {
    return { cpDestino, ciudadDestino, resolved: false };
  }

  // Query sucursal_zonas for this tenant's branches
  const { data: zones } = await supabase
    .from('sucursal_zonas')
    .select('ciudad, codigo_postal_desde, codigo_postal_hasta, sucursal_id, sucursales:sucursal_id(tenant_id)')
    .eq('activa', true);

  const tenantZones = (zones || []).filter((z: any) => {
    const suc = Array.isArray(z.sucursales) ? z.sucursales[0] : z.sucursales;
    return suc && suc.tenant_id === tenantId;
  });

  if (cpDestino && !ciudadDestino) {
    // Find city by CP range
    for (const z of tenantZones) {
      if (z.codigo_postal_desde && cpInRange(cpDestino, z.codigo_postal_desde, z.codigo_postal_hasta || z.codigo_postal_desde)) {
        return { cpDestino, ciudadDestino: z.ciudad || '', resolved: true };
      }
    }
    return { cpDestino, ciudadDestino: '', resolved: false };
  }

  if (ciudadDestino && !cpDestino) {
    // Find CP by city
    const ciudadNorm = normalizarTexto(ciudadDestino);
    for (const z of tenantZones) {
      if (z.ciudad) {
        const zoneCiudad = normalizarTexto(z.ciudad);
        if (zoneCiudad === ciudadNorm || zoneCiudad.includes(ciudadNorm) || ciudadNorm.includes(zoneCiudad)) {
          return { cpDestino: z.codigo_postal_desde || '', ciudadDestino, resolved: true };
        }
      }
    }
    return { cpDestino: '', ciudadDestino, resolved: false };
  }

  return { cpDestino, ciudadDestino, resolved: false };
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
    const peso = Number(params.peso ?? url.searchParams.get("peso") ?? 0);
    const bultos = Math.max(1, Number(params.bultos ?? url.searchParams.get("bultos") ?? 1));
    const tipoServicio = String(params.tipo_servicio ?? url.searchParams.get("tipo_servicio") ?? "");
    let cpOrigen = String(params.cp_origen ?? url.searchParams.get("cp_origen") ?? "");
    let ciudadOrigen = String(params.ciudad_origen ?? url.searchParams.get("ciudad_origen") ?? "");
    let cpDestino = String(params.cp_destino ?? url.searchParams.get("cp_destino") ?? "");
    let ciudadDestino = String(params.ciudad_destino ?? url.searchParams.get("ciudad_destino") ?? "");
    const valorDeclarado = Number(params.valor_declarado ?? url.searchParams.get("valor_declarado") ?? 0);
    const largo = Number(params.largo ?? url.searchParams.get("largo") ?? 0);
    const ancho = Number(params.ancho ?? url.searchParams.get("ancho") ?? 0);
    const alto = Number(params.alto ?? url.searchParams.get("alto") ?? 0);

    if (!peso || peso <= 0) {
      return errorJson("'peso' es requerido y debe ser mayor a 0", 400);
    }

    logStep("Params", { peso, bultos, tipoServicio, cpOrigen, ciudadOrigen, cpDestino, ciudadDestino, valorDeclarado, largo, ancho, alto });

    // --- Auto-resolve origin & destination ---
    const [origenRes, destinoRes] = await Promise.all([
      resolveOrigen(supabase, tenantId, cpOrigen, ciudadOrigen),
      resolveDestino(supabase, tenantId, cpDestino, ciudadDestino),
    ]);

    cpOrigen = origenRes.cpOrigen;
    ciudadOrigen = origenRes.ciudadOrigen;
    cpDestino = destinoRes.cpDestino;
    ciudadDestino = destinoRes.ciudadDestino;

    if (origenRes.resolved || destinoRes.resolved) {
      logStep("Auto-resolved", {
        origen: origenRes.resolved ? { ciudad: ciudadOrigen, cp: cpOrigen } : 'no change',
        destino: destinoRes.resolved ? { ciudad: ciudadDestino, cp: cpDestino } : 'no change',
      });
    }

    // Determine which concept filters apply based on tipo_servicio
    const destinoEsPuerta = tipoServicio.endsWith("_puerta") || tipoServicio === "puerta_puerta";
    const origenEsPuerta = tipoServicio.startsWith("puerta_");

    // --- Fetch data in parallel ---
    const [tarifasRes, seguroRes, sucursalesRes] = await Promise.all([
      supabase
        .from("tarifas")
        .select("id, nombre, precio_base, tipo_tarifa, rangos_precios, multiplicar_flete_por_bultos, porcentaje_flete_bulto, zona_destino, rangos_kg, precio_por_m3, umbral_volumen_cm")
        .eq("tenant_id", tenantId)
        .eq("activa", true),
      valorDeclarado > 0
        ? supabase
            .from("configuracion_seguro")
            .select("seguro_base, porcentaje_excedente, valor_minimo_declarado, valor_maximo_asegurado, activo")
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      (tipoServicio === "" || tipoServicio.endsWith("_sucursal") || tipoServicio === "sucursal_sucursal")
        ? supabase
            .from("sucursales")
            .select("id, nombre, direccion, ciudad, lat, lng")
            .eq("tenant_id", tenantId)
            .eq("activa", true)
            .eq("permite_retiro_clientes", true)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (tarifasRes.error || !tarifasRes.data?.length) {
      logStep("No active tarifas", { error: tarifasRes.error?.message });
      return jsonResponse({ rates: [], pickup_points: [], resolucion: buildResolucion(origenRes, destinoRes) });
    }

    let tarifasActivas = tarifasRes.data;

    // --- Filter by origin branch (sucursal_tarifas) ---
    if (ciudadOrigen) {
      const { data: matchedBranch } = await supabase
        .from("sucursales")
        .select("id, nombre, ciudad")
        .eq("tenant_id", tenantId)
        .eq("activa", true)
        .ilike("ciudad", `%${ciudadOrigen.trim()}%`)
        .limit(1)
        .maybeSingle();

      const sucursalOrigenId = matchedBranch?.id || null;

      if (sucursalOrigenId) {
        if (!origenRes.sucursalNombre) {
          origenRes.sucursalNombre = matchedBranch?.nombre || null;
        }

        const { data: sucTarifas } = await supabase
          .from("sucursal_tarifas")
          .select("tarifa_id")
          .eq("sucursal_id", sucursalOrigenId)
          .eq("habilitada", true);

        if (sucTarifas && sucTarifas.length > 0) {
          const enabledIds = new Set(sucTarifas.map((st: any) => st.tarifa_id));
          tarifasActivas = tarifasActivas.filter((t: any) => enabledIds.has(t.id));
          logStep("Filtered by origin branch", { sucursalOrigenId, before: tarifasRes.data.length, after: tarifasActivas.length });
        } else {
          logStep("No sucursal_tarifas for branch, using all", { sucursalOrigenId });
        }
      } else {
        logStep("No matching origin branch found, using all tarifas");
      }
    }

    // Filter tarifas by destination matching — returns single best match or null
    const tarifaMatch = encontrarTarifaPorDestino(ciudadDestino || null, cpDestino || null, peso, tarifasActivas);
    
    // If destination was provided but no tariff matched, return empty (same as NewShipment)
    const tarifas = tarifaMatch ? [tarifaMatch] : ((!ciudadDestino && !cpDestino) ? tarifasActivas : []);
    logStep("Tarifas after filters", { total: tarifasRes.data.length, afterOrigin: tarifasActivas.length, afterDestino: tarifas.length });
    const seguro = seguroRes.data;

    // Fetch concepto precios for all tarifas in one query
    const tarifaIds = tarifas.map((t: any) => t.id);
    const { data: allConceptos } = tarifaIds.length > 0
      ? await supabase
          .from("tarifa_concepto_precios")
          .select("tarifa_id, monto, es_porcentaje, porcentaje, multiplicar_por_bultos, concepto:tarifa_conceptos(codigo, nombre, es_basico, activo)")
          .in("tarifa_id", tarifaIds)
      : { data: [] };

    // Group conceptos by tarifa_id
    const conceptosByTarifa: Record<string, any[]> = {};
    for (const c of (allConceptos || [])) {
      const concepto = Array.isArray(c.concepto) ? c.concepto[0] : c.concepto;
      // Filter out inactive concepts
      if (concepto && concepto.activo === false) continue;
      if (!conceptosByTarifa[c.tarifa_id]) conceptosByTarifa[c.tarifa_id] = [];
      conceptosByTarifa[c.tarifa_id].push(c);
    }

    // --- Calculate rates ---
    const rates: any[] = [];

    for (const tarifa of tarifas) {
      const precioBase = Number(tarifa.precio_base) || 0;
      const rangosKg = Array.isArray(tarifa.rangos_kg) ? tarifa.rangos_kg : [];
      const rangos = (tarifa.rangos_precios as any) || {};
      const multiplicarPorBultos = !!tarifa.multiplicar_flete_por_bultos;

      let flete = precioBase;
      let metodo = 'base';

      // --- Hierarchy: volumen > rangos_kg > rangos_precios > base ---

      // Volume check (highest priority) — same logic as NewShipment
      const umbralVolumen = Number(tarifa.umbral_volumen_cm) || 50;
      const precioPorM3 = Number(tarifa.precio_por_m3) || 0;
      let detalleVolumen: Record<string, unknown> | null = null;

      if (
        tarifa.tipo_tarifa === 'peso' &&
        largo > 0 && ancho > 0 && alto > 0 &&
        precioPorM3 > 0 &&
        (largo > umbralVolumen || ancho > umbralVolumen || alto > umbralVolumen)
      ) {
        const volumenM3 = (largo * ancho * alto) / 1_000_000;
        flete = precioBase + (volumenM3 * precioPorM3);
        metodo = 'volumen_excedido';
        detalleVolumen = {
          dimensiones_cm: { largo, ancho, alto },
          volumen_m3: Math.round(volumenM3 * 1_000_000) / 1_000_000,
          umbral_cm: umbralVolumen,
        };
      } else if (tarifa.tipo_tarifa === 'peso') {
        if (rangosKg.length > 0 && peso > 0) {
          const rangoAplicable = rangosKg.find((r: any) => peso >= r.desde && peso <= r.hasta);
          if (rangoAplicable) {
            flete = Number(rangoAplicable.precio) || 0;
            metodo = 'rangos_kg';
          } else {
            const ultimoRango = rangosKg[rangosKg.length - 1];
            if (ultimoRango && peso > ultimoRango.hasta) {
              flete = Number(ultimoRango.precio) || 0;
              metodo = 'rangos_kg_excedido';
            }
          }
        }

        if (metodo === 'base') {
          const pesoBaseHasta = Number(rangos.peso_base_hasta) || 0;
          const adicionalPorKg = Number(rangos.adicional_por_kg) || 0;
          if (peso > pesoBaseHasta && adicionalPorKg > 0) {
            flete = precioBase + (peso - pesoBaseHasta) * adicionalPorKg;
            metodo = 'peso_simple';
          }
        }
      }

      // --- Add "flete" concept amount to base freight ---
      const conceptos = conceptosByTarifa[tarifa.id] || [];
      const conceptoFlete = conceptos.find((c: any) => {
        const concepto = Array.isArray(c.concepto) ? c.concepto[0] : c.concepto;
        if (!concepto) return false;
        const codigo = concepto.codigo?.toLowerCase() || '';
        const nombre = concepto.nombre?.toLowerCase() || '';
        return codigo === 'flete' || nombre === 'flete';
      });
      if (conceptoFlete) {
        const montoFlete = Number(conceptoFlete.monto) || 0;
        if (montoFlete > 0) flete += montoFlete;
      }

      // --- Apply package multiplier OR percentage surcharge ---
      let fleteTotal = flete;
      if (multiplicarPorBultos && bultos > 1) {
        fleteTotal = flete * bultos;
      } else if (!multiplicarPorBultos && bultos > 1) {
        const pctBulto = Number(tarifa.porcentaje_flete_bulto) || 0;
        if (pctBulto > 0) {
          const recargo = flete * (pctBulto / 100) * (bultos - 1);
          fleteTotal = flete + recargo;
        }
      }

      let precio = fleteTotal;
      const conceptos_incluidos: Array<{ nombre: string; codigo: string; monto: number }> = [];
      const conceptos_opcionales: Array<{ nombre: string; codigo: string; monto: number }> = [];

      // --- Add concepts (excluding "flete" already added) ---
      for (const c of conceptos) {
        if (c === conceptoFlete) continue;

        const concepto = Array.isArray(c.concepto) ? c.concepto[0] : c.concepto;
        if (!concepto || typeof concepto !== "object") continue;

        const codigo = (concepto as any).codigo?.toLowerCase() || "";
        const nombre = (concepto as any).nombre || "";
        const esBasico = (concepto as any).es_basico;

        const isEntrega = codigo.includes("entrega") || codigo.includes("domicilio_entrega") || codigo.includes("puerta_entrega");
        const isRetiro = codigo.includes("retiro") || codigo.includes("domicilio_retiro") || codigo.includes("puerta_retiro");

        // Calculate concept amount
        let montoConcepto = 0;
        if (c.es_porcentaje && c.porcentaje) {
          montoConcepto = valorDeclarado * Number(c.porcentaje) / 100;
        } else {
          montoConcepto = Number(c.monto) || 0;
        }
        if (c.multiplicar_por_bultos && bultos > 1) {
          montoConcepto *= bultos;
        }
        montoConcepto = Math.round(montoConcepto * 100) / 100;

        // Determine if concept should be auto-included (es_basico) or optional
        const conceptoInfo = { nombre, codigo, monto: montoConcepto };

        // Service-type filtering for entrega/retiro concepts
        if (isEntrega && !destinoEsPuerta) {
          conceptos_opcionales.push(conceptoInfo);
          continue;
        }
        if (isRetiro && !origenEsPuerta) {
          conceptos_opcionales.push(conceptoInfo);
          continue;
        }

        // es_basico = true (or null as fallback) → auto-include in price
        // es_basico = false → optional, don't add to price
        if (esBasico === true || esBasico === null || esBasico === undefined) {
          // For entrega/retiro concepts, only include if matching service type
          if (isEntrega || isRetiro || (!isEntrega && !isRetiro)) {
            precio += montoConcepto;
            conceptos_incluidos.push(conceptoInfo);
          }
        } else {
          conceptos_opcionales.push(conceptoInfo);
        }
      }

      // --- Insurance ---
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
        metodo,
        conceptos_incluidos,
        conceptos_opcionales,
        ...(detalleVolumen ? { detalle_volumen: detalleVolumen } : {}),
      });
    }

    // --- Pickup points (with id for selector) ---
    const pickupBranches = sucursalesRes.data || [];
    const pickup_points = pickupBranches.map((b: any) => ({
      id: b.id,
      nombre: b.nombre,
      direccion: b.direccion,
      ciudad: b.ciudad,
      lat: b.lat ? Number(b.lat) : null,
      lng: b.lng ? Number(b.lng) : null,
    }));

    const resolucion = buildResolucion(origenRes, destinoRes);

    logStep("Returning rates", { count: rates.length, pickups: pickup_points.length, resolved: origenRes.resolved || destinoRes.resolved });

    return jsonResponse({ rates, pickup_points, resolucion });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return errorJson(msg, 500);
  }
});

function buildResolucion(
  origenRes: { cpOrigen: string; ciudadOrigen: string; sucursalNombre: string | null; resolved: boolean },
  destinoRes: { cpDestino: string; ciudadDestino: string; resolved: boolean }
) {
  const resolucion: Record<string, any> = {};

  if (origenRes.cpOrigen || origenRes.ciudadOrigen) {
    resolucion.origen = {
      ciudad: origenRes.ciudadOrigen || null,
      codigo_postal: origenRes.cpOrigen || null,
      ...(origenRes.sucursalNombre ? { sucursal: origenRes.sucursalNombre } : {}),
      auto_resuelto: origenRes.resolved,
    };
  }

  if (destinoRes.cpDestino || destinoRes.ciudadDestino) {
    resolucion.destino = {
      ciudad: destinoRes.ciudadDestino || null,
      codigo_postal: destinoRes.cpDestino || null,
      auto_resuelto: destinoRes.resolved,
    };
  }

  return Object.keys(resolucion).length > 0 ? resolucion : undefined;
}

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
