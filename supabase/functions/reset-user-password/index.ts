import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token for auth verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the caller
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Caller ID:', caller.id);

    // Check if caller is admin
    const { data: callerRoles, error: rolesError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    if (rolesError) {
      console.error('Error fetching caller roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Error al verificar permisos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerRoleNames = callerRoles?.map(r => r.role) || [];
    const isAdmin = callerRoleNames.includes('admin') || callerRoleNames.includes('super_admin');

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Solo administradores pueden reiniciar contraseñas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { user_id, new_password } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get caller's tenant to ensure they can only reset users from same tenant
    const { data: callerProfile } = await userClient
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', caller.id)
      .single();

    // Create admin client for password update
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify target user belongs to same tenant (unless super_admin)
    const isSuperAdmin = callerRoleNames.includes('super_admin');
    if (!isSuperAdmin && callerProfile?.tenant_id) {
      const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user_id)
        .single();

      if (targetProfile?.tenant_id !== callerProfile.tenant_id) {
        return new Response(
          JSON.stringify({ error: 'No puedes reiniciar contraseñas de usuarios de otra empresa' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate password if not provided
    const password = new_password || generateSecurePassword();

    // Validate password strength
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user password using admin API
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
      password: password
    });

    if (updateError) {
      console.error('Error updating password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Error al actualizar contraseña: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Password reset successful for user:', user_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        new_password: password,
        message: 'Contraseña actualizada exitosamente'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Generate a secure random password
function generateSecurePassword(): string {
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '23456789';
  const symbols = '!@#$%&*';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  // Ensure at least one of each type
  let password = '';
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill remaining 8 characters randomly
  for (let i = 0; i < 8; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
