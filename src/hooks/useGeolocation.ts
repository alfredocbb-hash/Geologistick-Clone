import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface Location {
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
}

interface UseGeolocationOptions {
  enabled?: boolean;
  updateInterval?: number; // milliseconds
  enableHighAccuracy?: boolean;
  activeRouteId?: string | null; // ID de ruta planificada activa
  activeHojaRutaId?: string | null; // ID de hoja de ruta activa
  movementThreshold?: number; // meters - force update if moved more than this
}

// Calculate distance between two coordinates in meters (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const { 
    enabled = false, 
    updateInterval = 15000, // 15 seconds default (improved from 30s)
    enableHighAccuracy = true,
    activeRouteId = null,
    activeHojaRutaId = null,
    movementThreshold = 50, // 50 meters default
  } = options;
  
  const { user, profile } = useAuth();
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<string | number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastHistoryUpdateRef = useRef<number>(0);
  const lastSavedLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const isNative = Capacitor.isNativePlatform();

  // Update location to Supabase (current position + history)
  const updateLocationToSupabase = useCallback(async (loc: Location) => {
    if (!user?.id) return;

    try {
      // Update current location
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

      // Improved history recording logic:
      // - Save every 15 seconds when moving
      // - Force save immediately if moved more than threshold
      // - Skip if stationary (avoid duplicates)
      const now = Date.now();
      const timeSinceLastHistory = now - lastHistoryUpdateRef.current;
      const lastSaved = lastSavedLocationRef.current;
      
      let shouldSaveHistory = false;
      let distanceMoved = 0;
      
      if (lastSaved) {
        distanceMoved = calculateDistance(lastSaved.lat, lastSaved.lng, loc.lat, loc.lng);
      }
      
      // Force save if moved more than threshold (significant movement)
      if (distanceMoved >= movementThreshold) {
        shouldSaveHistory = true;
        console.log(`Movement detected: ${distanceMoved.toFixed(1)}m - forcing history save`);
      }
      // Regular interval save (15 seconds) but only if we've moved at least 5 meters
      else if (timeSinceLastHistory >= 15000 && distanceMoved >= 5) {
        shouldSaveHistory = true;
      }
      // First point always saved
      else if (!lastSaved) {
        shouldSaveHistory = true;
      }
      
      if (shouldSaveHistory) {
        lastHistoryUpdateRef.current = now;
        lastSavedLocationRef.current = { lat: loc.lat, lng: loc.lng };
        
        const { error: historyError } = await supabase
          .from('driver_location_history')
          .insert({
            chofer_id: user.id,
            ruta_id: activeRouteId,
            hoja_ruta_id: activeHojaRutaId,
            lat: loc.lat,
            lng: loc.lng,
            accuracy: loc.accuracy,
            speed: loc.speed,
            heading: loc.heading,
            tenant_id: profile?.tenant_id,
          });

        if (historyError) {
          console.error('Error saving location history:', historyError);
        } else if (distanceMoved > 0) {
          console.log(`Location history saved (moved ${distanceMoved.toFixed(1)}m)`);
        }
      }
    } catch (err) {
      console.error('Error saving location:', err);
    }
  }, [user?.id, profile?.tenant_id, activeRouteId, activeHojaRutaId, movementThreshold]);

  // Handle position update (native)
  const handleNativePositionUpdate = useCallback((position: Position | null) => {
    if (!position) return;
    
    const newLocation: Location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      heading: position.coords.heading,
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
      speed: position.coords.speed,
      heading: position.coords.heading,
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
