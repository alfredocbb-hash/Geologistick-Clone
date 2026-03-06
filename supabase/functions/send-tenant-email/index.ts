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

// ─── HTML builder (no indentation in literals to avoid =20) ─────────────────
function buildEmailHtml(
  branding: { nombre: string; logo: string | null; color: string },
  title: string,
  body: string
): string {
  const logoHtml = branding.logo
    ? `<img src="${branding.logo}" alt="${branding.nombre}" style="height:40px;margin-bottom:8px;" />`
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:3px solid ${branding.color};">
${logoHtml}
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

function buildTrackingButton(trackingUrl: string, color: string): string {
  if (!trackingUrl) return "";
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
<tr><td align="center">
<a href="${trackingUrl}" target="_blank" style="display:inline-block;padding:12px 28px;background:${color};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Segu\u00ed tu env\u00edo</a>
</td></tr>
</table>`;
}

function buildCodNotice(pagoContraEntrega: boolean, precioTotal: number | string | undefined): string {
  if (!pagoContraEntrega) return "";
  const monto = typeof precioTotal === "number" ? precioTotal.toLocaleString("es-AR", { style: "currency", currency: "ARS" }) : (precioTotal ? `$${precioTotal}` : "");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
<tr><td style="padding:14px 16px;background:#FEF3C7;border-radius:8px;border:1px solid #FDE68A;">
<p style="margin:0;color:#92400E;font-size:14px;font-weight:bold;">💰 Pago en destino</p>
<p style="margin:4px 0 0;color:#92400E;font-size:14px;">Al recibir tu paquete deb\u00e9s abonar ${monto}.</p>
</td></tr>
</table>`;
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
  const trackingUrl = (data.tracking_url as string) || "";
  const pagoContraEntrega = data.pago_contra_entrega === true;
  const precioTotal = data.precio_total as number | string | undefined;

  const subject = `Tu envío ${tracking} está ${estadoLabel}`;

  const saludo = destinatario ? `Hola <strong>${destinatario}</strong>,` : "Hola,";
  const direccionHtml = direccion ? `<p style="color:#71717a;font-size:14px;">\u{1F4CD} Direcci\u00f3n de entrega: ${direccion}</p>` : "";

  const body = `<p style="color:#3f3f46;line-height:1.6;">${saludo}</p>
<p style="color:#3f3f46;line-height:1.6;">Te informamos que tu env\u00edo <strong>${tracking}</strong> cambi\u00f3 de estado:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
<tr><td style="padding:16px;background:#f4f4f5;border-radius:8px;text-align:center;">
<span style="font-size:24px;font-weight:bold;color:${branding.color};">${estadoLabel}</span>
</td></tr>
</table>
${direccionHtml}
${buildCodNotice(pagoContraEntrega, precioTotal)}
${buildTrackingButton(trackingUrl, branding.color)}
<p style="color:#71717a;font-size:14px;margin-top:24px;">Si ten\u00e9s alguna consulta, contactanos respondiendo a este email.</p>`;

  return { subject, html: buildEmailHtml(branding, "Actualizaci\u00f3n de env\u00edo", body) };
}

function templateShipmentCreated(
  branding: { nombre: string; logo: string | null; color: string },
  data: Record<string, unknown>
): { subject: string; html: string } {
  const tracking = (data.tracking_number as string) || "";
  const destinatario = (data.nombre_destinatario as string) || "";
  const direccion = (data.direccion_entrega as string) || "";
  const trackingUrl = (data.tracking_url as string) || "";
  const pagoContraEntrega = data.pago_contra_entrega === true;
  const precioTotal = data.precio_total as number | string | undefined;

  const subject = `Nuevo envío creado: ${tracking}`;

  const saludo = destinatario ? `Hola <strong>${destinatario}</strong>,` : "Hola,";
  const direccionHtml = direccion ? `<p style="color:#71717a;font-size:14px;">\u{1F4CD} Direcci\u00f3n de entrega: ${direccion}</p>` : "";

  const body = `<p style="color:#3f3f46;line-height:1.6;">${saludo}</p>
<p style="color:#3f3f46;line-height:1.6;">Se cre\u00f3 un nuevo env\u00edo para vos con el c\u00f3digo de seguimiento:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
<tr><td style="padding:16px;background:#f4f4f5;border-radius:8px;text-align:center;">
<span style="font-size:20px;font-weight:bold;color:${branding.color};">${tracking}</span>
</td></tr>
</table>
${direccionHtml}
${buildCodNotice(pagoContraEntrega, precioTotal)}
${buildTrackingButton(trackingUrl, branding.color)}
<p style="color:#71717a;font-size:14px;margin-top:24px;">Te avisaremos cuando haya novedades sobre tu env\u00edo.</p>`;

  return { subject, html: buildEmailHtml(branding, "Confirmaci\u00f3n de env\u00edo", body) };
}

function templateTest(
  branding: { nombre: string; logo: string | null; color: string }
): { subject: string; html: string } {
  const subject = `✅ Email de prueba - ${branding.nombre}`;

  const body = `<p style="color:#3f3f46;line-height:1.6;">\u00a1La configuraci\u00f3n SMTP funciona correctamente!</p>
<p style="color:#3f3f46;line-height:1.6;">Este es un email de prueba enviado desde la plataforma <strong>${branding.nombre}</strong>.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
<tr><td style="padding:16px;background:#ecfdf5;border-radius:8px;text-align:center;border:1px solid #a7f3d0;">
<span style="font-size:16px;font-weight:bold;color:#059669;">\u2705 Conexi\u00f3n SMTP verificada</span>
</td></tr>
</table>
<p style="color:#71717a;font-size:14px;">Fecha: ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p>`;

  return { subject, html: buildEmailHtml(branding, "Email de prueba", body) };
}

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

    const smtpConfig = await getSmtpConfig(supabase, tenant_id);
    if (!smtpConfig) {
      return new Response(
        JSON.stringify({ error: "No hay configuración SMTP activa para este tenant" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const branding = await getTenantBranding(supabase, tenant_id);

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

    const finalSubject = body.subject || emailContent.subject;

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
