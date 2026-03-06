import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
  tenant_id: string;
  to: string;
  subject: string;
  template: "status_change" | "shipment_created" | "test";
  data?: Record<string, unknown>;
}

interface SmtpConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  from_email: string;
  from_name?: string;
}

// ─── Fetch SMTP config for tenant ───────────────────────────────────────────
async function getSmtpConfig(
  supabase: ReturnType<typeof createClient>,
  tenantId: string
): Promise<SmtpConfig | null> {
  const { data, error } = await supabase
    .from("system_integrations")
    .select("config_key, config_value")
    .eq("integration_type", "email_smtp")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (error || !data || data.length === 0) return null;

  const config: Record<string, string> = {};
  for (const row of data) {
    config[row.config_key] = row.config_value;
  }

  if (!config.host || !config.port || !config.user || !config.password || !config.from_email) {
    return null;
  }

  return config as unknown as SmtpConfig;
}

// ─── Fetch tenant branding ──────────────────────────────────────────────────
async function getTenantBranding(
  supabase: ReturnType<typeof createClient>,
  tenantId: string
) {
  const { data } = await supabase
    .from("tenant_branding")
    .select("nombre_app, logo_light, color_primario")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return {
    nombre: data?.nombre_app || "Logística",
    logo: data?.logo_light || null,
    color: data?.color_primario || "#3B82F6",
  };
}

// ─── Status labels ──────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  recogido: "Recogido",
  en_sucursal: "En Sucursal",
  en_transito: "En Tránsito",
  en_reparto: "En Reparto",
  primera_visita: "Primera Visita",
  ausente: "Ausente",
  entregado: "Entregado",
  devuelto: "Devuelto",
  cancelado: "Cancelado",
  incidencia: "Incidencia",
};

