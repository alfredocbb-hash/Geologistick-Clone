import { useJsApiLoader } from '@react-google-maps/api';
import { ReactNode, createContext, useContext, useMemo } from 'react';

const libraries: ("places" | "geometry" | "drawing")[] = ['places', 'geometry'];

// Get the client-side Maps API key from environment
// This should be a RESTRICTED key configured in Google Cloud Console:
// - HTTP referrer restrictions: your domain only
// - API restrictions: Maps JavaScript API only
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

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
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: MAPS_API_KEY,
    libraries,
    language: 'es',
    region: 'AR',
  });

  const contextValue = useMemo(() => ({
    isLoaded: MAPS_API_KEY ? isLoaded : false,
    loadError: !MAPS_API_KEY 
      ? 'Google Maps API key not configured' 
      : loadError?.message || null,
    apiKey: MAPS_API_KEY || null,
  }), [isLoaded, loadError]);

  return (
    <GoogleMapsContext.Provider value={contextValue}>
      {children}
    </GoogleMapsContext.Provider>
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

// Re-export for backwards compatibility
export { MAPS_API_KEY };
