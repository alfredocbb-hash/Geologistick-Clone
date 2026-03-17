import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MP-CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

async function getRealUsage(supabaseClient: any, tenantId: string, shipmentUsage: any) {
  const { count: usersCount } = await supabaseClient
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const { count: branchesCount } = await supabaseClient
    .from("sucursales")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("activa", true);

  return {
    shipments_count: shipmentUsage?.shipments_count || 0,
    users_count: usersCount || 0,
    branches_count: branchesCount || 0,
  };
}

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
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("Auth failed (expired session?)", { message: userError.message });
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ subscribed: false, error: "No tenant found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const tenantId = profile.tenant_id;
    logStep("Found tenant", { tenantId });

    const { data: existingSub } = await supabaseClient
      .from("tenant_subscriptions")
      .select(`*, subscription_plans (*)`)
      .eq("tenant_id", tenantId)
      .single();

    // Helper to get monthly usage with real counts
    const getMonthlyUsage = async () => {
      const monthYear = new Date().toISOString().slice(0, 7);
      const { data: usage } = await supabaseClient
        .from("tenant_usage")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("month_year", monthYear)
        .single();
      return await getRealUsage(supabaseClient, tenantId, usage);
    };

    // If we have a Mercado Pago subscription, verify it
    if (existingSub?.mercadopago_subscription_id) {
      const accessToken = Deno.env.get("MP_SUBSCRIPTION_ACCESS_TOKEN");
      
      if (accessToken) {
        try {
          const mpResponse = await fetch(
            `https://api.mercadopago.com/preapproval/${existingSub.mercadopago_subscription_id}`,
            { headers: { "Authorization": `Bearer ${accessToken}` } }
          );

          if (mpResponse.ok) {
            const mpData = await mpResponse.json();
            logStep("MP subscription status", { status: mpData.status });

            const isActive = mpData.status === "authorized";
            await supabaseClient
              .from("tenant_subscriptions")
              .update({
                status: isActive ? "active" : mpData.status,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingSub.id);

            const realUsage = await getMonthlyUsage();

            return new Response(JSON.stringify({
              subscribed: isActive,
              plan_name: existingSub.subscription_plans?.name,
              subscription_end: mpData.next_payment_date,
              cancel_at_period_end: mpData.status === "paused",
              limits: {
                max_users: existingSub.subscription_plans?.max_users,
                max_branches: existingSub.subscription_plans?.max_branches,
                max_shipments_month: existingSub.subscription_plans?.max_shipments_month,
              },
              usage: realUsage,
              payment_method: "mercadopago",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        } catch (mpError) {
          logStep("Error checking MP subscription", { error: String(mpError) });
        }
      }
    }

    // Fallback: manual subscription
    if (existingSub && existingSub.status === 'active' && !existingSub.mercadopago_subscription_id && !existingSub.stripe_subscription_id) {
      logStep("Found manual subscription (no gateway)", { subId: existingSub.id });

      const isActive = existingSub.current_period_end
        ? new Date(existingSub.current_period_end) > new Date()
        : true;

      const realUsage = await getMonthlyUsage();

      return new Response(JSON.stringify({
        subscribed: isActive,
        plan_name: existingSub.subscription_plans?.name,
        subscription_end: existingSub.current_period_end,
        cancel_at_period_end: false,
        limits: {
          max_users: existingSub.subscription_plans?.max_users,
          max_branches: existingSub.subscription_plans?.max_branches,
          max_shipments_month: existingSub.subscription_plans?.max_shipments_month,
        },
        usage: realUsage,
        payment_method: "manual",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Fallback to Stripe if configured
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && existingSub?.stripe_subscription_id) {
      const Stripe = (await import("https://esm.sh/stripe@14.21.0")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
      
      try {
        const subscription = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);
        const isActive = ["active", "trialing"].includes(subscription.status);
        const realUsage = await getMonthlyUsage();

        return new Response(JSON.stringify({
          subscribed: isActive,
          plan_name: existingSub.subscription_plans?.name,
          subscription_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          limits: {
            max_users: existingSub.subscription_plans?.max_users,
            max_branches: existingSub.subscription_plans?.max_branches,
            max_shipments_month: existingSub.subscription_plans?.max_shipments_month,
          },
          usage: realUsage,
          payment_method: "stripe",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } catch (stripeError) {
        logStep("Error checking Stripe subscription", { error: String(stripeError) });
      }
    }

    logStep("No active subscription found");
    return new Response(JSON.stringify({ subscribed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
