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

    // Create clients
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

    // Check if caller is super_admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: superAdminRoles, error: adminCheckError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .eq('role', 'super_admin');

    if (adminCheckError || !superAdminRoles || superAdminRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Solo los super administradores pueden crear empresas" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { 
      // Tenant data
      nombre_empresa, 
      slug, 
      plan, 
      activo, 
      max_usuarios, 
      max_sucursales, 
      max_envios_mes, 
      trial_days,
      // Admin user data
      admin_email, 
      admin_password, 
      admin_nombre, 
      admin_apellido, 
      admin_telefono 
    } = await req.json();

    // Validate required fields
    if (!nombre_empresa || !slug || !admin_email || !admin_password || !admin_nombre) {
      return new Response(
        JSON.stringify({ error: "Datos de empresa y administrador son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (admin_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if slug already exists
    const { data: existingTenant } = await adminClient
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingTenant) {
      return new Response(
        JSON.stringify({ error: "Ya existe una empresa con ese slug" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(u => u.email === admin_email);
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: "Ya existe un usuario con ese email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating tenant:", nombre_empresa);

    // Calculate trial end date
    const trialEndsAt = plan === 'trial' && trial_days > 0
      ? new Date(Date.now() + trial_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // 1. Create tenant
    const { data: tenant, error: tenantError } = await adminClient
      .from('tenants')
      .insert({
        nombre: nombre_empresa,
        slug: slug,
        plan: plan || 'trial',
        activo: activo !== false,
        max_usuarios: max_usuarios || 5,
        max_sucursales: max_sucursales || 3,
        max_envios_mes: max_envios_mes || 500,
        trial_ends_at: trialEndsAt
      })
      .select()
      .single();

    if (tenantError) {
      console.error("Tenant creation failed:", tenantError);
      return new Response(
        JSON.stringify({ error: "Error al crear la empresa: " + tenantError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Tenant created:", tenant.id);

    // 2. Create the admin user with tenant_id in metadata
    // This tells the handle_new_user trigger to NOT create a new tenant
    const { data: newUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: { 
        nombre: admin_nombre,
        tenant_id: tenant.id  // Pass tenant_id so trigger knows not to create new tenant
      },
    });

    if (createUserError) {
      console.error("User creation failed:", createUserError);
      // Rollback: delete the tenant
      await adminClient.from('tenants').delete().eq('id', tenant.id);
      return new Response(
        JSON.stringify({ error: "Error al crear el usuario: " + createUserError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;
    console.log("User created:", userId);

    // 3. Create the "Administración" branch first (needed for profile)
    const { data: branch, error: branchError } = await adminClient
      .from('sucursales')
      .insert({
        nombre: 'Administración',
        direccion: 'Por configurar',
        tenant_id: tenant.id,
        codigo: 'ADMIN',
        es_centro_logistico: true,
        activa: true
      })
      .select()
      .single();

    if (branchError) {
      console.error("Branch creation failed:", branchError);
      // Rollback: delete tenant
      await adminClient.from('tenants').delete().eq('id', tenant.id);
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Error al crear sucursal: " + branchError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Wait for the trigger to create profile, then update it
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update the profile with tenant_id and other data
    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({
        tenant_id: tenant.id,
        apellido: admin_apellido || null,
        telefono: admin_telefono || null,
        sucursal_id: branch?.id || null,
        activo: true,
      })
      .eq('user_id', userId);

    if (profileUpdateError) {
      console.error("Profile update failed:", profileUpdateError);
      // Try to create profile if it doesn't exist
      const { error: profileInsertError } = await adminClient
        .from('profiles')
        .insert({
          user_id: userId,
          email: admin_email,
          nombre: admin_nombre,
          apellido: admin_apellido || null,
          telefono: admin_telefono || null,
          tenant_id: tenant.id,
          sucursal_id: branch?.id || null,
          activo: true,
        });
      
      if (profileInsertError) {
        console.error("Profile insert also failed:", profileInsertError);
      }
    }

    // 5. Assign admin role (CRITICAL - must succeed, idempotent)
    const { error: roleError } = await adminClient
      .from('user_roles')
      .upsert(
        { user_id: userId, role: 'admin' },
        { onConflict: 'user_id,role', ignoreDuplicates: true }
      );

    if (roleError) {
      console.error("Role assignment failed:", roleError);
      // Rollback everything - this is critical
      await adminClient.from('sucursales').delete().eq('tenant_id', tenant.id);
      await adminClient.from('profiles').delete().eq('user_id', userId);
      await adminClient.auth.admin.deleteUser(userId);
      await adminClient.from('tenants').delete().eq('id', tenant.id);
      return new Response(
        JSON.stringify({ error: "Error al asignar rol de administrador: " + roleError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Create branding
    const { error: brandingError } = await adminClient
      .from('tenant_branding')
      .insert({
        tenant_id: tenant.id,
        nombre_app: nombre_empresa
      });

    if (brandingError) {
      console.error("Branding creation failed:", brandingError);
    }

    console.log("Tenant with admin created successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        tenant_id: tenant.id,
        user_id: userId,
        message: "Empresa y administrador creados exitosamente" 
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
