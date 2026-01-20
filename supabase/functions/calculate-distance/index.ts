import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistanceRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
}

interface DistanceResponse {
  distance_km: number;
  duration_minutes: number;
  distance_text: string;
  duration_text: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the token using getClaims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);

    if (authError || !claimsData?.claims) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Authenticated user:', userId);

    // Get user's tenant from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile?.tenant_id) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const tenantId = profile.tenant_id;
    console.log('Tenant ID:', tenantId);

    // Use service role to fetch integration config (bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Try to get API key from system_integrations table for this tenant
    let apiKey: string | null = null;

    for (const env of ['production', 'sandbox']) {
      const { data: integration, error: integrationError } = await serviceClient
        .from('system_integrations')
        .select('config_value')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'google_maps')
        .eq('config_key', 'api_key')
        .eq('environment', env)
        .eq('is_active', true)
        .maybeSingle();

      if (!integrationError && integration?.config_value) {
        apiKey = integration.config_value;
        console.log(`Found Maps API key in ${env} environment`);
        break;
      }
    }

    // Fallback to environment variable if not found in DB
    if (!apiKey) {
      apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || null;
      if (apiKey) {
        console.log('Using Maps API key from environment variable');
      }
    }

    if (!apiKey) {
      console.error('Maps API key not configured for tenant:', tenantId);
      return new Response(
        JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY not configured for tenant' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { origin, destination }: DistanceRequest = await req.json();

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return new Response(
        JSON.stringify({ error: 'Origin and destination coordinates are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Call Google Distance Matrix API
    const distanceUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${apiKey}&language=es&units=metric`;
    
    console.log('Calling Google Distance Matrix API');
    const response = await fetch(distanceUrl);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google API error:', data.status, data.error_message);
      return new Response(
        JSON.stringify({ 
          error: 'Distance calculation failed',
          status: data.status 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const element = data.rows?.[0]?.elements?.[0];
    
    if (!element || element.status !== 'OK') {
      return new Response(
        JSON.stringify({ 
          error: 'No route found',
          status: element?.status || 'UNKNOWN'
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const distanceResponse: DistanceResponse = {
      distance_km: Math.round(element.distance.value / 100) / 10, // Convert meters to km with 1 decimal
      duration_minutes: Math.round(element.duration.value / 60), // Convert seconds to minutes
      distance_text: element.distance.text,
      duration_text: element.duration.text,
    };

    console.log('Distance calculated:', distanceResponse);

    return new Response(
      JSON.stringify(distanceResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    console.error('Distance calculation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
