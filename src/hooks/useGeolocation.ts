import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
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
  const watchIdRef = useRef<string | number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isNative = Capacitor.isNativePlatform();

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

  // Handle position update (native)
  const handleNativePositionUpdate = useCallback((position: Position | null) => {
    if (!position) return;
    
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

  // Handle position update (web)
  const handleWebPositionUpdate = useCallback((position: GeolocationPosition) => {
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
  const handlePositionError = useCallback((err: GeolocationPositionError | any) => {
    const code = err?.code || 0;
    switch (code) {
      case 1: // PERMISSION_DENIED
        setError('Permiso de ubicación denegado');
        break;
      case 2: // POSITION_UNAVAILABLE
        setError('Ubicación no disponible');
        break;
      case 3: // TIMEOUT
        setError('Tiempo de espera agotado');
        break;
      default:
        setError(err?.message || 'Error desconocido de ubicación');
    }
  }, []);

  // Start tracking (native)
  const startNativeTracking = useCallback(async () => {
    try {
      // Request permissions first
      const permStatus = await Geolocation.requestPermissions();
      
      if (permStatus.location !== 'granted') {
        setError('Permiso de ubicación denegado');
        return;
      }

      setIsTracking(true);
      
      // Get initial position
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy,
        timeout: 10000,
      });
      handleNativePositionUpdate(position);

      // Watch position
      const watchId = await Geolocation.watchPosition(
        { enableHighAccuracy },
        (position, err) => {
          if (err) {
            handlePositionError(err);
          } else {
            handleNativePositionUpdate(position);
          }
        }
      );
      
      watchIdRef.current = watchId;
    } catch (err) {
      console.error('Error starting native tracking:', err);
      handlePositionError(err);
    }
  }, [enableHighAccuracy, handleNativePositionUpdate, handlePositionError]);

  // Start tracking (web)
  const startWebTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada');
      return;
    }

    setIsTracking(true);
    
    // Get initial position
    navigator.geolocation.getCurrentPosition(
      handleWebPositionUpdate,
      handlePositionError,
      { enableHighAccuracy, timeout: 10000, maximumAge: 0 }
    );

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleWebPositionUpdate,
      handlePositionError,
      { enableHighAccuracy, timeout: 10000, maximumAge: 5000 }
    );
  }, [handleWebPositionUpdate, handlePositionError, enableHighAccuracy]);

  // Start tracking
  const startTracking = useCallback(() => {
    if (isNative) {
      startNativeTracking();
    } else {
      startWebTracking();
    }
  }, [isNative, startNativeTracking, startWebTracking]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      if (isNative) {
        await Geolocation.clearWatch({ id: watchIdRef.current as string });
      } else {
        navigator.geolocation.clearWatch(watchIdRef.current as number);
      }
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, [isNative]);

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
  const forceUpdate = useCallback(async () => {
    try {
      if (isNative) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        const newLocation: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(newLocation);
        updateLocationToSupabase(newLocation);
      } else if (navigator.geolocation) {
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
      }
    } catch (err) {
      handlePositionError(err);
    }
  }, [isNative, handlePositionError, updateLocationToSupabase]);

  return {
    location,
    error,
    isTracking,
    startTracking,
    stopTracking,
    forceUpdate,
  };
}
