import { LoadScript } from '@react-google-maps/api';
import { ReactNode, useState, useEffect, createContext, useContext } from 'react';
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

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Fetch API key from edge function
  useEffect(() => {
    const fetchApiKey = async () => {
      // Check if Google Maps is already loaded
      if (window.google?.maps) {
        setScriptLoaded(true);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-maps-api-key');
        
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
        setLoadError('Failed to load Google Maps API key');
      } finally {
        setIsLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  // If no API key or still loading, render children without maps
  if (isLoading) {
    return (
      <GoogleMapsContext.Provider value={{ isLoaded: false, loadError: null, apiKey: null }}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  if (loadError || !apiKey) {
    return (
      <GoogleMapsContext.Provider value={{ isLoaded: false, loadError, apiKey: null }}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  // If already loaded by previous render
  if (window.google?.maps) {
    return (
      <GoogleMapsContext.Provider value={{ isLoaded: true, loadError: null, apiKey }}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  return (
    <LoadScript
      googleMapsApiKey={apiKey}
      libraries={libraries}
      language="es"
      region="AR"
      onLoad={() => setScriptLoaded(true)}
      onError={() => setLoadError('Failed to load Google Maps script')}
    >
      <GoogleMapsContext.Provider value={{ isLoaded: scriptLoaded, loadError: null, apiKey }}>
        {children}
      </GoogleMapsContext.Provider>
    </LoadScript>
  );
}

// Hook to check if Google Maps is available
export function useGoogleMapsLoaded(): boolean {
  const context = useContext(GoogleMapsContext);
  const [isLoaded, setIsLoaded] = useState(context.isLoaded);

  useEffect(() => {
    if (context.isLoaded) {
      setIsLoaded(true);
      return;
    }

    const checkLoaded = () => {
      if (window.google?.maps) {
        setIsLoaded(true);
      }
    };

    checkLoaded();
    
    // Check periodically until loaded
    const interval = setInterval(checkLoaded, 100);
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [context.isLoaded]);

  return isLoaded;
}

// Hook to get full context
export function useGoogleMaps(): GoogleMapsContextType {
  return useContext(GoogleMapsContext);
}
