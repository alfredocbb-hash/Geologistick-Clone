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

function mapMpStatus(status: string): string {
  switch (status) {
    case "approved":
      return "pagado";
    case "pending":
    case "in_process":
    case "authorized":
      return "pendiente";
    case "rejected":
    case "cancelled":
      return "fallido";
    case "refunded":
    case "charged_back":
      return "reembolsado";
    default:
      return "pendiente";
  }
}

async function fetchPaymentFromMP(paymentId: string, accessToken: string) {
  const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!mpResponse.ok) {
    const contentType = mpResponse.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorData = await mpResponse.json();
      console.error(`MP API error ${mpResponse.status}:`, errorData?.message || "Unknown");
    } else {
      console.error(`MP API error ${mpResponse.status}: non-JSON response`);
    }
    return null;
  }

  return await mpResponse.json();
}

async function getAccessTokenForTenant(
  supabaseClient: any,
  tenantId: string,
  environment: string
): Promise<string | null> {
  const { data: mpConfigs, error } = await supabaseClient
    .from("system_integrations")
    .select("config_key, config_value")
    .eq("integration_type", "mercado_pago")
    .eq("environment", environment)
    .eq("is_active", true)
    .eq("tenant_id", tenantId);

  if (error || !mpConfigs || mpConfigs.length === 0) return null;

  const config: Record<string, string> = {};
  mpConfigs.forEach((c: { config_key: string; config_value: string }) => {
    config[c.config_key] = c.config_value;
  });

  return config.access_token || null;
}

async function updatePaymentRecord(
  supabaseClient: any,
  envioId: string,
  tenantId: string,
  paymentId: string,
  payment: any,
  paymentStatus: string
) {
  const { error } = await supabaseClient
    .from("pagos")
    .update({
      estado: paymentStatus,
      mercado_pago_id: paymentId,
      mercado_pago_status: payment.status,
      referencia: payment.id?.toString(),
      updated_at: new Date().toISOString(),
    })
    .eq("envio_id", envioId)
    .eq("metodo", "mercado_pago")
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("Error updating payment:", error?.message || "Unknown error");
  }
  return error;
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
    console.log(`Webhook received: type=${body.type}, action=${body.action}, data.id=${body.data?.id}`);

    // Only process payment notifications
    if (body.type !== "payment") {
      return new Response(
        JSON.stringify({ message: "Notification type not handled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentId = body.data.id;
    const environment = body.live_mode ? "production" : "sandbox";

    // Strategy 1: Try to find existing payment by mercado_pago_id (exact match)
    const { data: existingPayment } = await supabaseClient
      .from("pagos")
      .select("envio_id, tenant_id")
      .eq("mercado_pago_id", paymentId)
      .maybeSingle();

    if (existingPayment?.tenant_id) {
      console.log(`Found payment by mercado_pago_id for tenant ${existingPayment.tenant_id}`);
      const accessToken = await getAccessTokenForTenant(supabaseClient, existingPayment.tenant_id, environment);
      if (!accessToken) {
        console.error("No access token for tenant");
        return new Response(
          JSON.stringify({ error: "MP not configured for tenant" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payment = await fetchPaymentFromMP(paymentId, accessToken);
      if (!payment) {
        return new Response(
          JSON.stringify({ error: "Error fetching payment from MP" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const paymentStatus = mapMpStatus(payment.status);
      await updatePaymentRecord(supabaseClient, existingPayment.envio_id, existingPayment.tenant_id, paymentId, payment, paymentStatus);
      console.log(`Payment updated: status=${paymentStatus}`);

      return new Response(
        JSON.stringify({ success: true, status: paymentStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strategy 2: No exact match found.
    // The payment was stored with preference_id in mercado_pago_id, but webhook sends payment_id.
    // Try each tenant's access token to fetch the payment from MP and use external_reference to match.
    console.log("No exact match by mercado_pago_id, trying external_reference strategy");

    const { data: allTokenConfigs } = await supabaseClient
      .from("system_integrations")
      .select("config_value, tenant_id")
      .eq("integration_type", "mercado_pago")
      .eq("environment", environment)
      .eq("is_active", true)
      .eq("config_key", "access_token");

    if (!allTokenConfigs || allTokenConfigs.length === 0) {
      console.error("No active MP configurations found");
      return new Response(
        JSON.stringify({ error: "No MP configurations found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const configItem of allTokenConfigs) {
      const accessToken = configItem.config_value;
      const configTenantId = configItem.tenant_id;

      const payment = await fetchPaymentFromMP(paymentId, accessToken);
      if (!payment) continue;

      const externalRef = payment.external_reference;
      if (!externalRef) {
        console.log(`Payment ${paymentId} has no external_reference, skipping tenant ${configTenantId}`);
        continue;
      }

      // Verify the envio belongs to this tenant
      const { data: envio } = await supabaseClient
        .from("envios")
        .select("id, tenant_id")
        .eq("id", externalRef)
        .eq("tenant_id", configTenantId)
        .maybeSingle();

      if (!envio) continue;

      // Found the right tenant! Now find the pending payment record by envio_id
      console.log(`Matched payment to tenant ${configTenantId} via external_reference=${externalRef}`);

      const paymentStatus = mapMpStatus(payment.status);

      // Try to update existing pending payment (stored with preference_id)
      const { data: pendingPayment } = await supabaseClient
        .from("pagos")
        .select("id")
        .eq("envio_id", externalRef)
        .eq("metodo", "mercado_pago")
        .eq("tenant_id", configTenantId)
        .in("estado", ["pendiente"])
        .maybeSingle();

      if (pendingPayment) {
        // Update the existing record (which had preference_id as mercado_pago_id)
        await updatePaymentRecord(supabaseClient, externalRef, configTenantId, paymentId, payment, paymentStatus);
        console.log(`Updated pending payment for envio ${externalRef}: status=${paymentStatus}`);
      } else {
        // No pending record found, upsert
        const { error: upsertError } = await supabaseClient
          .from("pagos")
          .upsert(
            {
              envio_id: externalRef,
              tenant_id: configTenantId,
              metodo: "mercado_pago",
              monto: payment.transaction_amount,
              estado: paymentStatus,
              mercado_pago_id: paymentId,
              mercado_pago_status: payment.status,
              referencia: payment.id?.toString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "envio_id,metodo" }
          );

        if (upsertError) {
          console.error("Error upserting payment:", upsertError?.message);
        }
        console.log(`Upserted payment for envio ${externalRef}: status=${paymentStatus}`);
      }

      return new Response(
        JSON.stringify({ success: true, status: paymentStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error("Could not find matching tenant for payment", paymentId);
    return new Response(
      JSON.stringify({ error: "Could not find matching tenant" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
