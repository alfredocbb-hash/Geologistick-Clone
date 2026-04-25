// Edge function: crea (o resetea) un tenant "Empresa Demo" con datos de capacitación.
// Solo invocable por super_admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_SLUG = "empresa-demo";
const DEMO_PASSWORD = "Demo1234!";

const DEMO_USERS = [
  { email: "admin@demo.com", nombre: "Ana", apellido: "Administradora", role: "admin", telefono: "+5491111110001" },
  { email: "operador@demo.com", nombre: "Oscar", apellido: "Operador", role: "operador", telefono: "+5491111110002" },
  { email: "chofer1@demo.com", nombre: "Carlos", apellido: "Chofer", role: "chofer", telefono: "+5491111110003" },
  { email: "chofer2@demo.com", nombre: "Carla", apellido: "Chofer", role: "chofer", telefono: "+5491111110004" },
  { email: "seller@demo.com", nombre: "Sofía", apellido: "Seller", role: "seller", telefono: "+5491111110005" },
];

// 30 nombres de clientes en CABA / GBA con coordenadas reales aproximadas
const CIUDADES = [
  { ciudad: "CABA", cp: "1414", lat: -34.5895, lng: -58.4220, calles: ["Av. Corrientes", "Av. Santa Fe", "Av. Cabildo", "Av. Rivadavia", "Av. Pueyrredón"] },
  { ciudad: "Vicente López", cp: "1638", lat: -34.5266, lng: -58.4815, calles: ["Av. Maipú", "Av. del Libertador"] },
  { ciudad: "San Isidro", cp: "1642", lat: -34.4707, lng: -58.5128, calles: ["Av. Centenario", "Av. del Libertador"] },
  { ciudad: "Quilmes", cp: "1878", lat: -34.7203, lng: -58.2545, calles: ["Av. Calchaquí", "Av. Mitre"] },
  { ciudad: "Lanús", cp: "1824", lat: -34.7036, lng: -58.3927, calles: ["Av. Hipólito Yrigoyen", "Av. 9 de Julio"] },
  { ciudad: "Morón", cp: "1708", lat: -34.6534, lng: -58.6198, calles: ["Av. Rivadavia", "Av. Don Bosco"] },
  { ciudad: "La Matanza", cp: "1754", lat: -34.7704, lng: -58.6326, calles: ["Av. Brigadier J.M. de Rosas"] },
  { ciudad: "Tigre", cp: "1648", lat: -34.4265, lng: -58.5797, calles: ["Av. Cazón", "Av. Italia"] },
];

