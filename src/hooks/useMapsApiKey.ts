import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

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

    const safeSetState = (next: MapsApiKeyState) => {
      if (isMounted) setState(next);
    };

    async function fetchApiKey(sessionOverride?: Session | null) {
      try {
        // First check if we have a VITE env var (for local development)
        const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (envKey) {
          safeSetState({ apiKey: envKey, isLoading: false, error: null });
          return;
        }

        // Otherwise fetch from backend function (requires auth)
        const session = sessionOverride ?? (await supabase.auth.getSession()).data.session;

        // If the user is not authenticated yet, don't treat it as an error.
        // We'll automatically retry on SIGNED_IN via onAuthStateChange.
        if (!session) {
          safeSetState({ apiKey: null, isLoading: false, error: null });
          return;
        }

        const { data, error } = await supabase.functions.invoke('get-maps-config');
        
        if (error) {
          console.error('Error fetching maps config:', error);
          safeSetState({ 
            apiKey: null, 
            isLoading: false, 
            error: error.message || 'Failed to load maps configuration' 
          });
          return;
        }

        safeSetState({ 
          apiKey: data?.apiKey || null, 
          isLoading: false, 
          error: data?.apiKey ? null : 'Maps API key not available' 
        });
      } catch (err) {
        console.error('Error in useMapsApiKey:', err);
        safeSetState({ 
          apiKey: null, 
          isLoading: false, 
          error: 'Failed to initialize maps' 
        });
      }
    }

    // Initial load
    fetchApiKey();

    // Re-try automatically when auth state changes (fixes cases where the app
    // loads logged-out and the user logs in afterwards).
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Show loading while we re-evaluate
      safeSetState({ apiKey: null, isLoading: true, error: null });
      fetchApiKey(session);
    });

    return () => {
      isMounted = false;
      authSub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
