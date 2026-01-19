import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MapsApiKeyState {
  apiKey: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useMapsApiKey(): MapsApiKeyState {
  const [state, setState] = useState<MapsApiKeyState>({
    apiKey: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchApiKey() {
      try {
        // First check if we have a VITE env var (for local development)
        const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (envKey) {
          if (isMounted) {
            setState({ apiKey: envKey, isLoading: false, error: null });
          }
          return;
        }

        // Otherwise fetch from edge function (requires auth)
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (isMounted) {
            setState({ 
              apiKey: null, 
              isLoading: false, 
              error: 'Authentication required for maps' 
            });
          }
          return;
        }

        const { data, error } = await supabase.functions.invoke('get-maps-config');
        
        if (error) {
          console.error('Error fetching maps config:', error);
          if (isMounted) {
            setState({ 
              apiKey: null, 
              isLoading: false, 
              error: error.message || 'Failed to load maps configuration' 
            });
          }
          return;
        }

        if (isMounted) {
          setState({ 
            apiKey: data?.apiKey || null, 
            isLoading: false, 
            error: data?.apiKey ? null : 'Maps API key not available' 
          });
        }
      } catch (err) {
        console.error('Error in useMapsApiKey:', err);
        if (isMounted) {
          setState({ 
            apiKey: null, 
            isLoading: false, 
            error: 'Failed to initialize maps' 
          });
        }
      }
    }

    fetchApiKey();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
