import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface MapsApiKeyState {
  apiKey: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useMapsApiKey(): MapsApiKeyState {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['maps-api-key'],
    queryFn: async () => {
      // Check env var first (local development)
      const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (envKey) return envKey as string;

      const { data, error } = await supabase.functions.invoke('get-maps-config');
      if (error) throw new Error(error.message || 'Failed to load maps configuration');
      if (!data?.apiKey) throw new Error('Maps API key not available');
      return data.apiKey as string;
    },
    enabled: !!user || !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });

  return {
    apiKey: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