// ─── HTML Templates ─────────────────────────────────────────────────────────
function buildEmailHtml(
  branding: { nombre: string; logo: string | null; color: string },
  title: string,
  body: string
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <tr><td style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:3px solid ${branding.color};">
    ${branding.logo ? `<img src="${branding.logo}" alt="${branding.nombre}" style="height:40px;margin-bottom:8px;" />` : ""}
    <h1 style="color:#18181b;margin:0;font-size:20px;">${branding.nombre}</h1>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="margin:0 0 16px;color:#18181b;font-size:18px;">${title}</h2>
    ${body}
  </td></tr>
  <tr><td style="padding:16px 32px;background:#f9fafb;text-align:center;border-top:1px solid #e4e4e7;">
    <p style="margin:0;color:#a1a1aa;font-size:12px;">Enviado por ${branding.nombre}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function templateStatusChange(
  branding: { nombre: string; logo: string | null; color: string },
  data: Record<string, unknown>
): { subject: string; html: string } {
  const tracking = (data.tracking_number as string) || "";
  const estado = (data.estado_nuevo as string) || "";
  const estadoLabel = STATUS_LABELS[estado] || estado;
  const destinatario = (data.nombre_destinatario as string) || "";
  const direccion = (data.direccion_entrega as string) || "";

  const subject = `Tu envío ${tracking} está ${estadoLabel}`;

  const body = `
    <p style="color:#3f3f46;line-height:1.6;">Hola${destinatario ? ` ${destinatario}` : ""},</p>
    <p style="color:#3f3f46;line-height:1.6;">Te informamos que tu envío <strong>${tracking}</strong> cambió de estado:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr><td style="padding:16px;background:#f4f4f5;border-radius:8px;text-align:center;">
        <span style="font-size:24px;font-weight:bold;color:${branding.color};">${estadoLabel}</span>
      </td></tr>
    </table>
    ${direccion ? `<p style="color:#71717a;font-size:14px;">📍 Dirección de entrega: ${direccion}</p>` : ""}
    <p style="color:#71717a;font-size:14px;margin-top:24px;">Si tenés alguna consulta, contactanos respondiendo a este email.</p>
  `;

  return { subject, html: buildEmailHtml(branding, "Actualización de envío", body) };
}

function templateShipmentCreated(
  branding: { nombre: string; logo: string | null; color: string },
  data: Record<string, unknown>
): { subject: string; html: string } {
  const tracking = (data.tracking_number as string) || "";
  const destinatario = (data.nombre_destinatario as string) || "";
  const direccion = (data.direccion_entrega as string) || "";

  const subject = `Nuevo envío creado: ${tracking}`;

  const body = `
    <p style="color:#3f3f46;line-height:1.6;">Hola${destinatario ? ` ${destinatario}` : ""},</p>
    <p style="color:#3f3f46;line-height:1.6;">Se creó un nuevo envío para vos con el código de seguimiento:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr><td style="padding:16px;background:#f4f4f5;border-radius:8px;text-align:center;">
        <span style="font-size:20px;font-weight:bold;color:${branding.color};">${tracking}</span>
      </td></tr>
    </table>
    ${direccion ? `<p style="color:#71717a;font-size:14px;">📍 Dirección de entrega: ${direccion}</p>` : ""}
    <p style="color:#71717a;font-size:14px;margin-top:24px;">Te avisaremos cuando haya novedades sobre tu envío.</p>
  `;

  return { subject, html: buildEmailHtml(branding, "Confirmación de envío", body) };
}

function templateTest(
  branding: { nombre: string; logo: string | null; color: string }
): { subject: string; html: string } {
  const subject = `✅ Email de prueba - ${branding.nombre}`;

  const body = `
    <p style="color:#3f3f46;line-height:1.6;">¡La configuración SMTP funciona correctamente!</p>
    <p style="color:#3f3f46;line-height:1.6;">Este es un email de prueba enviado desde la plataforma <strong>${branding.nombre}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr><td style="padding:16px;background:#ecfdf5;border-radius:8px;text-align:center;border:1px solid #a7f3d0;">
        <span style="font-size:16px;font-weight:bold;color:#059669;">✅ Conexión SMTP verificada</span>
      </td></tr>
    </table>
    <p style="color:#71717a;font-size:14px;">Fecha: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p>
  `;

  return { subject, html: buildEmailHtml(branding, "Email de prueba", body) };
}

// ─── Send email via SMTP ────────────────────────────────────────────────────
async function sendSmtpEmail(
  config: SmtpConfig,
  to: string,
  subject: string,
  html: string
) {
  const port = parseInt(config.port, 10);
  const useTLS = port === 465;

  const client = new SMTPClient({
    connection: {
      hostname: config.host,
      port,
      tls: useTLS,
      auth: {
        username: config.user,
        password: config.password,
      },
    },
  });

  try {
    await client.send({
      from: config.from_name
        ? `${config.from_name} <${config.from_email}>`
        : config.from_email,
      to,
      subject,
      content: "Auto",
      html,
    });
  } finally {
    await client.close();
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: EmailRequest = await req.json();
    const { tenant_id, to, template, data } = body;

    if (!tenant_id || !to || !template) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: tenant_id, to, template" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get SMTP config
    const smtpConfig = await getSmtpConfig(supabase, tenant_id);
    if (!smtpConfig) {
      return new Response(
        JSON.stringify({ error: "No hay configuración SMTP activa para este tenant" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get branding
    const branding = await getTenantBranding(supabase, tenant_id);

    // Build email content
    let emailContent: { subject: string; html: string };

    switch (template) {
      case "status_change":
        emailContent = templateStatusChange(branding, data || {});
        break;
      case "shipment_created":
        emailContent = templateShipmentCreated(branding, data || {});
        break;
      case "test":
        emailContent = templateTest(branding);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Template desconocido: ${template}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Use custom subject if provided
    const finalSubject = body.subject || emailContent.subject;

    // Send
    await sendSmtpEmail(smtpConfig, to, finalSubject, emailContent.html);

    console.log(`Email sent: template=${template}, to=${to}, tenant=${tenant_id}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email enviado correctamente" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error sending email:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
