import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's tenant
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Sin tenant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query shipments from last 90 days grouped by city and day of week
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: envios, error: enviosError } = await supabase
      .from("envios")
      .select("ciudad_entrega, created_at, estado")
      .eq("tenant_id", profile.tenant_id)
      .gte("created_at", ninetyDaysAgo.toISOString())
      .not("ciudad_entrega", "is", null);

    if (enviosError) {
      console.error("Error fetching envios:", enviosError);
      return new Response(JSON.stringify({ error: "Error al consultar datos" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!envios || envios.length === 0) {
      return new Response(JSON.stringify({
        predicciones: [],
        resumen: "No hay datos históricos suficientes para generar predicciones.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate by zone and day of week
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const zoneData: Record<string, Record<string, number>> = {};

    for (const e of envios) {
      const zona = (e.ciudad_entrega || "").trim();
      if (!zona) continue;
      const dayIndex = new Date(e.created_at).getDay();
      const dayName = dayNames[dayIndex];
      if (!zoneData[zona]) {
        zoneData[zona] = { Dom: 0, Lun: 0, Mar: 0, "Mié": 0, Jue: 0, Vie: 0, "Sáb": 0 };
      }
      zoneData[zona][dayName]++;
    }

    // Get top 20 zones by volume
    const sortedZones = Object.entries(zoneData)
      .map(([zona, days]) => ({
        zona,
        total: Object.values(days).reduce((a, b) => a + b, 0),
        days,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    // Calculate weeks for averaging
    const weeks = 90 / 7;

    // Build prompt
    const zonesText = sortedZones
      .map((z) => {
        const avgPerDay = Object.entries(z.days)
          .map(([day, count]) => `${day}: ${Math.round(count / weeks)}`)
          .join(" | ");
        return `Zona: "${z.zona}" | ${avgPerDay} | Total 90d: ${z.total}`;
      })
      .join("\n");

    // Get next 3 days
    const today = new Date();
    const nextDays = [1, 2, 3].map((offset) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return { name: dayNames[d.getDay()], date: d.toISOString().slice(0, 10) };
    });

    const prompt = `Analiza estos datos históricos de envíos por zona (promedio semanal de los últimos 90 días) y predice el volumen para los próximos 3 días (${nextDays.map((d) => `${d.name} ${d.date}`).join(", ")}).

Datos históricos (promedio envíos/semana por día):
${zonesText}

Hoy es ${dayNames[today.getDay()]} ${today.toISOString().slice(0, 10)}.

Considera patrones de día de la semana, tendencias, y estacionalidad. Devuelve la predicción estructurada.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Eres un analista de logística. Analiza datos históricos de envíos y genera predicciones de demanda por zona. Responde siempre usando la herramienta proporcionada.",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "predict_demand",
              description: "Devuelve predicción de demanda por zona para los próximos 3 días",
              parameters: {
                type: "object",
                properties: {
                  predicciones: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        zona: { type: "string" },
                        promedio_historico: { type: "number", description: "Promedio diario histórico" },
                        dia1: { type: "number", description: "Predicción día 1" },
                        dia2: { type: "number", description: "Predicción día 2" },
                        dia3: { type: "number", description: "Predicción día 3" },
                        tendencia: { type: "string", enum: ["creciendo", "estable", "bajando"] },
                        confianza: { type: "number", description: "Nivel de confianza 0-1" },
                      },
                      required: ["zona", "promedio_historico", "dia1", "dia2", "dia3", "tendencia", "confianza"],
                      additionalProperties: false,
                    },
                  },
                  resumen: { type: "string", description: "Resumen ejecutivo de las predicciones en español" },
                },
                required: ["predicciones", "resumen"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "predict_demand" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta en unos minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Agrega fondos en Configuración > Workspace > Uso." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Error en el servicio de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "La IA no devolvió una predicción estructurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prediction = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      ...prediction,
      dias: nextDays,
      generado_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("predict-demand error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
