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
    if (!authHeader) {
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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY not configured');
    }

    const { origin, destination }: DistanceRequest = await req.json();

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      throw new Error('Origin and destination coordinates are required');
    }

    // Call Google Distance Matrix API
    const distanceUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${apiKey}&language=es&units=metric`;
    
    const response = await fetch(distanceUrl);
    const data = await response.json();

    if (data.status !== 'OK') {
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
