import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's tenant_id
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Tenant no encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = profile.tenant_id;

    // Parse body for optional pago_id
    let pagoId: string | null = null;
    try {
      const body = await req.json();
      pagoId = body.pago_id || null;
    } catch {
      // No body or invalid JSON, sync all
    }

    // Get access token for tenant
    const { data: tokenConfig } = await supabaseClient
      .from("system_integrations")
      .select("config_value")
      .eq("integration_type", "mercado_pago")
      .eq("config_key", "access_token")
      .eq("is_active", true)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!tokenConfig?.config_value) {
      return new Response(
        JSON.stringify({ error: "Mercado Pago no está configurado para este tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenConfig.config_value;

    // Get pending MP payments
    let query = supabaseClient
      .from("pagos")
      .select("id, envio_id, mercado_pago_id, monto")
      .eq("metodo", "mercado_pago")
      .eq("estado", "pendiente")
      .eq("tenant_id", tenantId);

    if (pagoId) {
      query = query.eq("id", pagoId);
    }

    const { data: pendingPayments, error: queryError } = await query;

    if (queryError) {
      console.error("Error fetching pending payments:", queryError.message);
      return new Response(
        JSON.stringify({ error: "Error al buscar pagos pendientes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No hay pagos pendientes para sincronizar", updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingPayments.length} pending MP payments to check`);

    let updatedCount = 0;
    const results: Array<{ pago_id: string; status: string; mp_status: string | null }> = [];

    for (const pago of pendingPayments) {
      try {
        if (!pago.envio_id) {
          console.log(`Pago ${pago.id} has no envio_id, skipping`);
          results.push({ pago_id: pago.id, status: "skipped", mp_status: null });
          continue;
        }

        // Search MP payments by external_reference (envio_id)
        const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${pago.envio_id}&sort=date_created&criteria=desc&limit=5`;
        
        const mpResponse = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!mpResponse.ok) {
          console.error(`MP API error for pago ${pago.id}: ${mpResponse.status}`);
          results.push({ pago_id: pago.id, status: "error", mp_status: null });
          continue;
        }

        const mpData = await mpResponse.json();
        const mpPayments = mpData.results || [];

        if (mpPayments.length === 0) {
          console.log(`No MP payments found for envio ${pago.envio_id}`);
          results.push({ pago_id: pago.id, status: "no_mp_payment", mp_status: null });
          continue;
        }

        // Get the most recent payment
        const latestPayment = mpPayments[0];
        const newStatus = mapMpStatus(latestPayment.status);

        console.log(`Pago ${pago.id}: MP status=${latestPayment.status} -> ${newStatus}`);

        // Update the payment record
        const { error: updateError } = await supabaseClient
          .from("pagos")
          .update({
            estado: newStatus,
            mercado_pago_status: latestPayment.status,
            mercado_pago_id: latestPayment.id?.toString(),
            referencia: latestPayment.id?.toString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", pago.id);

        if (updateError) {
          console.error(`Error updating pago ${pago.id}:`, updateError.message);
          results.push({ pago_id: pago.id, status: "update_error", mp_status: latestPayment.status });
        } else {
          updatedCount++;
          results.push({ pago_id: pago.id, status: "updated", mp_status: latestPayment.status });
        }
      } catch (err) {
        console.error(`Error processing pago ${pago.id}:`, err);
        results.push({ pago_id: pago.id, status: "error", mp_status: null });
      }
    }

    console.log(`Sync complete: ${updatedCount}/${pendingPayments.length} payments updated`);

    return new Response(
      JSON.stringify({ 
        message: `${updatedCount} pagos actualizados de ${pendingPayments.length} pendientes`,
        updated: updatedCount,
        total: pendingPayments.length,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Check status error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
