import { useJsApiLoader } from '@react-google-maps/api';
import { ReactNode, useState, useEffect, createContext, useContext, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

const libraries: ("places" | "geometry" | "drawing")[] = ['places', 'geometry'];

interface GoogleMapsContextType {
  isLoaded: boolean;
  loadError: string | null;
  apiKey: string | null;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({
  isLoaded: false,
  loadError: null,
  apiKey: null,
});

interface GoogleMapsProviderProps {
  children: ReactNode;
}

// Inner component that loads Google Maps once we have the API key
function GoogleMapsLoader({ 
  apiKey, 
  children 
}: { 
  apiKey: string; 
  children: ReactNode;
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries,
    language: 'es',
    region: 'AR',
  });

  const contextValue = useMemo(() => ({
    isLoaded,
    loadError: loadError?.message || null,
    apiKey,
  }), [isLoaded, loadError, apiKey]);

  return (
    <GoogleMapsContext.Provider value={contextValue}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch API key from edge function
  useEffect(() => {
    let mounted = true;

    const fetchApiKey = async () => {
      // Check if Google Maps is already loaded (e.g., from previous session)
      if (typeof window !== 'undefined' && window.google?.maps) {
        if (mounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-maps-api-key');
        
        if (!mounted) return;

        if (error) {
          console.error('Error fetching Maps API key:', error);
          setLoadError('Failed to load Google Maps API key');
          setIsLoading(false);
          return;
        }

        if (data?.apiKey) {
          setApiKey(data.apiKey);
        } else {
          setLoadError('Google Maps API key not configured');
        }
      } catch (err) {
        console.error('Error fetching Maps API key:', err);
        if (mounted) {
          setLoadError('Failed to load Google Maps API key');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchApiKey();

    return () => {
      mounted = false;
    };
  }, []);

  // Create a stable context value for non-loaded states
  const notLoadedValue = useMemo(() => ({
    isLoaded: false,
    loadError,
    apiKey: null,
  }), [loadError]);

  // If still loading or no API key, provide a non-loaded context
  if (isLoading || loadError || !apiKey) {
    return (
      <GoogleMapsContext.Provider value={notLoadedValue}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  // Once we have the API key, use the loader component
  return (
    <GoogleMapsLoader apiKey={apiKey}>
      {children}
    </GoogleMapsLoader>
  );
}

// Hook to check if Google Maps is available
export function useGoogleMapsLoaded(): boolean {
  const context = useContext(GoogleMapsContext);
  return context.isLoaded;
}

// Hook to get full context
export function useGoogleMaps(): GoogleMapsContextType {
  return useContext(GoogleMapsContext);
}
