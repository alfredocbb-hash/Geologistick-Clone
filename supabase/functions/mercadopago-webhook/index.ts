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

async function getWebhookSecretForTenant(
  supabaseClient: any,
  tenantId: string,
  environment: string
): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from("system_integrations")
    .select("config_value")
    .eq("integration_type", "mercado_pago")
    .eq("config_key", "webhook_secret")
    .eq("environment", environment)
    .eq("is_active", true)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) return null;
  return data.config_value || null;
}

async function verifyMpSignature(
  req: Request,
  paymentId: string,
  webhookSecret: string
): Promise<boolean | null> {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature || !xRequestId) {
    console.warn("Missing MP signature headers (x-signature or x-request-id) - returning null");
    return null;
  }

  // Parse x-signature: "ts=XXXXX,v1=YYYYY"
  const parts = xSignature.split(",");
  const ts = parts.find((p) => p.startsWith("ts="))?.split("=")[1];
  const v1 = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

  if (!ts || !v1) {
    console.warn("Invalid MP x-signature format");
    return false;
  }

  // Build manifest string per MP docs
  const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
    const calculatedSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return calculatedSignature === v1;
  } catch (err) {
    console.error("Error verifying MP signature:", err);
    return false;
  }
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

    // Basic input validation
    let body: MercadoPagoWebhook;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body || typeof body !== "object" || !body.type || !body.data?.id) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      // Verify webhook signature if webhook_secret is configured
      const webhookSecret = await getWebhookSecretForTenant(
        supabaseClient,
        existingPayment.tenant_id,
        environment
      );

      if (webhookSecret) {
        const isValid = await verifyMpSignature(req, paymentId, webhookSecret);
        if (isValid === false) {
          console.error("Invalid webhook signature for tenant", existingPayment.tenant_id);
          return new Response(
            JSON.stringify({ error: "Invalid signature" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (isValid === null) {
          console.warn("No signature headers present, proceeding without verification");
        } else {
          console.log("Webhook signature verified successfully");
        }
      } else {
        console.warn("No webhook_secret configured for tenant, skipping signature verification");
      }

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

      console.log(`[Strategy 2] Trying tenant ${configTenantId}`);

      // Verify signature per tenant if secret is configured
      const webhookSecret = await getWebhookSecretForTenant(supabaseClient, configTenantId, environment);
      if (webhookSecret) {
        const isValid = await verifyMpSignature(req, paymentId, webhookSecret);
        if (isValid === false) {
          // Signature is explicitly invalid, skip this tenant
          console.warn(`[Strategy 2] Invalid signature for tenant ${configTenantId}, skipping`);
          continue;
        }
        if (isValid === null) {
          console.warn(`[Strategy 2] No signature headers present, proceeding without verification for tenant ${configTenantId}`);
        } else {
          console.log(`[Strategy 2] Signature verified for tenant ${configTenantId}`);
        }
      } else {
        console.log(`[Strategy 2] No webhook_secret configured for tenant ${configTenantId}, skipping signature check`);
      }

      const payment = await fetchPaymentFromMP(paymentId, accessToken);
      if (!payment) {
        console.warn(`[Strategy 2] fetchPaymentFromMP returned null for payment ${paymentId} with tenant ${configTenantId}, skipping`);
        continue;
      }

      const externalRef = payment.external_reference;
      if (!externalRef) {
        console.log(`[Strategy 2] Payment ${paymentId} has no external_reference, skipping tenant ${configTenantId}`);
        continue;
      }

      console.log(`[Strategy 2] Payment ${paymentId} has external_reference=${externalRef}, checking envio for tenant ${configTenantId}`);

      // Verify the envio belongs to this tenant
      const { data: envio } = await supabaseClient
        .from("envios")
        .select("id, tenant_id")
        .eq("id", externalRef)
        .eq("tenant_id", configTenantId)
        .maybeSingle();

      if (!envio) {
        console.log(`[Strategy 2] No envio found with id=${externalRef} for tenant ${configTenantId}`);
        continue;
      }

      // Found the right tenant! Now find the pending payment record by envio_id
      console.log(`[Strategy 2] Matched payment to tenant ${configTenantId} via external_reference=${externalRef}`);

      const paymentStatus = mapMpStatus(payment.status);
      console.log(`[Strategy 2] MP payment status=${payment.status} -> mapped to ${paymentStatus}`);

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
        const { error: updateError } = await supabaseClient
          .from("pagos")
          .update({
            estado: paymentStatus,
            mercado_pago_id: paymentId,
            mercado_pago_status: payment.status,
            referencia: payment.id?.toString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", pendingPayment.id);

        if (updateError) {
          console.error(`[Strategy 2] Error updating pending payment ${pendingPayment.id}:`, updateError.message);
        } else {
          console.log(`[Strategy 2] Updated pending payment ${pendingPayment.id} for envio ${externalRef}: status=${paymentStatus}`);
        }
      } else {
        // No pending record found, try to find any MP payment for this envio
        const { data: anyPayment } = await supabaseClient
          .from("pagos")
          .select("id, estado")
          .eq("envio_id", externalRef)
          .eq("metodo", "mercado_pago")
          .eq("tenant_id", configTenantId)
          .maybeSingle();

        if (anyPayment) {
          console.log(`[Strategy 2] Found existing payment ${anyPayment.id} with estado=${anyPayment.estado}, updating`);
          const { error: updateError } = await supabaseClient
            .from("pagos")
            .update({
              estado: paymentStatus,
              mercado_pago_id: paymentId,
              mercado_pago_status: payment.status,
              referencia: payment.id?.toString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", anyPayment.id);

          if (updateError) {
            console.error(`[Strategy 2] Error updating payment ${anyPayment.id}:`, updateError.message);
          }
        } else {
          // No payment record at all, create one
          console.log(`[Strategy 2] No payment record found for envio ${externalRef}, creating new one`);
          const { error: insertError } = await supabaseClient
            .from("pagos")
            .insert({
              envio_id: externalRef,
              tenant_id: configTenantId,
              metodo: "mercado_pago",
              monto: payment.transaction_amount,
              estado: paymentStatus,
              mercado_pago_id: paymentId,
              mercado_pago_status: payment.status,
              referencia: payment.id?.toString(),
            });

          if (insertError) {
            console.error(`[Strategy 2] Error inserting payment:`, insertError.message);
          }
        }
        console.log(`[Strategy 2] Processed payment for envio ${externalRef}: status=${paymentStatus}`);
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