const NOMBRES = ["Juan","María","Pedro","Lucía","Diego","Sofía","Martín","Florencia","Pablo","Laura","Javier","Carolina","Fernando","Valeria","Gabriel","Camila","Ricardo","Daniela","Sebastián","Romina","Andrés","Patricia","Hugo","Cecilia","Marcelo","Paula","Roberto","Gabriela","Esteban","Natalia"];
const APELLIDOS = ["González","Rodríguez","Fernández","López","Martínez","Pérez","García","Sánchez","Romero","Sosa","Álvarez","Torres","Ruiz","Ramírez","Flores","Acosta","Benítez","Medina","Suárez","Castro","Ortiz","Núñez","Silva","Moreno","Domínguez","Vega","Aguirre","Gómez","Herrera","Ríos"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function jitter(coord: number, range = 0.02) { return coord + (Math.random() - 0.5) * range; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verificar super_admin
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin");
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Solo super_admin puede ejecutar esta acción" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Si existe el tenant demo, borrarlo (CASCADE limpia mucho, pero hay que limpiar usuarios manualmente)
    const { data: existingTenant } = await admin.from("tenants").select("id").eq("slug", DEMO_SLUG).maybeSingle();
    if (existingTenant) {
      console.log("Borrando tenant demo existente:", existingTenant.id);
      // Borrar usuarios asociados al tenant
      const { data: oldProfiles } = await admin.from("profiles").select("user_id").eq("tenant_id", existingTenant.id);
      for (const p of oldProfiles || []) {
        try { await admin.auth.admin.deleteUser(p.user_id); } catch (e) { console.warn("delete user:", e); }
      }
      // Borrar datos en cascada
      await admin.from("envios").delete().eq("tenant_id", existingTenant.id);
      await admin.from("clientes").delete().eq("tenant_id", existingTenant.id);
      await admin.from("vehiculos").delete().eq("tenant_id", existingTenant.id);
      await admin.from("ecommerce_sellers").delete().eq("tenant_id", existingTenant.id);
      await admin.from("tarifas").delete().eq("tenant_id", existingTenant.id);
      await admin.from("hojas_ruta").delete().eq("tenant_id", existingTenant.id);
      await admin.from("rutas_planificadas").delete().eq("tenant_id", existingTenant.id);
      await admin.from("sucursales").delete().eq("tenant_id", existingTenant.id);
      await admin.from("tenant_branding").delete().eq("tenant_id", existingTenant.id);
      await admin.from("tenants").delete().eq("id", existingTenant.id);
    }

    // 2. Crear tenant
    const trialEnds = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data: tenant, error: tErr } = await admin.from("tenants").insert({
      nombre: "Empresa Demo",
      slug: DEMO_SLUG,
      plan: "trial",
      activo: true,
      max_usuarios: 50,
      max_sucursales: 10,
      max_envios_mes: 5000,
      trial_ends_at: trialEnds,
      ecommerce_enabled: true,
    }).select().single();
    if (tErr) throw new Error("Crear tenant: " + tErr.message);
    const tenantId = tenant.id;

    // 3. Branding con colores coherentes (menú claro y oscuro consistentes con cada tema)
    await admin.from("tenant_branding").insert({
      tenant_id: tenantId,
      nombre_app: "Empresa Demo",
      color_primario: "#3B82F6",
      color_primario_foreground: "#FFFFFF",
      color_secundario: "#1E40AF",
      color_acento: "#10B981",
      color_sidebar: "#F8FAFC",
      color_sidebar_dark: "#1A1A2E",
      color_fondo: "#FFFFFF",
      color_fondo_dark: "#0F172A",
    });

    // 4. Sucursal Central
    const { data: sucursal, error: sErr } = await admin.from("sucursales").insert({
      tenant_id: tenantId,
      nombre: "Sucursal Central",
      codigo: "CENTRAL",
      direccion: "Av. Corrientes 1234",
      ciudad: "CABA",
      telefono: "+541143215678",
      email: "central@demo.com",
      activa: true,
      es_centro_logistico: true,
      puede_despachar: true,
      puede_recibir: true,
      realiza_retiros: true,
      realiza_entregas: true,
      lat: -34.6037,
      lng: -58.3816,
    }).select().single();
    if (sErr) throw new Error("Crear sucursal: " + sErr.message);
    const sucursalId = sucursal.id;

    // 5. Crear usuarios
    const userIds: Record<string, string> = {};
    for (const u of DEMO_USERS) {
      const { data: newU, error: uErr } = await admin.auth.admin.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { nombre: u.nombre, tenant_id: tenantId },
      });
      if (uErr) throw new Error(`Crear usuario ${u.email}: ${uErr.message}`);
      const uid = newU.user.id;
      userIds[u.email] = uid;

      // Esperar a que el trigger handle_new_user cree el profile
      await new Promise(r => setTimeout(r, 500));

      // Actualizar profile con datos completos
      await admin.from("profiles").update({
        apellido: u.apellido,
        telefono: u.telefono,
        sucursal_id: u.role === "seller" ? null : sucursalId,
        activo: true,
      }).eq("user_id", uid);

      // Asignar rol (el trigger no asigna, sólo crea el profile cuando viene tenant_id)
      await admin.from("user_roles").upsert(
        { user_id: uid, role: u.role as any },
        { onConflict: "user_id,role", ignoreDuplicates: true }
      );
    }

    const adminId = userIds["admin@demo.com"];
    const chofer1Id = userIds["chofer1@demo.com"];
    const chofer2Id = userIds["chofer2@demo.com"];
    const sellerId = userIds["seller@demo.com"];

    // 6. Vehículos
    const { data: veh1 } = await admin.from("vehiculos").insert({
      tenant_id: tenantId, sucursal_id: sucursalId, chofer_asignado_id: chofer1Id,
      patente: "DEMO001", marca: "Mercedes", modelo: "Sprinter", anio: 2022,
      tipo: "furgon", capacidad_kg: 1500, capacidad_bultos: 80, estado: "disponible"
    }).select().single();
    const { data: veh2 } = await admin.from("vehiculos").insert({
      tenant_id: tenantId, sucursal_id: sucursalId, chofer_asignado_id: chofer2Id,
      patente: "DEMO002", marca: "Iveco", modelo: "Daily", anio: 2021,
      tipo: "furgon", capacidad_kg: 2000, capacidad_bultos: 100, estado: "disponible"
    }).select().single();

    // 7. Tarifa básica
    const { data: tarifa } = await admin.from("tarifas").insert({
      tenant_id: tenantId, nombre: "Tarifa Estándar Demo",
      tipo_tarifa: "peso", precio_base: 2500, precio_por_kg: 150,
      comision_chofer_porcentaje: 10, activa: true, created_by: adminId,
    }).select().single();

    // 8. Seller e-commerce
    await admin.from("ecommerce_sellers").insert({
      tenant_id: tenantId, user_id: sellerId, created_by: adminId,
      nombre: "Tienda Demo", razon_social: "Tienda Demo S.A.",
      cuit: "30-12345678-9", email: "seller@demo.com", telefono: "+5491111110005",
      direccion: "Av. Santa Fe 2500", ciudad: "CABA", provincia: "CABA", codigo_postal: "1425",
      plataforma: "manual", sucursal_pickup_id: sucursalId, tarifa_id: tarifa.id,
      activo: true, tiene_cuenta_corriente: true, limite_credito: 100000,
    });

    // 9. Crear 30 clientes
    const clientesIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const c = rand(CIUDADES);
      const calle = rand(c.calles);
      const nombre = NOMBRES[i % NOMBRES.length];
      const apellido = APELLIDOS[i % APELLIDOS.length];
      const { data: cli, error: cErr } = await admin.from("clientes").insert({
        tenant_id: tenantId, sucursal_id: sucursalId,
        nombre, apellido, email: `cliente${i + 1}@demo.com`,
        telefono: `+54911${String(20000000 + i).padStart(8, "0")}`,
        direccion: `${calle} ${randInt(100, 9999)}`,
        ciudad: c.ciudad, codigo_postal: c.cp,
        lat: jitter(c.lat), lng: jitter(c.lng),
        dni_cuit: String(20000000 + i * 137),
        tiene_cuenta_corriente: i % 5 === 0,
        limite_credito: i % 5 === 0 ? 50000 : 0,
      }).select().single();
      if (cErr) {
        console.warn("cliente skip:", cErr.message);
        continue;
      }
      clientesIds.push(cli.id);
    }

    // 10. Generar tracking numbers desde DB
    async function newTracking(): Promise<string> {
      const { data } = await admin.rpc("generate_tracking_number");
      return data as string;
    }

    // 11. Crear ~100 envíos en distintos estados y fechas
    type EstadoCount = { estado: string; count: number; chofer?: string };
    const distribucion: EstadoCount[] = [
      { estado: "pendiente", count: 15 },
      { estado: "recogido", count: 10 },
      { estado: "en_transito", count: 10 },
      { estado: "en_sucursal", count: 15 },
      { estado: "en_reparto", count: 15, chofer: chofer1Id },
      { estado: "entregado", count: 25 },
      { estado: "incidencia", count: 5 },
      { estado: "devuelto", count: 5 },
    ];

    const enviosIds: { id: string; estado: string; tracking: string }[] = [];
    const enviosEnReparto: string[] = [];
    const enviosEnSucursal: string[] = [];

    for (const grupo of distribucion) {
      for (let i = 0; i < grupo.count; i++) {
        const cli = rand(clientesIds);
        const c = rand(CIUDADES);
        const calle = rand(c.calles);
        const lat = jitter(c.lat);
        const lng = jitter(c.lng);
        const peso = randInt(1, 30);
        const bultos = randInt(1, 4);
        const cod = Math.random() < 0.4;
        const precio = 2500 + peso * 150;
        const daysAgo = randInt(0, 29);
        const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
        const tracking = await newTracking();

        const fechaEntrega = grupo.estado === "entregado"
          ? new Date(Date.now() - randInt(0, daysAgo) * 86400000).toISOString()
          : null;

        const { data: env, error: eErr } = await admin.from("envios").insert({
          tenant_id: tenantId,
          tracking_number: tracking,
          sucursal_origen_id: sucursalId,
          sucursal_destino_id: sucursalId,
          destinatario_id: cli,
          chofer_id: grupo.chofer || null,
          tarifa_id: tarifa.id,
          estado: grupo.estado as any,
          descripcion: `Paquete demo ${i + 1}`,
          peso_kg: peso,
          cantidad_bultos: bultos,
          precio_total: precio,
          pago_contra_entrega: cod,
          tipo_pago: cod ? "contra_entrega" : "contado",
          tipo_servicio_detalle: "sucursal_domicilio",
          direccion_entrega: `${calle} ${randInt(100, 9999)}`,
          ciudad_entrega: c.ciudad,
          cp_entrega: c.cp,
          provincia: c.ciudad === "CABA" ? "CABA" : "Buenos Aires",
          entrega_lat: lat,
          entrega_lng: lng,
          destinatario_lat: lat,
          destinatario_lng: lng,
          fecha_entrega: fechaEntrega,
          created_by: adminId,
          created_at: createdAt,
          source_module: "manual",
        }).select("id").single();

        if (eErr) { console.warn("envio skip:", eErr.message); continue; }
        enviosIds.push({ id: env.id, estado: grupo.estado, tracking });
        if (grupo.estado === "en_reparto") enviosEnReparto.push(env.id);
        if (grupo.estado === "en_sucursal") enviosEnSucursal.push(env.id);

        // Pago COD para entregados con CE
        if (grupo.estado === "entregado" && cod) {
          await admin.from("pagos").insert({
            tenant_id: tenantId, envio_id: env.id, cliente_id: cli,
            monto: precio, metodo: "efectivo", estado: "cobrado_chofer",
            created_by: chofer1Id,
          });
        }
      }
    }

    // 12. Hoja de ruta activa con 8 envíos en_sucursal asignada a chofer2
    const hojaEnvios = enviosEnSucursal.slice(0, 8);
    if (hojaEnvios.length > 0) {
      const { data: numHoja } = await admin.rpc("generate_hoja_ruta_number");
      const { data: hoja } = await admin.from("hojas_ruta").insert({
        tenant_id: tenantId,
        numero: numHoja as string,
        sucursal_origen_id: sucursalId,
        sucursal_destino_id: sucursalId,
        chofer_id: chofer2Id,
        vehiculo_id: veh2?.id,
        estado: "en_transito",
        cantidad_envios: hojaEnvios.length,
        fecha_salida: new Date().toISOString(),
        inicio_real: new Date().toISOString(),
        created_by: adminId,
      }).select().single();

      for (let i = 0; i < hojaEnvios.length; i++) {
        await admin.from("hoja_ruta_envios").insert({
          hoja_ruta_id: hoja.id, envio_id: hojaEnvios[i], orden: i + 1, estado: "pendiente"
        });
      }
    }

    // 13. Ruta planificada en curso con 6 paradas asignada a chofer1
    const rutaEnvios = enviosEnReparto.slice(0, 6);
    if (rutaEnvios.length > 0) {
      const { data: numRuta } = await admin.rpc("generate_ruta_number");
      const { data: ruta } = await admin.from("rutas_planificadas").insert({
        tenant_id: tenantId,
        numero: numRuta as string,
        fecha: new Date().toISOString().slice(0, 10),
        hora_inicio: "09:00",
        tipo: "entrega",
        chofer_id: chofer1Id,
        vehiculo_id: veh1?.id,
        sucursal_id: sucursalId,
        estado: "en_curso",
        total_paradas: rutaEnvios.length,
        created_by: adminId,
      }).select().single();

      for (let i = 0; i < rutaEnvios.length; i++) {
        const { data: env } = await admin.from("envios").select("direccion_entrega,entrega_lat,entrega_lng").eq("id", rutaEnvios[i]).single();
        await admin.from("ruta_paradas").insert({
          ruta_id: ruta.id, envio_id: rutaEnvios[i], orden: i + 1, tipo: "entrega",
          direccion: env?.direccion_entrega, lat: env?.entrega_lat, lng: env?.entrega_lng,
          estado: "pendiente",
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      tenant_id: tenantId,
      message: "Empresa Demo creada con éxito",
      credenciales: {
        password: DEMO_PASSWORD,
        usuarios: DEMO_USERS.map(u => ({ email: u.email, rol: u.role, nombre: `${u.nombre} ${u.apellido}` })),
      },
      stats: {
        sucursales: 1,
        usuarios: DEMO_USERS.length,
        clientes: clientesIds.length,
        envios: enviosIds.length,
        vehiculos: 2,
        hoja_ruta_activa: 1,
        ruta_planificada_activa: 1,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("seed-demo-tenant error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
