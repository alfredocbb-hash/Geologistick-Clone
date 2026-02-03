import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MP-SUBSCRIPTION-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Webhook received");

    const body = await req.json();
    logStep("Webhook body", { type: body.type, action: body.action });

    // Handle subscription events
    if (body.type === "subscription_preapproval" || body.type === "subscription_authorized_payment") {
      const preapprovalId = body.data?.id;
      
      if (!preapprovalId) {
        logStep("No preapproval ID in webhook");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Find tenant by subscription ID
      const { data: subscription } = await supabaseClient
        .from("tenant_subscriptions")
        .select("*, subscription_plans (*)")
        .eq("mercadopago_subscription_id", preapprovalId)
        .single();

      if (subscription) {
        // Get MP credentials for this tenant
        const { data: mpConfig } = await supabaseClient
          .from("system_integrations")
          .select("key, value")
          .eq("tenant_id", subscription.tenant_id)
          .eq("type", "mercado_pago");

        const accessToken = mpConfig?.find(c => c.key === "access_token")?.value;

        if (accessToken) {
          // Get subscription details from MP
          const mpResponse = await fetch(
            `https://api.mercadopago.com/preapproval/${preapprovalId}`,
            {
              headers: {
                "Authorization": `Bearer ${accessToken}`,
              },
            }
          );

          if (mpResponse.ok) {
            const mpData = await mpResponse.json();
            logStep("MP subscription status", { status: mpData.status });

            // Update local subscription
            const isActive = mpData.status === "authorized";
            await supabaseClient
              .from("tenant_subscriptions")
              .update({
                status: isActive ? "active" : mpData.status,
                current_period_start: mpData.date_created,
                current_period_end: mpData.next_payment_date,
                updated_at: new Date().toISOString(),
              })
              .eq("id", subscription.id);

            // Update tenant plan if subscription is active
            if (isActive && subscription.subscription_plans) {
              await supabaseClient
                .from("tenants")
                .update({
                  plan: subscription.subscription_plans.name.toLowerCase().replace(/\s+/g, "_"),
                })
                .eq("id", subscription.tenant_id);
            }

            logStep("Subscription updated", { subscriptionId: subscription.id, status: isActive ? "active" : mpData.status });
          }
        }
      } else {
        // New subscription - try to parse external_reference
        logStep("Subscription not found in DB, might be new");
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    // Return 200 to avoid webhook retries
    return new Response(JSON.stringify({ received: true, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
