import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnalysisRequest {
  mode: "driver" | "summary";
  driverId?: string;
  routeId?: string;
  currentPosition?: { lat: number; lng: number };
  pendingStops?: Array<{ lat: number; lng: number; address: string; trackingNumber: string }>;
  completedStops?: Array<{ lat: number; lng: number; deliveredAt: string; trackingNumber: string }>;
  locationHistory?: Array<{ lat: number; lng: number; recorded_at: string; speed?: number }>;
  routeStartTime?: string;
  // For summary mode
  driversData?: Array<{
    name: string;
    activeRoute: string;
    completedStops: number;
    pendingStops: number;
    status: string;
    lastUpdate: string;
    avgSpeedKmh?: number;
    distanceKm?: number;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Not authenticated");

    const body: AnalysisRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let prompt: string;
    let toolDef: any;

    if (body.mode === "summary") {
      // Summary mode: analyze all active drivers
      prompt = buildSummaryPrompt(body.driversData || []);
      toolDef = {
        type: "function",
        function: {
          name: "generate_operations_summary",
          description: "Generate an operational summary of all active drivers",
          parameters: {
            type: "object",
            properties: {
              resumen_general: { type: "string", description: "Narrative summary of overall operations (2-3 paragraphs in Spanish)" },
              chofer_mas_eficiente: { type: "string", description: "Name and reason of most efficient driver" },
              alertas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    chofer: { type: "string" },
                    tipo: { type: "string", enum: ["demora", "sin_señal", "desvío", "bajo_rendimiento"] },
                    mensaje: { type: "string" },
                  },
                  required: ["chofer", "tipo", "mensaje"],
                },
              },
              sugerencias: {
                type: "array",
                items: { type: "string" },
                description: "Actionable improvement suggestions in Spanish",
              },
            },
            required: ["resumen_general", "alertas", "sugerencias"],
          },
        },
      };
    } else {
      // Driver analysis mode
      prompt = buildDriverPrompt(body);
      toolDef = {
        type: "function",
        function: {
          name: "analyze_driver_route",
          description: "Return structured analysis of a driver's route",
          parameters: {
            type: "object",
            properties: {
              eta_proxima_parada: { type: "string", description: "Estimated time of arrival to next stop (HH:MM format)" },
              eta_fin_ruta: { type: "string", description: "Estimated time to complete the full route (HH:MM format)" },
              riesgo_demora: { type: "string", enum: ["bajo", "medio", "alto"], description: "Delay risk level" },
              razon_riesgo: { type: "string", description: "Brief explanation of risk assessment in Spanish" },
              anomalias: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tipo: { type: "string", enum: ["parada_prolongada", "desvio", "velocidad_baja", "sin_movimiento"] },
                    mensaje: { type: "string", description: "Description in Spanish" },
                    severidad: { type: "string", enum: ["info", "warning", "critical"] },
                  },
                  required: ["tipo", "mensaje", "severidad"],
                },
              },
              resumen: { type: "string", description: "Brief narrative summary in Spanish (1-2 sentences)" },
            },
            required: ["eta_proxima_parada", "eta_fin_ruta", "riesgo_demora", "razon_riesgo", "anomalias", "resumen"],
          },
        },
      };
    }

    const toolName = body.mode === "summary" ? "generate_operations_summary" : "analyze_driver_route";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: "Eres un analista de logística y transporte. Analizas datos GPS de choferes de última milla para generar insights operativos. Responde siempre en español. Sé conciso y práctico. La hora actual es " + new Date().toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) + " (Argentina)."
          },
          { role: "user", content: prompt },
        ],
        tools: [toolDef],
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intentá de nuevo en unos minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured response from AI");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-driver-route error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildDriverPrompt(body: AnalysisRequest): string {
  const { currentPosition, pendingStops, completedStops, locationHistory, routeStartTime } = body;

  let prompt = "Analiza la ruta de este chofer de última milla:\n\n";

  if (routeStartTime) {
    prompt += `Inicio de ruta: ${new Date(routeStartTime).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}\n`;
  }

  if (currentPosition) {
    prompt += `Posición actual: lat ${currentPosition.lat.toFixed(5)}, lng ${currentPosition.lng.toFixed(5)}\n`;
  }

  if (completedStops && completedStops.length > 0) {
    prompt += `\nParadas completadas (${completedStops.length}):\n`;
    completedStops.slice(-5).forEach((s, i) => {
      prompt += `  ${i + 1}. ${s.trackingNumber} - entregado ${new Date(s.deliveredAt).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}\n`;
    });
  }

  if (pendingStops && pendingStops.length > 0) {
    prompt += `\nParadas pendientes (${pendingStops.length}):\n`;
    pendingStops.forEach((s, i) => {
      prompt += `  ${i + 1}. ${s.trackingNumber} - ${s.address} (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})\n`;
    });
  }

  if (locationHistory && locationHistory.length > 0) {
    const recentHistory = locationHistory.slice(-20);
    const speeds = recentHistory.filter(h => h.speed && h.speed > 0).map(h => h.speed!);
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

    prompt += `\nHistorial GPS reciente: ${locationHistory.length} puntos totales\n`;
    prompt += `Velocidad promedio reciente: ${(avgSpeed * 3.6).toFixed(1)} km/h\n`;

    // Detect long stops
    for (let i = 1; i < recentHistory.length; i++) {
      const prev = new Date(recentHistory[i - 1].recorded_at).getTime();
      const curr = new Date(recentHistory[i].recorded_at).getTime();
      const gapMin = (curr - prev) / 60000;
      if (gapMin > 10) {
        prompt += `⚠️ Pausa de ${Math.round(gapMin)} minutos detectada alrededor de las ${new Date(recentHistory[i - 1].recorded_at).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}\n`;
      }
    }
  }

  prompt += "\nGenera el análisis con ETA, riesgo de demora, anomalías detectadas y un breve resumen.";
  return prompt;
}

function buildSummaryPrompt(drivers: AnalysisRequest["driversData"]): string {
  if (!drivers || drivers.length === 0) {
    return "No hay choferes activos en este momento. Genera un resumen indicando que no hay operación en curso.";
  }

  let prompt = `Analiza la operación actual de ${drivers.length} choferes en ruta:\n\n`;

  drivers.forEach((d, i) => {
    prompt += `${i + 1}. ${d.name} - Ruta ${d.activeRoute}\n`;
    prompt += `   Entregas: ${d.completedStops} completadas, ${d.pendingStops} pendientes\n`;
    prompt += `   Estado: ${d.status}, Última señal: ${d.lastUpdate}\n`;
    if (d.avgSpeedKmh) prompt += `   Velocidad promedio: ${d.avgSpeedKmh.toFixed(1)} km/h\n`;
    if (d.distanceKm) prompt += `   Distancia recorrida: ${d.distanceKm.toFixed(1)} km\n`;
    prompt += "\n";
  });

  prompt += "Genera un resumen operativo general, identifica al chofer más eficiente, alertas y sugerencias de mejora.";
  return prompt;
}
