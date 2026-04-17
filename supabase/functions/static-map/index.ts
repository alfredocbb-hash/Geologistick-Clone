import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;
    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const zoom = Number.isFinite(Number(body.zoom)) ? Number(body.zoom) : 16;
    const size = typeof body.size === 'string' ? body.size : '400x200';

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response(JSON.stringify({ error: 'Invalid lat/lng' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();

    const tenantId = profile?.tenant_id;

    // Service client to bypass RLS for system_integrations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let mapsApiKey: string | null = null;
    if (tenantId) {
      for (const env of ['production', 'sandbox']) {
        const { data: integration } = await serviceClient
          .from('system_integrations')
          .select('config_value')
          .eq('tenant_id', tenantId)
          .eq('integration_type', 'google_maps')
          .eq('config_key', 'api_key')
          .eq('environment', env)
          .eq('is_active', true)
          .maybeSingle();
        if (integration?.config_value) {
          mapsApiKey = integration.config_value;
          break;
        }
      }
    }

    if (!mapsApiKey) {
      mapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('VITE_GOOGLE_MAPS_API_KEY') || null;
    }

    if (!mapsApiKey) {
      return new Response(JSON.stringify({ error: 'Maps API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://maps.googleapis.com/maps/api/staticmap?` +
      `center=${lat},${lng}` +
      `&zoom=${zoom}` +
      `&size=${size}` +
      `&scale=2` +
      `&maptype=roadmap` +
      `&markers=color:red%7Csize:mid%7C${lat},${lng}` +
      `&key=${mapsApiKey}`;

    const mapResponse = await fetch(url);
    if (!mapResponse.ok) {
      const errText = await mapResponse.text();
      console.error('Static Maps fetch failed:', mapResponse.status, errText);
      return new Response(JSON.stringify({ error: 'Failed to fetch static map', status: mapResponse.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const arrayBuffer = await mapResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as unknown as number[]);
    }
    const base64 = btoa(binary);

    return new Response(
      JSON.stringify({ image: `data:image/png;base64,${base64}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('static-map error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
