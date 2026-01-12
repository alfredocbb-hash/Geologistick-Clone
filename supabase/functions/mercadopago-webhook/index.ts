import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MercadoPagoWebhook {
  id: string;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: string;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
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

    const body: MercadoPagoWebhook = await req.json();
    console.log("Mercado Pago webhook received:", JSON.stringify(body, null, 2));

    // Only process payment notifications
    if (body.type !== "payment") {
      return new Response(
        JSON.stringify({ message: "Notification type not handled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentId = body.data.id;
    const environment = body.live_mode ? 'production' : 'sandbox';

    // Get Mercado Pago configuration from database
    const { data: mpConfigs, error: configError } = await supabaseClient
      .from("system_integrations")
      .select("config_key, config_value")
      .eq("integration_type", "mercado_pago")
      .eq("environment", environment)
      .eq("is_active", true);

    if (configError || !mpConfigs || mpConfigs.length === 0) {
      console.error("Mercado Pago not configured");
      return new Response(
        JSON.stringify({ error: "Mercado Pago not configured" }),
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
        JSON.stringify({ error: "Access token not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get payment details from Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${config.access_token}`,
      },
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json();
      console.error("Error fetching payment from MP:", errorData);
      return new Response(
        JSON.stringify({ error: "Error fetching payment details" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payment = await mpResponse.json();
    console.log("Payment details:", JSON.stringify(payment, null, 2));

    const envioId = payment.external_reference;
    const status = payment.status;

    // Map MP status to our status
    let paymentStatus: string;
    switch (status) {
      case "approved":
        paymentStatus = "pagado";
        break;
      case "pending":
      case "in_process":
      case "authorized":
        paymentStatus = "pendiente";
        break;
      case "rejected":
      case "cancelled":
        paymentStatus = "fallido";
        break;
      case "refunded":
      case "charged_back":
        paymentStatus = "reembolsado";
        break;
      default:
        paymentStatus = "pendiente";
    }

    // Update payment record in our database
    const { error: updateError } = await supabaseClient
      .from("pagos")
      .update({
        estado: paymentStatus,
        mercado_pago_id: paymentId,
        mercado_pago_status: status,
        referencia: payment.id?.toString(),
        updated_at: new Date().toISOString(),
      })
      .eq("envio_id", envioId)
      .eq("metodo", "mercado_pago");

    if (updateError) {
      console.error("Error updating payment:", updateError);
      
      // If no existing record, create one
      if (envioId) {
        const { error: insertError } = await supabaseClient
          .from("pagos")
          .insert({
            envio_id: envioId,
            metodo: "mercado_pago",
            monto: payment.transaction_amount,
            estado: paymentStatus,
            mercado_pago_id: paymentId,
            mercado_pago_status: status,
            referencia: payment.id?.toString(),
          });

        if (insertError) {
          console.error("Error inserting payment:", insertError);
        }
      }
    }

    console.log(`Payment ${paymentId} updated to status: ${paymentStatus}`);

    return new Response(
      JSON.stringify({ success: true, status: paymentStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
