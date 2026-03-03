import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Stop {
  index: number;
  lat: number;
  lng: number;
  tipo: "retiro" | "entrega" | "sucursal";
  direccion: string;
  horario_preferido?: string; // mañana, tarde, noche, cualquier_hora
  ciudad?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stops, origin } = await req.json() as {
      stops: Stop[];
      origin: { lat: number; lng: number };
    };

    if (!stops || stops.length < 2) {
      return new Response(
        JSON.stringify({ error: "Se necesitan al menos 2 paradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (stops.length > 80) {
      return new Response(
        JSON.stringify({ error: "Máximo 80 paradas permitidas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the prompt with stop data
    const stopsDescription = stops.map((s, i) => 
      `[${i}] lat=${s.lat.toFixed(5)}, lng=${s.lng.toFixed(5)}, tipo=${s.tipo}, horario=${s.horario_preferido || "cualquier_hora"}, ciudad=${s.ciudad || "N/A"}`
    ).join("\n");

    const systemPrompt = `Eres un optimizador de rutas de delivery/logística en Argentina. 
Tu trabajo es ordenar las paradas de forma óptima considerando:
1. PRIORIDAD MÁXIMA: Respetar franjas horarias (mañana=8-12h, tarde=12-18h, noche=18-22h). Las paradas con horario "mañana" deben ir primero, luego "tarde", luego "noche". "cualquier_hora" es flexible.
2. Dentro de cada franja horaria, agrupar por proximidad geográfica (clusters de zona/ciudad).
3. Los retiros deben hacerse antes que las entregas cuando sea posible, especialmente si están en la misma zona.
4. Las sucursales funcionan como puntos de paso intermedios para dejar/recoger paquetes.
5. Minimizar la distancia total recorrida y evitar zigzag entre zonas.

El punto de origen es lat=${origin.lat.toFixed(5)}, lng=${origin.lng.toFixed(5)}.

Devuelve el orden óptimo de las paradas usando la función optimize_stops.`;

    const userPrompt = `Optimiza el orden de estas ${stops.length} paradas:\n\n${stopsDescription}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "optimize_stops",
              description: "Return the optimized order of stop indices and a brief explanation of the reasoning.",
              parameters: {
                type: "object",
                properties: {
                  ordered_indices: {
                    type: "array",
                    items: { type: "integer" },
                    description: "Array of stop indices in the optimized order. Must contain all indices from 0 to N-1 exactly once.",
                  },
                  reasoning: {
                    type: "string",
                    description: "Brief explanation in Spanish of why this order is optimal (max 2 sentences).",
                  },
                },
                required: ["ordered_indices", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "optimize_stops" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA agotados. Contacta al administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Error del servicio de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    
    // Extract tool call result
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiResult));
      return new Response(
        JSON.stringify({ error: "Respuesta de IA inválida" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const orderedIndices: number[] = parsed.ordered_indices;
    const reasoning: string = parsed.reasoning;

    // Validate indices
    const expectedIndices = new Set(Array.from({ length: stops.length }, (_, i) => i));
    const receivedIndices = new Set(orderedIndices);

    if (orderedIndices.length !== stops.length || 
        receivedIndices.size !== expectedIndices.size ||
        ![...receivedIndices].every(i => expectedIndices.has(i))) {
      console.error("Invalid indices from AI:", orderedIndices, "expected:", [...expectedIndices]);
      return new Response(
        JSON.stringify({ error: "La IA devolvió índices inválidos. Usa las opciones locales." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ordered_indices: orderedIndices, reasoning }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("optimize-route error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
