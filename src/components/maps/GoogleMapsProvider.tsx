import { useJsApiLoader } from '@react-google-maps/api';
import { ReactNode, createContext, useContext, useMemo, useEffect, useState } from 'react';
import { useMapsApiKey } from '@/hooks/useMapsApiKey';

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

// Inner component that loads the map once we have the API key
function GoogleMapsLoaderInner({ 
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
  const { apiKey, isLoading, error } = useMapsApiKey();

  // While loading the API key, show children with a "not loaded" context
  if (isLoading) {
    return (
      <GoogleMapsContext.Provider value={{ 
        isLoaded: false, 
        loadError: null, 
        apiKey: null 
      }}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  // If there's an error or no API key, provide error context
  if (error || !apiKey) {
    return (
      <GoogleMapsContext.Provider value={{ 
        isLoaded: false, 
        loadError: error || 'Google Maps API key not configured', 
        apiKey: null 
      }}>
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  // Once we have the API key, use the inner loader
  return (
    <GoogleMapsLoaderInner apiKey={apiKey}>
      {children}
    </GoogleMapsLoaderInner>
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

// Export a getter for backwards compatibility (will be null until loaded)
export const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
