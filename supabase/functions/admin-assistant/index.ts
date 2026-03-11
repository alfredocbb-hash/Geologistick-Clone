import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: get user from token
    const authHeader = req.headers.get("Authorization") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tenant context using service role
    const adminClient = createClient(supabaseUrl, supabaseKey);

    const [profileRes, rolesRes] = await Promise.all([
      adminClient
        .from("profiles")
        .select("tenant_id, sucursal_id, nombre")
        .eq("user_id", user.id)
        .maybeSingle(),
      adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id),
    ]);

    const profile = profileRes.data;

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Sin tenant asignado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;
    const userRoles: string[] = (rolesRes.data ?? []).map((r: any) => r.role);
    const isAdmin = userRoles.some((r) => r === "admin" || r === "super_admin");

    // Fetch context - admins get full data, others get limited
    const contextPromises: Promise<any>[] = [
      adminClient.from("tenants").select("nombre, plan, configuracion, trial_ends_at, max_usuarios, max_sucursales, max_envios_mes").eq("id", tenantId).maybeSingle(),
      adminClient.from("sucursales").select("id, nombre, direccion, ciudad, provincia, codigo_postal, es_centro_logistico, activa").eq("tenant_id", tenantId),
    ];

    if (isAdmin) {
      contextPromises.push(
        adminClient.from("sucursal_zonas").select("id, sucursal_id, tipo, valor, provincia, codigo_postal_desde, codigo_postal_hasta, activa").eq("tenant_id", tenantId).eq("activa", true),
        adminClient.from("tarifas").select("id, nombre, tipo, metodo_calculo, activa").eq("tenant_id", tenantId),
        adminClient.from("configuracion_seguro").select("*").eq("tenant_id", tenantId).maybeSingle(),
      );
    }

    const results = await Promise.all(contextPromises);
    const tenant = results[0].data;
    const sucursales = results[1].data ?? [];
    const zonas = isAdmin ? (results[2]?.data ?? []) : [];
    const tarifas = isAdmin ? (results[3]?.data ?? []) : [];
    const configSeguro = isAdmin ? results[4]?.data : null;

    let systemPrompt: string;

    if (isAdmin) {
      // Build zone summary per branch
      const zonasMap: Record<string, any[]> = {};
      for (const z of zonas) {
        const key = z.sucursal_id;
        if (!zonasMap[key]) zonasMap[key] = [];
        zonasMap[key].push(z);
      }

      const sucursalesConZonas = sucursales.map((s: any) => ({
        ...s,
        zonas_cobertura: zonasMap[s.id] ?? [],
      }));

      systemPrompt = `Eres el asistente de soporte técnico de la plataforma de logística. Tu rol es ayudar a los administradores a diagnosticar problemas de configuración, responder dudas sobre funcionalidades y guiar en la resolución de incidencias.

REGLAS IMPORTANTES:
- Responde siempre en español argentino.
- Sé conciso pero completo.
- Usa los datos reales del cliente que tienes a continuación para dar respuestas contextualizadas.
- Si detectas un problema de configuración, explica exactamente qué está mal y cómo solucionarlo paso a paso.
- Si no puedes resolver un problema (bugs, errores del sistema, temas de facturación), sugiere contactar al soporte humano.
- No inventes datos ni funcionalidades que no existan.
- Formatea tus respuestas con markdown cuando sea útil (listas, negritas, etc).

DATOS DEL CLIENTE:
- Nombre del administrador: ${profile.nombre}
- Empresa: ${tenant?.nombre ?? "N/A"}
- Plan: ${tenant?.plan ?? "N/A"}
- Límites: ${tenant?.max_usuarios ?? "?"} usuarios, ${tenant?.max_sucursales ?? "?"} sucursales, ${tenant?.max_envios_mes ?? "?"} envíos/mes

SUCURSALES Y ZONAS DE COBERTURA:
${JSON.stringify(sucursalesConZonas, null, 2)}

TARIFAS CONFIGURADAS:
${JSON.stringify(tarifas, null, 2)}

${configSeguro ? `CONFIGURACIÓN DE SEGURO:\n${JSON.stringify(configSeguro, null, 2)}` : "No hay configuración de seguro."}

${tenant?.configuracion ? `CONFIGURACIÓN AVANZADA:\n${JSON.stringify(tenant.configuracion, null, 2)}` : ""}

FUNCIONALIDADES DE LA PLATAFORMA QUE CONOCES:
- **Zonas de cobertura**: Cada sucursal puede tener zonas definidas por ciudad, provincia o rango de código postal. Si no tiene zonas, acepta todos los destinos. La validación compara la dirección de entrega contra las zonas activas.
- **Tarifas**: Se pueden configurar por peso, distancia, zona o monto fijo. Cada sucursal puede tener tarifas específicas habilitadas.
- **Envíos**: Tienen estados como pendiente, recogido, en_sucursal, en_transito, en_reparto, entregado, devuelto, cancelado, incidencia.
- **Sucursales**: Pueden ser centros logísticos o sucursales regulares. Cada una tiene su propia configuración de cobertura y tarifas.
- **Hojas de ruta y rutas planificadas**: Para organizar las entregas de los choferes.
- **Liquidaciones**: Para chofer, sucursales, clientes y sellers de ecommerce.
- **Integraciones**: Mercado Libre, Tiendanube, ARCA (facturación electrónica).
- **Seguro**: Configurable con base + porcentaje excedente sobre valor declarado.`;
    } else {
      // Non-admin prompt: operational focus
      const userSucursal = sucursales.find((s: any) => s.id === profile.sucursal_id);
      const roleName = userRoles.includes("chofer") ? "chofer" : userRoles.join(", ") || "operador";

      systemPrompt = `Eres el asistente de ayuda operativa de la plataforma de logística. Tu rol es ayudar a los usuarios con sus tareas diarias.

REGLAS IMPORTANTES:
- Responde siempre en español argentino.
- Sé conciso y práctico.
- Enfocate en ayudar con tareas operativas del día a día.
- Si la consulta requiere cambios de configuración, indicá que debe pedirle a un administrador.
- No inventes datos ni funcionalidades que no existan.
- Formatea tus respuestas con markdown cuando sea útil.

DATOS DEL USUARIO:
- Nombre: ${profile.nombre}
- Rol: ${roleName}
- Empresa: ${tenant?.nombre ?? "N/A"}
${userSucursal ? `- Sucursal: ${userSucursal.nombre} (${userSucursal.ciudad || userSucursal.direccion})` : ""}

GUÍA OPERATIVA QUE CONOCES:

**ESTADOS DE ENVÍO:**
- **pendiente**: Envío creado, esperando ser procesado
- **recogido**: Paquete recogido del remitente
- **en_sucursal**: Paquete ingresado a una sucursal
- **en_transito**: En camino entre sucursales (hoja de ruta)
- **en_reparto**: En reparto de última milla con chofer
- **primera_visita / ausente**: Intento de entrega fallido
- **entregado**: Entrega exitosa
- **devuelto**: Devuelto a origen
- **cancelado**: Envío cancelado
- **incidencia**: Problema reportado

**OPERACIONES COMUNES:**
- **Escanear paquetes**: Usar la sección "Escanear QR" para cambiar estados de envíos
- **Recibir envíos en sucursal**: Escanear con opción "Recepción" para marcar como en_sucursal
- **Despachar envíos**: Crear hojas de ruta para envíos entre sucursales
- **Entregar en sucursal**: Usar "Entrega en Sucursal" para entregas que el destinatario retira
- **Entregar a domicilio**: Durante el reparto, confirmar entrega con firma/foto
- **Reportar incidencia**: Si hay un problema con un envío, reportar incidencia desde el detalle
- **Reprogramar entrega**: Si no se puede entregar, reprogramar para otra fecha
- **Cobro contra entrega (COD)**: Al entregar, registrar el cobro si el envío es pago destino
- **Rendición COD**: Los choferes rinden los cobros realizados en la sucursal

**CAJA:**
- Abrir sesión de caja al iniciar el día
- Los movimientos se registran automáticamente al cobrar envíos o recibir rendiciones
- Cerrar caja al finalizar el día

${userRoles.includes("chofer") ? `**PARA CHOFERES:**
- Iniciar ruta desde "Mis Rutas" 
- Seguir el orden de paradas sugerido
- Confirmar entregas con firma del destinatario y foto
- Registrar cobros COD al momento de entregar
- Reprogramar entregas si el destinatario no está
- Cerrar la ruta al finalizar todas las paradas
- Rendir los cobros COD en la sucursal` : ""}`;
    }

    // Call Lovable AI with streaming
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas consultas. Intentá de nuevo en unos segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del asistente de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("admin-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
