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
    // Log only non-sensitive webhook metadata
    console.log(`Webhook received: type=${body.type}, action=${body.action}`);

    // Only process payment notifications
    if (body.type !== "payment") {
      return new Response(
        JSON.stringify({ message: "Notification type not handled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentId = body.data.id;
    const environment = body.live_mode ? 'production' : 'sandbox';

    // We need to find the tenant from the external_reference (envio_id)
    // First, we need to get the payment details to get external_reference
    // But we don't have the access token yet since we don't know the tenant
    
    // Try to find existing payment record by mercado_pago_id
    const { data: existingPayment } = await supabaseClient
      .from("pagos")
      .select("envio_id, tenant_id")
      .eq("mercado_pago_id", paymentId)
      .maybeSingle();

    let tenantId: string | null = existingPayment?.tenant_id || null;
    let envioId: string | null = existingPayment?.envio_id || null;

    // If we have a tenant, get their MP config
    if (tenantId) {
      const { data: mpConfigs, error: configError } = await supabaseClient
        .from("system_integrations")
        .select("config_key, config_value")
        .eq("integration_type", "mercado_pago")
        .eq("environment", environment)
        .eq("is_active", true)
        .eq("tenant_id", tenantId);

      if (configError || !mpConfigs || mpConfigs.length === 0) {
        console.error("Mercado Pago not configured for tenant");
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
        console.error("Error fetching payment from MP:", errorData?.message || "Unknown error");
        return new Response(
          JSON.stringify({ error: "Error fetching payment details" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payment = await mpResponse.json();

      envioId = payment.external_reference || envioId;
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
        .eq("metodo", "mercado_pago")
        .eq("tenant_id", tenantId);

      if (updateError) {
        console.error("Error updating payment:", updateError?.message || "Unknown error");
      }

      console.log(`Payment processed: status=${paymentStatus}`);

      return new Response(
        JSON.stringify({ success: true, status: paymentStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // No existing payment record - try to find tenant from all active configs
      // This is a fallback for edge cases
      console.log("No existing payment record found, trying to match tenant from configs");
      
      // Get all active MP configs
      const { data: allConfigs } = await supabaseClient
        .from("system_integrations")
        .select("config_key, config_value, tenant_id")
        .eq("integration_type", "mercado_pago")
        .eq("environment", environment)
        .eq("is_active", true)
        .eq("config_key", "access_token");

      if (!allConfigs || allConfigs.length === 0) {
        console.error("No active Mercado Pago configurations found");
        return new Response(
          JSON.stringify({ error: "No Mercado Pago configurations found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try each config until one works
      for (const configItem of allConfigs) {
        const accessToken = configItem.config_value;
        const configTenantId = configItem.tenant_id;

        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (mpResponse.ok) {
          const payment = await mpResponse.json();
          const externalRef = payment.external_reference;
          const status = payment.status;

          // Verify this envio belongs to this tenant
          if (externalRef) {
            const { data: envio } = await supabaseClient
              .from("envios")
              .select("id, tenant_id")
              .eq("id", externalRef)
              .eq("tenant_id", configTenantId)
              .maybeSingle();

            if (envio) {
              // Found the right tenant!
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

              // Insert or update payment record
              const { error: upsertError } = await supabaseClient
                .from("pagos")
                .upsert({
                  envio_id: externalRef,
                  tenant_id: configTenantId,
                  metodo: "mercado_pago",
                  monto: payment.transaction_amount,
                  estado: paymentStatus,
                  mercado_pago_id: paymentId,
                  mercado_pago_status: status,
                  referencia: payment.id?.toString(),
                  updated_at: new Date().toISOString(),
                }, {
                  onConflict: "envio_id,metodo"
                });

              if (upsertError) {
                console.error("Error upserting payment:", upsertError?.message);
              }

              console.log(`Payment processed for tenant ${configTenantId}: status=${paymentStatus}`);

              return new Response(
                JSON.stringify({ success: true, status: paymentStatus }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      }

      console.error("Could not find matching tenant for payment");
      return new Response(
        JSON.stringify({ error: "Could not find matching tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
