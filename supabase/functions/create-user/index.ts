import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to validate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's token to check their role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is admin using direct query (RPC won't work with service role)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: adminRoles, error: adminCheckError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .in('role', ['admin', 'super_admin']);

    if (adminCheckError || !adminRoles || adminRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Solo los administradores pueden crear usuarios" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the admin's tenant_id from their profile
    const { data: adminProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', callingUser.id)
      .single();

    if (profileError || !adminProfile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "No se pudo obtener el tenant del administrador" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminTenantId = adminProfile.tenant_id;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Cuerpo de solicitud inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, nombre, apellido, telefono, sucursal_id, roles } = body as Record<string, any>;

    // Validate required fields
    if (!email || typeof email !== "string" || !nombre || typeof nombre !== "string" || !password || typeof password !== "string") {
      return new Response(
        JSON.stringify({ error: "Email, contraseña y nombre son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return new Response(
        JSON.stringify({ error: "Formato de email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate field lengths
    if (nombre.length > 100 || (apellido && apellido.length > 100) || (telefono && telefono.length > 30)) {
      return new Response(
        JSON.stringify({ error: "Los campos exceden la longitud máxima permitida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate sucursal_id is UUID if provided
    if (sucursal_id && (typeof sucursal_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sucursal_id))) {
      return new Response(
        JSON.stringify({ error: "sucursal_id tiene formato inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate roles array
    const validRoles = ['admin', 'operador', 'operador_sucursal', 'chofer', 'super_admin'];
    if (roles && (!Array.isArray(roles) || roles.length > 5 || roles.some((r: unknown) => typeof r !== "string" || !validRoles.includes(r as string)))) {
      return new Response(
        JSON.stringify({ error: "Roles inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length > 128) {
      return new Response(
        JSON.stringify({ error: "La contraseña es demasiado larga" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user using admin client - include tenant_id in metadata so the trigger knows
    // this user belongs to an existing tenant and doesn't create a new one
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { 
        nombre,
        tenant_id: adminTenantId, // Pass tenant_id so handle_new_user trigger assigns to existing tenant
      },
    });

    if (createError) {
      console.error("User creation failed:", createError?.message || "Unknown error");
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update the profile with additional data
    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({
        apellido: apellido || null,
        telefono: telefono || null,
        sucursal_id: sucursal_id || null,
        activo: true,
      })
      .eq('user_id', userId);

    if (profileUpdateError) {
      console.error("Profile update failed:", profileUpdateError?.message || "Unknown error");
      // Don't fail, profile was created by trigger
    }

    // Assign roles if provided (idempotent - ignores duplicates)
    if (roles && Array.isArray(roles) && roles.length > 0) {
      // Deduplicate roles array
      const uniqueRoles = [...new Set(roles)];
      const roleInserts = uniqueRoles.map((role: string) => ({
        user_id: userId,
        role: role,
      }));

      const { error: rolesError } = await adminClient
        .from('user_roles')
        .upsert(roleInserts, { onConflict: 'user_id,role', ignoreDuplicates: true });

      if (rolesError) {
        console.error("Role assignment failed:", rolesError?.message || "Unknown error");
        // Don't fail, user was created
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId,
        message: "Usuario creado exitosamente" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
