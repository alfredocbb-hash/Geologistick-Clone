import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MP-CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
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

    // Get existing subscription
    const { data: existingSub } = await supabaseClient
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (!existingSub?.mercadopago_subscription_id) {
      throw new Error("No active Mercado Pago subscription found");
    }

    // Use platform-level MP access token
    const accessToken = Deno.env.get("MP_SUBSCRIPTION_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("Mercado Pago subscription credentials not configured");
    }

    // Cancel subscription in Mercado Pago
    const mpResponse = await fetch(
      `https://api.mercadopago.com/preapproval/${existingSub.mercadopago_subscription_id}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "cancelled",
        }),
      }
    );

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json();
      logStep("MP API error", { error: errorData });
      throw new Error(errorData.message || "Error cancelling subscription");
    }

    const mpData = await mpResponse.json();
    logStep("Subscription cancelled in MP", { status: mpData.status });

    // Update local subscription status
    await supabaseClient
      .from("tenant_subscriptions")
      .update({
        status: "cancelled",
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSub.id);

    logStep("Local subscription updated");

    return new Response(JSON.stringify({ 
      success: true,
      message: "Suscripción cancelada correctamente",
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
