import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MP-CREATE-SUBSCRIPTION] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user's tenant
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      throw new Error("No tenant found for user");
    }
    logStep("Found tenant", { tenantId: profile.tenant_id });

    // Get Mercado Pago credentials from system_integrations
    const { data: mpConfig } = await supabaseClient
      .from("system_integrations")
      .select("key, value")
      .eq("tenant_id", profile.tenant_id)
      .eq("type", "mercado_pago");

    const accessToken = mpConfig?.find(c => c.key === "access_token")?.value;
    if (!accessToken) {
      throw new Error("Mercado Pago no está configurado. Ve a Integraciones para configurarlo.");
    }
    logStep("Found MP credentials");

    // Get plan from request
    const { planId } = await req.json();
    if (!planId) throw new Error("Plan ID is required");

    // Get plan details
    const { data: plan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      throw new Error("Plan not found");
    }
    logStep("Found plan", { planName: plan.name, price: plan.price_monthly });

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // Create Mercado Pago subscription (preapproval)
    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: plan.name,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: plan.price_monthly,
          currency_id: "ARS",
        },
        back_url: `${origin}/subscription?mp_status=approved`,
        payer_email: user.email,
        external_reference: JSON.stringify({
          tenant_id: profile.tenant_id,
          plan_id: planId,
          user_id: user.id,
        }),
      }),
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json();
      logStep("MP API error", { error: errorData });
      throw new Error(errorData.message || "Error creating Mercado Pago subscription");
    }

    const mpData = await mpResponse.json();
    logStep("MP subscription created", { 
      subscriptionId: mpData.id, 
      initPoint: mpData.init_point 
    });

    return new Response(JSON.stringify({ 
      url: mpData.init_point,
      subscription_id: mpData.id,
    }), {
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
