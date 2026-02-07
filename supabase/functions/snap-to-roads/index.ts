import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SnapRequest {
  points: { lat: number; lng: number }[];
  interpolate?: boolean;
}

interface SnappedPoint {
  lat: number;
  lng: number;
  originalIndex?: number;
  placeId?: string;
}

interface SnapResponse {
  snappedPoints: SnappedPoint[];
  originalPointsCount: number;
  snappedPointsCount: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant to fetch API key
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'User has no tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Google Maps API key from system_integrations or fallback to env
    let apiKey: string | null = null;

    const { data: integration } = await supabase
      .from('system_integrations')
      .select('config')
      .eq('tenant_id', profile.tenant_id)
      .eq('service_name', 'google_maps')
      .eq('is_active', true)
      .order('environment', { ascending: false }) // production first
      .limit(1)
      .single();

    if (integration?.config && typeof integration.config === 'object') {
      apiKey = (integration.config as Record<string, string>).api_key || null;
    }

    // Fallback to environment variable
    if (!apiKey) {
      apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('VITE_GOOGLE_MAPS_API_KEY') || null;
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body with validation
    let body: SnapRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { points, interpolate = true } = body;

    if (!points || !Array.isArray(points) || points.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 points are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit array size to prevent resource exhaustion
    if (points.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Maximum 500 points allowed per request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate each point has valid coordinates
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p || typeof p.lat !== "number" || typeof p.lng !== "number" ||
          p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180 ||
          !isFinite(p.lat) || !isFinite(p.lng)) {
        return new Response(
          JSON.stringify({ error: `Invalid coordinates at index ${i}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Processing ${points.length} points for snap-to-roads`);

    // Google Roads API has a limit of 100 points per request
    // We'll process in batches if needed
    const BATCH_SIZE = 100;
    const allSnappedPoints: SnappedPoint[] = [];

    for (let i = 0; i < points.length; i += BATCH_SIZE - 1) {
      // Use BATCH_SIZE - 1 to ensure overlap for continuity
      const batch = points.slice(i, i + BATCH_SIZE);
      
      // Format path for Roads API
      const pathStr = batch.map(p => `${p.lat},${p.lng}`).join('|');
      
      const roadsUrl = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(pathStr)}&interpolate=${interpolate}&key=${apiKey}`;

      console.log(`Sending batch ${Math.floor(i / BATCH_SIZE) + 1} to Roads API (${batch.length} points)`);

      const roadsResponse = await fetch(roadsUrl);
      
      if (!roadsResponse.ok) {
        const errorText = await roadsResponse.text();
        console.error('Roads API error:', errorText);
        
        // If Roads API fails, return the original points as fallback
        if (allSnappedPoints.length === 0) {
          console.log('Roads API failed, returning original points');
          return new Response(
            JSON.stringify({
              snappedPoints: points.map((p, idx) => ({
                lat: p.lat,
                lng: p.lng,
                originalIndex: idx,
              })),
              originalPointsCount: points.length,
              snappedPointsCount: points.length,
              fallback: true,
              error: `Roads API error: ${roadsResponse.status}`,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;
      }

      const roadsData = await roadsResponse.json();

      if (roadsData.snappedPoints && Array.isArray(roadsData.snappedPoints)) {
        // Skip first point if not first batch to avoid duplicates
        const startIndex = i > 0 && allSnappedPoints.length > 0 ? 1 : 0;
        
        for (let j = startIndex; j < roadsData.snappedPoints.length; j++) {
          const sp = roadsData.snappedPoints[j];
          allSnappedPoints.push({
            lat: sp.location.latitude,
            lng: sp.location.longitude,
            originalIndex: sp.originalIndex !== undefined ? sp.originalIndex + i : undefined,
            placeId: sp.placeId,
          });
        }
      }
    }

    const response: SnapResponse = {
      snappedPoints: allSnappedPoints,
      originalPointsCount: points.length,
      snappedPointsCount: allSnappedPoints.length,
    };

    console.log(`Snap complete: ${points.length} → ${allSnappedPoints.length} points`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error in snap-to-roads:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
