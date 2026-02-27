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
  updateInterval?: number;
  enableHighAccuracy?: boolean;
  activeRouteId?: string | null;
  activeHojaRutaId?: string | null;
  movementThreshold?: number;
}

const MAX_ACCURACY_FOR_HISTORY = 50; // meters - discard imprecise points
const ACTIVE_ROUTE_INTERVAL = 10000; // 10s when route active
const DEFAULT_INTERVAL = 15000; // 15s default
const MIN_MOVEMENT_ACTIVE = 3; // 3m minimum movement with active route
const MIN_MOVEMENT_DEFAULT = 5; // 5m minimum movement default

// Calculate distance between two coordinates in meters (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
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
    updateInterval, 
    enableHighAccuracy = true,
    activeRouteId = null,
    activeHojaRutaId = null,
    movementThreshold = 50,
  } = options;
  
  const hasActiveRoute = !!(activeRouteId || activeHojaRutaId);
  
  // Dynamic interval: 10s with active route, 15s otherwise
  const effectiveInterval = updateInterval ?? (hasActiveRoute ? ACTIVE_ROUTE_INTERVAL : DEFAULT_INTERVAL);
  const minMovement = hasActiveRoute ? MIN_MOVEMENT_ACTIVE : MIN_MOVEMENT_DEFAULT;
  
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
      // Always update current location (even if imprecise - useful for "last seen")
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

      // FILTER: Do NOT save to history if accuracy > 50m
      if (loc.accuracy > MAX_ACCURACY_FOR_HISTORY) {
        console.log(`Skipping history: accuracy ${loc.accuracy.toFixed(0)}m > ${MAX_ACCURACY_FOR_HISTORY}m`);
        return;
      }

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
      // Regular interval save but only if we've moved at least minMovement
      else if (timeSinceLastHistory >= effectiveInterval && distanceMoved >= minMovement) {
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
          console.log(`Location history saved (moved ${distanceMoved.toFixed(1)}m, accuracy ${loc.accuracy.toFixed(0)}m)`);
        }
      }
    } catch (err) {
      console.error('Error saving location:', err);
    }
  }, [user?.id, profile?.tenant_id, activeRouteId, activeHojaRutaId, movementThreshold, effectiveInterval, minMovement]);

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

    const now = Date.now();
    if (now - lastUpdateRef.current >= effectiveInterval) {
      lastUpdateRef.current = now;
      updateLocationToSupabase(newLocation);
    }
  }, [effectiveInterval, updateLocationToSupabase]);

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

    const now = Date.now();
    if (now - lastUpdateRef.current >= effectiveInterval) {
      lastUpdateRef.current = now;
      updateLocationToSupabase(newLocation);
    }
  }, [effectiveInterval, updateLocationToSupabase]);

  // Handle position error
  const handlePositionError = useCallback((err: GeolocationPositionError | any) => {
    const code = err?.code || 0;
    switch (code) {
      case 1:
        setError('Permiso de ubicación denegado');
        break;
      case 2:
        setError('Ubicación no disponible');
        break;
      case 3:
        setError('Tiempo de espera agotado');
        break;
      default:
        setError(err?.message || 'Error desconocido de ubicación');
    }
  }, []);

  // Start tracking (native)
  const startNativeTracking = useCallback(async () => {
    try {
      const permStatus = await Geolocation.requestPermissions();
      
      if (permStatus.location !== 'granted') {
        setError('Permiso de ubicación denegado');
        return;
      }

      setIsTracking(true);
      
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy,
        timeout: 10000,
      });
      handleNativePositionUpdate(position);

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
    
    navigator.geolocation.getCurrentPosition(
      handleWebPositionUpdate,
      handlePositionError,
      { enableHighAccuracy, timeout: 10000, maximumAge: 0 }
    );

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
