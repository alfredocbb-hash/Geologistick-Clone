import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  address: string;
  city?: string;
  province?: string;
  country?: string;
}

interface GeocodeResponse {
  lat: number;
  lng: number;
  formatted_address: string;
  city?: string;
  province?: string;
  postal_code?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY not configured');
    }

    const { address, city, province, country = 'Argentina' }: GeocodeRequest = await req.json();

    if (!address) {
      throw new Error('Address is required');
    }

    // Build full address string
    const addressParts = [address];
    if (city) addressParts.push(city);
    if (province) addressParts.push(province);
    addressParts.push(country);
    
    const fullAddress = addressParts.join(', ');
    
    // Call Google Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}&language=es`;
    
    const response = await fetch(geocodeUrl);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      return new Response(
        JSON.stringify({ 
          error: 'No results found',
          status: data.status 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const result = data.results[0];
    const location = result.geometry.location;

    // Extract address components
    let extractedCity = '';
    let extractedProvince = '';
    let postalCode = '';

    for (const component of result.address_components) {
      if (component.types.includes('locality')) {
        extractedCity = component.long_name;
      }
      if (component.types.includes('administrative_area_level_1')) {
        extractedProvince = component.long_name;
      }
      if (component.types.includes('postal_code')) {
        postalCode = component.long_name;
      }
    }

    const geocodeResponse: GeocodeResponse = {
      lat: location.lat,
      lng: location.lng,
      formatted_address: result.formatted_address,
      city: extractedCity,
      province: extractedProvince,
      postal_code: postalCode,
    };

    return new Response(
      JSON.stringify(geocodeResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    console.error('Geocoding error:', error);
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
