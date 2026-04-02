import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "image (base64 data URL) es requerida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analiza esta imagen de una etiqueta de envío de MercadoLibre o similar. Extrae los siguientes campos si están presentes. Responde SOLO con el JSON, sin texto adicional ni markdown.

Campos a extraer:
- mlShipmentId: número de envío (buscar "Envio:", "Envío:", "N° envio", números de 8-12 dígitos)
- direccion: dirección de entrega (buscar "Dirección:", "Dir:", calle y número)
- codigoPostal: código postal (buscar "CP:", "Cp:", "C.P.", números de 4 dígitos)
- localidad: ciudad/localidad (buscar "Localidad:", "Ciudad:")
- barrio: barrio o partido (buscar "Barrio:", "Partido:")
- nombreDestinatario: nombre del destinatario (buscar "Destinatario:", "Dest:", nombre de persona)
- referencia: referencia u observaciones (buscar "Referencia:", "Ref:", "Obs:", instrucciones de entrega)

Formato de respuesta (JSON puro):
{"mlShipmentId":"","direccion":"","codigoPostal":"","localidad":"","barrio":"","nombreDestinatario":"","referencia":""}

Reglas:
- Si un campo no se encuentra, dejarlo como string vacío ""
- No inventar datos
- Limpiar texto basura del OCR (caracteres sueltos, ruido)
- El mlShipmentId debe ser solo números`
              },
              {
                type: "image_url",
                image_url: { url: image }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, intente de nuevo" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Error al procesar la imagen" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    // Parse JSON from the response (may have markdown fences)
    let extracted: Record<string, string> = {};
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawContent);
    }

    // Normalize: ensure all expected keys exist as strings
    const result = {
      mlShipmentId: String(extracted.mlShipmentId || "").trim(),
      direccion: String(extracted.direccion || "").trim(),
      codigoPostal: String(extracted.codigoPostal || "").trim(),
      localidad: String(extracted.localidad || "").trim(),
      barrio: String(extracted.barrio || "").trim(),
      nombreDestinatario: String(extracted.nombreDestinatario || "").trim(),
      referencia: String(extracted.referencia || "").trim(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-label error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
