import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
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
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get tenant_id from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    
    if (profileError || !profile?.tenant_id) {
      logStep("No tenant found for user");
      return new Response(JSON.stringify({ subscribed: false, error: "No tenant found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    const tenantId = profile.tenant_id;
    logStep("Found tenant", { tenantId });

    // Get existing subscription from DB
    const { data: existingSub } = await supabaseClient
      .from("tenant_subscriptions")
      .select(`
        *,
        subscription_plans (*)
      `)
      .eq("tenant_id", tenantId)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // If we have a stripe subscription ID, check its status
    if (existingSub?.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);
        logStep("Retrieved Stripe subscription", { status: subscription.status });

        // Update local subscription status
        await supabaseClient
          .from("tenant_subscriptions")
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSub.id);

        const isActive = ["active", "trialing"].includes(subscription.status);
        
        // Get current month usage
        const monthYear = new Date().toISOString().slice(0, 7);
        const { data: usage } = await supabaseClient
          .from("tenant_usage")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("month_year", monthYear)
          .single();

        return new Response(JSON.stringify({
          subscribed: isActive,
          plan_name: existingSub.subscription_plans?.name,
          product_id: existingSub.subscription_plans?.stripe_product_id,
          price_id: existingSub.subscription_plans?.stripe_price_id,
          subscription_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          limits: {
            max_users: existingSub.subscription_plans?.max_users,
            max_branches: existingSub.subscription_plans?.max_branches,
            max_shipments_month: existingSub.subscription_plans?.max_shipments_month,
          },
          usage: usage || { shipments_count: 0, users_count: 0, branches_count: 0 },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } catch (stripeError) {
        logStep("Error retrieving Stripe subscription", { error: String(stripeError) });
      }
    }

    // If no subscription in DB, check by email in Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscription found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const productId = subscription.items.data[0].price.product as string;
    const priceId = subscription.items.data[0].price.id;
    logStep("Found active subscription", { subscriptionId: subscription.id, productId });

    // Find matching plan in DB
    const { data: plan } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("stripe_product_id", productId)
      .single();

    if (plan) {
      // Create or update tenant subscription
      await supabaseClient
        .from("tenant_subscriptions")
        .upsert({
          tenant_id: tenantId,
          plan_id: plan.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        }, { onConflict: 'tenant_id' });
      logStep("Synced subscription to DB");
    }

    // Get current month usage
    const monthYear = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabaseClient
      .from("tenant_usage")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("month_year", monthYear)
      .single();

    return new Response(JSON.stringify({
      subscribed: true,
      plan_name: plan?.name,
      product_id: productId,
      price_id: priceId,
      subscription_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      limits: plan ? {
        max_users: plan.max_users,
        max_branches: plan.max_branches,
        max_shipments_month: plan.max_shipments_month,
      } : null,
      usage: usage || { shipments_count: 0, users_count: 0, branches_count: 0 },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
