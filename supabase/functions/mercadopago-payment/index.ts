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
  environment?: "sandbox" | "production";
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

    // Get user's tenant_id from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      console.error("Error getting user profile:", profileError?.message || "No tenant found");
      return new Response(
        JSON.stringify({ error: "Usuario no tiene empresa asignada", code: "MP_NO_TENANT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = profile.tenant_id;

    let body: PaymentRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", code: "MP_INVALID_BODY" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { envio_id, tracking_number, amount, description, payer_email, payer_name, environment = "production" } = body;

    if (!envio_id || typeof envio_id !== "string" || envio_id.length > 100) {
      return new Response(
        JSON.stringify({ error: "Invalid envio_id", code: "MP_MISSING_FIELDS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tracking_number || typeof tracking_number !== "string" || tracking_number.length > 100) {
      return new Response(
        JSON.stringify({ error: "Invalid tracking_number", code: "MP_MISSING_FIELDS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!amount || typeof amount !== "number" || amount <= 0 || amount > 100000000 || !isFinite(amount)) {
      return new Response(
        JSON.stringify({ error: "Invalid amount: must be a positive number", code: "MP_MISSING_FIELDS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (environment !== "sandbox" && environment !== "production") {
      return new Response(
        JSON.stringify({ error: "Invalid environment", code: "MP_MISSING_FIELDS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Mercado Pago configuration from database filtered by tenant
    const { data: mpConfigs, error: configError } = await supabaseClient
      .from("system_integrations")
      .select("config_key, config_value")
      .eq("integration_type", "mercado_pago")
      .eq("environment", environment)
      .eq("is_active", true)
      .eq("tenant_id", tenantId);

    if (configError || !mpConfigs || mpConfigs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Mercado Pago no está configurado para tu empresa", code: "MP_NOT_CONFIGURED" }),
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
        JSON.stringify({ error: "Access token no configurado en Mercado Pago", code: "MP_NO_TOKEN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token format
    const tokenPrefix = config.access_token.substring(0, 8);
    if (!config.access_token.startsWith("APP_USR-") && !config.access_token.startsWith("TEST-")) {
      console.error(`Invalid token format: starts with "${tokenPrefix}..." (length: ${config.access_token.length})`);
      return new Response(
        JSON.stringify({ error: "El access token de Mercado Pago tiene un formato inválido", code: "MP_INVALID_TOKEN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating MP preference: env=${environment}, token_prefix=${tokenPrefix}, token_len=${config.access_token.length}`);

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
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.access_token}`,
      },
      body: JSON.stringify(preferenceData),
    });

    console.log(`MP API response: status=${mpResponse.status}`);

    if (!mpResponse.ok) {
      const contentType = mpResponse.headers.get("content-type") || "";
      let errorDetails: any = { status: mpResponse.status };

      if (contentType.includes("application/json")) {
        errorDetails = await mpResponse.json();
        console.error("MP API error:", errorDetails?.message || "Preference creation failed");
      } else {
        const text = await mpResponse.text();
        console.error("MP API non-JSON error:", text.substring(0, 200));
      }

      const code = mpResponse.status === 401 ? "MP_UNAUTHORIZED" : "MP_API_ERROR";
      return new Response(
        JSON.stringify({ error: "Error al crear preferencia de pago", code, details: errorDetails }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const preference = await mpResponse.json();
    console.log(`Preference created: id=${preference.id}`);

    // Create pending payment record with tenant_id
    const { error: paymentError } = await supabaseClient
      .from("pagos")
      .insert({
        envio_id,
        metodo: "mercado_pago",
        monto: amount,
        estado: "pendiente",
        mercado_pago_id: preference.id,
        created_by: user.id,
        tenant_id: tenantId,
      });

    if (paymentError) {
      console.error("Error creating payment record:", paymentError?.message || "Unknown error");
    }

    return new Response(
      JSON.stringify({
        success: true,
        preference_id: preference.id,
        init_point: preference.init_point,
        sandbox_init_point: preference.sandbox_init_point,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage, code: "MP_INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
