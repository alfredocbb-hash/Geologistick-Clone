import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  envio_id: string;
  tracking_number: string;
  amount: number;
  description?: string;
  payer_email?: string;
  payer_name?: string;
  environment?: 'sandbox' | 'production';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: PaymentRequest = await req.json();
    const { envio_id, tracking_number, amount, description, payer_email, payer_name, environment = 'production' } = body;

    if (!envio_id || !tracking_number || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: envio_id, tracking_number, amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Mercado Pago configuration from database
    const { data: mpConfigs, error: configError } = await supabaseClient
      .from("system_integrations")
      .select("config_key, config_value")
      .eq("integration_type", "mercado_pago")
      .eq("environment", environment)
      .eq("is_active", true);

    if (configError || !mpConfigs || mpConfigs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Mercado Pago no está configurado", code: "MP_NOT_CONFIGURED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build config object
    const config: Record<string, string> = {};
    mpConfigs.forEach((c: { config_key: string; config_value: string }) => {
      config[c.config_key] = c.config_value;
    });

    if (!config.access_token) {
      return new Response(
        JSON.stringify({ error: "Access token no configurado en Mercado Pago" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create preference in Mercado Pago
    const preferenceData = {
      items: [
        {
          id: envio_id,
          title: `Envío ${tracking_number}`,
          description: description || `Pago de envío ${tracking_number}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: amount,
        },
      ],
      payer: {
        email: payer_email || "cliente@email.com",
        name: payer_name || "Cliente",
      },
      external_reference: envio_id,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      back_urls: {
        success: `${req.headers.get("origin") || ""}/shipments?payment=success`,
        failure: `${req.headers.get("origin") || ""}/shipments?payment=failure`,
        pending: `${req.headers.get("origin") || ""}/shipments?payment=pending`,
      },
      auto_return: "approved",
      statement_descriptor: "LOGISTICA",
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.access_token}`,
      },
      body: JSON.stringify(preferenceData),
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json();
      console.error("Mercado Pago error:", errorData);
      return new Response(
        JSON.stringify({ error: "Error al crear preferencia de pago", details: errorData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const preference = await mpResponse.json();

    // Create pending payment record
    const { error: paymentError } = await supabaseClient
      .from("pagos")
      .insert({
        envio_id,
        metodo: "mercado_pago",
        monto: amount,
        estado: "pendiente",
        mercado_pago_id: preference.id,
        created_by: user.id,
      });

    if (paymentError) {
      console.error("Error creating payment record:", paymentError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        preference_id: preference.id,
        init_point: preference.init_point,
        sandbox_init_point: preference.sandbox_init_point,
        // For QR payments
        qr_code: preference.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: preference.point_of_interaction?.transaction_data?.qr_code_base64,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
