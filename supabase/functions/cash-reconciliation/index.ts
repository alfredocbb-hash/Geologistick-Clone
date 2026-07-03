import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METHODS = ["efectivo", "transferencia", "mercado_pago", "tarjeta"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant no encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tenantId = profile.tenant_id;

    const body = await req.json().catch(() => ({}));
    const desde: string = body.desde || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const hasta: string = body.hasta || new Date().toISOString();

    // ---- Pagos por método ----
    const { data: pagosData } = await supabase
      .from("pagos")
      .select("metodo, monto, estado, mercado_pago_status")
      .eq("tenant_id", tenantId)
      .gte("created_at", desde)
      .lte("created_at", hasta);

    const pagosPorMetodo: Record<string, number> = { efectivo: 0, transferencia: 0, mercado_pago: 0, tarjeta: 0 };
    for (const p of pagosData || []) {
      const validoGeneral = ["pagado", "cobrado_chofer", "rendido"].includes(p.estado || "");
      const mpAprobado = p.metodo === "mercado_pago" && p.mercado_pago_status === "approved";
      if (validoGeneral || mpAprobado) {
        pagosPorMetodo[p.metodo] = (pagosPorMetodo[p.metodo] || 0) + Number(p.monto || 0);
      }
    }

    // ---- Facturas del día ----
    const { data: facturasData } = await supabase
      .from("facturas")
      .select("id, importe_total, es_nota_credito, envio_id")
      .eq("tenant_id", tenantId)
      .eq("estado", "emitida")
      .gte("fecha_emision", desde)
      .lte("fecha_emision", hasta);

    let facturasTotal = 0;
    let facturasCount = 0;
    let notasCreditoTotal = 0;
    const envioIds = new Set<string>();
    for (const f of facturasData || []) {
      const monto = Number(f.importe_total || 0);
      if (f.es_nota_credito) notasCreditoTotal += monto;
      else facturasTotal += monto;
      facturasCount++;
      if (f.envio_id) envioIds.add(f.envio_id);
    }
    const facturasNeto = facturasTotal - notasCreditoTotal;

    // Método inferido del pago asociado al envío
    const facturasPorMetodo: Record<string, number> = { efectivo: 0, transferencia: 0, mercado_pago: 0, tarjeta: 0, sin_metodo: 0 };
    if (envioIds.size > 0) {
      const { data: pagosDeFacturas } = await supabase
        .from("pagos")
        .select("envio_id, metodo")
        .in("envio_id", Array.from(envioIds));
      const metodoPorEnvio = new Map<string, string>();
      for (const p of pagosDeFacturas || []) {
        if (p.envio_id && !metodoPorEnvio.has(p.envio_id)) metodoPorEnvio.set(p.envio_id, p.metodo);
      }
      for (const f of facturasData || []) {
        if (f.es_nota_credito) continue;
        const monto = Number(f.importe_total || 0);
        const metodo = f.envio_id ? metodoPorEnvio.get(f.envio_id) : undefined;
        if (metodo && METHODS.includes(metodo as any)) facturasPorMetodo[metodo] += monto;
        else facturasPorMetodo.sin_metodo += monto;
      }
    }

    // ---- MP balance + cobros del día ----
    let mpBalance: any = null;
    let mpCobrosDia: any = null;
    let mpError: string | null = null;

    const { data: tokenRows } = await supabase
      .from("system_integrations")
      .select("config_value, environment")
      .eq("integration_type", "mercado_pago")
      .eq("config_key", "access_token")
      .eq("is_active", true)
      .eq("tenant_id", tenantId);

    const tokenConfig =
      tokenRows?.find((r: any) => r.environment === "production") ??
      tokenRows?.find((r: any) => r.environment === "sandbox") ?? null;

    if (!tokenConfig?.config_value) {
      mpError = "Mercado Pago no está configurado";
    } else {
      const accessToken = tokenConfig.config_value;
      try {
        const meRes = await fetch("https://api.mercadopago.com/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const me = meRes.ok ? await meRes.json() : null;

        const balRes = await fetch("https://api.mercadopago.com/v1/account/balance", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (balRes.ok) {
          const bal = await balRes.json();
          mpBalance = {
            available: bal.available_balance ?? bal.total_amount ?? null,
            currency: bal.currency_id ?? "ARS",
            nickname: me?.nickname ?? null,
            collector_id: me?.id ?? null,
            raw: bal,
          };
        } else {
          mpError = `MP balance HTTP ${balRes.status}`;
        }

        // Cobros aprobados del día (paginado)
        const beginDate = encodeURIComponent(desde);
        const endDate = encodeURIComponent(hasta);
        let total = 0;
        let count = 0;
        for (let offset = 0; offset < 1000; offset += 200) {
          const url = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&status=approved&range=date_created&begin_date=${beginDate}&end_date=${endDate}&limit=200&offset=${offset}`;
          const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (!r.ok) break;
          const j = await r.json();
          const results = j.results || [];
          for (const p of results) total += Number(p.transaction_amount || 0);
          count += results.length;
          if (results.length < 200) break;
        }
        mpCobrosDia = { total, count };
      } catch (e) {
        mpError = e instanceof Error ? e.message : "Error MP";
      }
    }

    return new Response(
      JSON.stringify({
        rango: { desde, hasta },
        pagos_por_metodo: pagosPorMetodo,
        facturas: {
          total_bruto: facturasTotal,
          notas_credito: notasCreditoTotal,
          total_neto: facturasNeto,
          count: facturasCount,
          por_metodo: facturasPorMetodo,
        },
        mp_balance: mpBalance,
        mp_cobros_dia: mpCobrosDia,
        mp_error: mpError,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
