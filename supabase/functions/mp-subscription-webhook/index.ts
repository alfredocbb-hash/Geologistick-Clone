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

      // Use platform-level MP access token
      const accessToken = Deno.env.get("MP_SUBSCRIPTION_ACCESS_TOKEN");
      if (!accessToken) {
        logStep("No MP_SUBSCRIPTION_ACCESS_TOKEN configured");
        return new Response(JSON.stringify({ received: true, error: "No MP credentials" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Get subscription details from MP
      const mpResponse = await fetch(
        `https://api.mercadopago.com/preapproval/${preapprovalId}`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      if (!mpResponse.ok) {
        logStep("Failed to fetch MP subscription", { status: mpResponse.status });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const mpData = await mpResponse.json();
      logStep("MP subscription status", { status: mpData.status, externalRef: mpData.external_reference });

      const isActive = mpData.status === "authorized";

      // Find existing subscription by MP ID
      const { data: subscription } = await supabaseClient
        .from("tenant_subscriptions")
        .select("*, subscription_plans (*)")
        .eq("mercadopago_subscription_id", preapprovalId)
        .single();

      if (subscription) {
        // Update existing subscription
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
      } else {
        // New subscription - try to parse external_reference
        logStep("Subscription not found in DB, trying external_reference");
        
        if (mpData.external_reference) {
          try {
            const ref = JSON.parse(mpData.external_reference);
            if (ref.tenant_id && ref.plan_id) {
              const { error: insertError } = await supabaseClient
                .from("tenant_subscriptions")
                .upsert({
                  tenant_id: ref.tenant_id,
                  plan_id: ref.plan_id,
                  status: isActive ? "active" : mpData.status,
                  mercadopago_subscription_id: preapprovalId,
                  current_period_start: mpData.date_created,
                  current_period_end: mpData.next_payment_date,
                  updated_at: new Date().toISOString(),
                }, { onConflict: "tenant_id" });

              if (insertError) {
                logStep("Error creating subscription from webhook", { error: insertError.message });
              } else {
                logStep("Created subscription from webhook", { tenantId: ref.tenant_id });

                // Update tenant plan if active
                if (isActive) {
                  const { data: plan } = await supabaseClient
                    .from("subscription_plans")
                    .select("name")
                    .eq("id", ref.plan_id)
                    .single();

                  if (plan) {
                    await supabaseClient
                      .from("tenants")
                      .update({
                        plan: plan.name.toLowerCase().replace(/\s+/g, "_"),
                      })
                      .eq("id", ref.tenant_id);
                  }
                }
              }
            }
          } catch (parseError) {
            logStep("Could not parse external_reference", { ref: mpData.external_reference });
          }
        }
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
