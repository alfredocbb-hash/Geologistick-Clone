import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface Location {
  lat: number;
  lng: number;
  accuracy: number;
}

interface UseGeolocationOptions {
  enabled?: boolean;
  updateInterval?: number; // milliseconds
  enableHighAccuracy?: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const { 
    enabled = false, 
    updateInterval = 30000, // 30 seconds default
    enableHighAccuracy = true 
  } = options;
  
  const { user } = useAuth();
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Update location to Supabase
  const updateLocationToSupabase = useCallback(async (loc: Location) => {
    if (!user?.id) return;

    try {
      const { error: upsertError } = await supabase
        .from('driver_locations')
        .upsert({
          chofer_id: user.id,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'chofer_id'
        });

      if (upsertError) {
        console.error('Error updating location:', upsertError);
      }
    } catch (err) {
      console.error('Error saving location:', err);
    }
  }, [user?.id]);

  // Handle position update
  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const newLocation: Location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
    
    setLocation(newLocation);
    setError(null);

    // Only update to Supabase if enough time has passed
    const now = Date.now();
    if (now - lastUpdateRef.current >= updateInterval) {
      lastUpdateRef.current = now;
      updateLocationToSupabase(newLocation);
    }
  }, [updateInterval, updateLocationToSupabase]);

  // Handle position error
  const handlePositionError = useCallback((err: GeolocationPositionError) => {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setError('Permiso de ubicación denegado');
        break;
      case err.POSITION_UNAVAILABLE:
        setError('Ubicación no disponible');
        break;
      case err.TIMEOUT:
        setError('Tiempo de espera agotado');
        break;
      default:
        setError('Error desconocido de ubicación');
    }
  }, []);

  // Start tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada');
      return;
    }

    setIsTracking(true);
    
    // Get initial position
    navigator.geolocation.getCurrentPosition(
      handlePositionUpdate,
      handlePositionError,
      { enableHighAccuracy, timeout: 10000, maximumAge: 0 }
    );

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      { enableHighAccuracy, timeout: 10000, maximumAge: 5000 }
    );
  }, [handlePositionUpdate, handlePositionError, enableHighAccuracy]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  // Effect to manage tracking based on enabled prop
  useEffect(() => {
    if (enabled && user?.id) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, user?.id, startTracking, stopTracking]);

  // Force update location now
  const forceUpdate = useCallback(() => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(newLocation);
        updateLocationToSupabase(newLocation);
      },
      handlePositionError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [handlePositionError, updateLocationToSupabase]);

  return {
    location,
    error,
    isTracking,
    startTracking,
    stopTracking,
    forceUpdate,
  };
}
