import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: Record<string, unknown>) => {
  console.log(`[NOTIFY-SUBSCRIPTION-EXPIRY] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    log("Started");

    const now = new Date();
    const fiveDaysFromNow = new Date(now);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

    // 1. Find subscriptions expiring within 5 days
    const { data: expiringSoon, error: expiringError } = await supabase
      .from("tenant_subscriptions")
      .select("tenant_id, current_period_end, subscription_plans ( name )")
      .eq("status", "active")
      .gte("current_period_end", now.toISOString())
      .lte("current_period_end", fiveDaysFromNow.toISOString());

    if (expiringError) throw expiringError;
    log("Expiring soon found", { count: expiringSoon?.length || 0 });

    // 2. Find already expired subscriptions
    const { data: expired, error: expiredError } = await supabase
      .from("tenant_subscriptions")
      .select("tenant_id, current_period_end, subscription_plans ( name )")
      .eq("status", "active")
      .lt("current_period_end", now.toISOString());

    if (expiredError) throw expiredError;
    log("Already expired found", { count: expired?.length || 0 });

    let notificationsSent = 0;

    const processSubscriptions = async (
      subs: typeof expiringSoon,
      isExpired: boolean
    ) => {
      if (!subs?.length) return;

      for (const sub of subs) {
        const endDate = new Date(sub.current_period_end);
        const monthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}`;
        const linkId = `subscription-expiry-${sub.tenant_id}-${monthKey}`;

        // Check if notification already sent
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("link", linkId)
          .limit(1);

        if (existing && existing.length > 0) {
          log("Notification already exists", { linkId });
          continue;
        }

        // Find admin users for this tenant
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("tenant_id", sub.tenant_id);

        if (!profiles?.length) continue;

        const userIds = profiles.map((p) => p.user_id);
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("user_id", userIds)
          .eq("role", "admin");

        const adminUserIds = adminRoles?.map((r) => r.user_id) || [];
        if (!adminUserIds.length) continue;

        const planName = (sub.subscription_plans as any)?.name || "tu plan";
        const formattedDate = `${endDate.getDate().toString().padStart(2, "0")}/${(endDate.getMonth() + 1).toString().padStart(2, "0")}/${endDate.getFullYear()}`;

        const title = isExpired
          ? "Tu suscripción ha vencido"
          : "Tu suscripción vence pronto";

        const message = isExpired
          ? `El plan "${planName}" venció el ${formattedDate}. Renueva para seguir usando todas las funcionalidades.`
          : `El plan "${planName}" vence el ${formattedDate}. Renueva a tiempo para no perder acceso.`;

        const notifications = adminUserIds.map((uid) => ({
          user_id: uid,
          tenant_id: sub.tenant_id,
          title,
          message,
          type: isExpired ? "error" : "warning",
          link: linkId,
          read: false,
        }));

        const { error: insertError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (insertError) {
          log("Error inserting notifications", { error: insertError.message, tenantId: sub.tenant_id });
        } else {
          notificationsSent += adminUserIds.length;
          log("Notifications sent", { tenantId: sub.tenant_id, count: adminUserIds.length, isExpired });
        }
      }
    };

    await processSubscriptions(expiringSoon, false);
    await processSubscriptions(expired, true);

    log("Completed", { notificationsSent });

    return new Response(JSON.stringify({ success: true, notificationsSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
