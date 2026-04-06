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
                text: `Analiza esta imagen de una etiqueta/comprobante de envío. Extrae TODA la información logística disponible. Responde SOLO con el JSON puro.

Campos a extraer:
- mlShipmentId: Números de 8-12 dígitos precedidos por "Envio:", "Envío:", "N° envio".
- trackingNumber: Cualquier número de seguimiento, factura, remito o identificador (Ej: "Factura:", "Remito:", "Seguimiento:", "TRK-...", etc).
- direccion: Calle y número de entrega.
- codigoPostal: Código postal (4 dígitos).
- localidad: Ciudad o localidad de entrega.
- barrio: Barrio o partido.
- provincia: Provincia o estado.
- nombreDestinatario: Nombre de la persona que recibe.
- telefonoDestinatario: Teléfono o celular del destinatario.
- emailDestinatario: Email del destinatario.
- dniDestinatario: DNI o documento del destinatario.
- referencia: Observaciones, entre-calles, piso/depto o instrucciones de entrega.
- nombreRemitente: Nombre del remitente/emisor/vendedor.
- direccionRetiro: Dirección de origen/retiro del paquete.
- cantidadBultos: Cantidad de bultos o paquetes (número).
- pesoKg: Peso en kg (número).
- valorDeclarado: Valor declarado en pesos (número).
- tipoPago: Tipo de pago si se indica (ej: "contra entrega", "prepago", "a cobrar").

Formato de respuesta (JSON puro):
{"mlShipmentId":"","trackingNumber":"","direccion":"","codigoPostal":"","localidad":"","barrio":"","provincia":"","nombreDestinatario":"","telefonoDestinatario":"","emailDestinatario":"","dniDestinatario":"","referencia":"","nombreRemitente":"","direccionRetiro":"","cantidadBultos":"","pesoKg":"","valorDeclarado":"","tipoPago":""}

Reglas:
- Si no encontrás un campo, dejar "".
- NO inventar datos.
- El trackingNumber es PRIORIDAD si no hay mlShipmentId.
- Para cantidadBultos, pesoKg, valorDeclarado: devolver solo el número como string.`
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
      const errText = await response.text();
      return new Response(JSON.stringify({ error: "Error AI: " + response.status }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    let extracted: Record<string, string> = {};
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawContent);
    }

    return new Response(JSON.stringify({
      mlShipmentId: String(extracted.mlShipmentId || "").trim(),
      trackingNumber: String(extracted.trackingNumber || "").trim(),
      direccion: String(extracted.direccion || "").trim(),
      codigoPostal: String(extracted.codigoPostal || "").trim(),
      localidad: String(extracted.localidad || "").trim(),
      barrio: String(extracted.barrio || "").trim(),
      provincia: String(extracted.provincia || "").trim(),
      nombreDestinatario: String(extracted.nombreDestinatario || "").trim(),
      telefonoDestinatario: String(extracted.telefonoDestinatario || "").trim(),
      emailDestinatario: String(extracted.emailDestinatario || "").trim(),
      dniDestinatario: String(extracted.dniDestinatario || "").trim(),
      referencia: String(extracted.referencia || "").trim(),
      nombreRemitente: String(extracted.nombreRemitente || "").trim(),
      direccionRetiro: String(extracted.direccionRetiro || "").trim(),
      cantidadBultos: String(extracted.cantidadBultos || "").trim(),
      pesoKg: String(extracted.pesoKg || "").trim(),
      valorDeclarado: String(extracted.valorDeclarado || "").trim(),
      tipoPago: String(extracted.tipoPago || "").trim(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
