import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find shipments at risk: created > 20 hours ago, not delivered, with estimated date today or past
    const now = new Date();
    const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];

    const { data: atRiskShipments, error: queryError } = await supabase
      .from("envios")
      .select("id, tracking_number, nombre_destinatario, direccion_entrega, chofer_id, tenant_id, created_at, fecha_entrega_estimada")
      .in("estado", ["pendiente", "en_reparto", "en_transito", "en_sucursal", "recogido"])
      .lt("created_at", twentyHoursAgo.toISOString())
      .not("tenant_id", "is", null);

    if (queryError) throw queryError;

    if (!atRiskShipments || atRiskShipments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No hay envíos en riesgo de SLA", alerts_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let alertsCreated = 0;

    // Group by tenant for admin notifications
    const byTenant = new Map<string, typeof atRiskShipments>();
    for (const envio of atRiskShipments) {
      if (!envio.tenant_id) continue;
      const list = byTenant.get(envio.tenant_id) || [];
      list.push(envio);
      byTenant.set(envio.tenant_id, list);
    }

    for (const [tenantId, envios] of byTenant) {
      // Get admin users for this tenant
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("tenant_id", tenantId);

      if (!adminProfiles || adminProfiles.length === 0) continue;

      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", adminProfiles.map(p => p.user_id))
        .in("role", ["admin", "super_admin"]);

      const adminIds = adminRoles?.map(r => r.user_id) || [];

      // Create notification for each admin
      for (const adminId of adminIds) {
        // Check if we already sent this alert today
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", adminId)
          .eq("type", "warning")
          .like("title", "%SLA en riesgo%")
          .gte("created_at", todayStr)
          .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from("notifications").insert({
          user_id: adminId,
          tenant_id: tenantId,
          title: `⚠️ SLA en riesgo: ${envios.length} envío(s)`,
          message: `Hay ${envios.length} envío(s) que superan las 20 horas sin ser entregados. Revisá los envíos pendientes para evitar demoras.`,
          type: "warning",
          link: "/shipments",
        });
        alertsCreated++;
      }

      // Notify assigned drivers about their specific at-risk shipments
      const driverEnvios = envios.filter(e => e.chofer_id);
      const byDriver = new Map<string, typeof envios>();
      for (const e of driverEnvios) {
        const list = byDriver.get(e.chofer_id!) || [];
        list.push(e);
        byDriver.set(e.chofer_id!, list);
      }

      for (const [driverId, driverShipments] of byDriver) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", driverId)
          .eq("type", "warning")
          .like("title", "%entrega urgente%")
          .gte("created_at", todayStr)
          .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from("notifications").insert({
          user_id: driverId,
          tenant_id: tenantId,
          title: `🚨 ${driverShipments.length} entrega(s) urgente(s)`,
          message: `Tenés ${driverShipments.length} envío(s) que necesitan ser entregados con urgencia: ${driverShipments.map(s => s.tracking_number).slice(0, 3).join(", ")}${driverShipments.length > 3 ? "..." : ""}`,
          type: "warning",
          link: "/my-routes",
        });
        alertsCreated++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Alertas de SLA procesadas`, 
        alerts_created: alertsCreated,
        shipments_at_risk: atRiskShipments.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("check-sla-alerts error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
