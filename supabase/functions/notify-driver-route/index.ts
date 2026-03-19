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

    const { type, driver_id, route_id, route_number, tenant_id, shipment_count, message } = await req.json();

    if (!driver_id || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "driver_id y tenant_id son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let title = "";
    let body = "";
    let link = "/my-routes";
    let notifType: "info" | "warning" | "success" = "info";

    switch (type) {
      case "route_assigned":
        title = `📦 Nueva ruta asignada: ${route_number || ""}`;
        body = `Se te asignó una ruta con ${shipment_count || 0} parada(s). Revisá los detalles e iniciá cuando estés listo.`;
        notifType = "info";
        break;
      case "route_urgent":
        title = `🚨 Ruta urgente: ${route_number || ""}`;
        body = message || `Hay entregas urgentes en tu ruta que requieren atención inmediata.`;
        notifType = "warning";
        break;
      case "shipment_added":
        title = `📬 Nuevo envío agregado a tu ruta`;
        body = message || `Se agregó un envío adicional a tu ruta activa.`;
        notifType = "info";
        break;
      case "route_cancelled":
        title = `❌ Ruta cancelada: ${route_number || ""}`;
        body = message || `Tu ruta fue cancelada por el administrador.`;
        notifType = "warning";
        link = "/my-routes";
        break;
      default:
        title = message || "Notificación";
        body = message || "Tenés una nueva notificación";
    }

    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: driver_id,
      tenant_id,
      title,
      message: body,
      type: notifType,
      link,
    });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("notify-driver-route error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
