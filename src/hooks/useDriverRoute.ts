import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchDirectionsPath } from '@/lib/fetchDirectionsPath';

interface LocationHistoryPoint {
  lat: number;
  lng: number;
  recorded_at: string;
  speed?: number | null;
  accuracy?: number | null;
}

interface SnappedPoint {
  lat: number;
  lng: number;
}

interface DeliveryStop {
  position: { lat: number; lng: number };
  time: string;
  trackingNumber: string;
  order: number;
}

interface SignalGap {
  fromIndex: number;
  toIndex: number;
  durationMinutes: number;
}

interface UseDriverRouteReturn {
  rawHistory: LocationHistoryPoint[];
  snappedRoute: SnappedPoint[];
  deliveryStops: DeliveryStop[];
  isLoading: boolean;
  isSnapping: boolean;
  error: string | null;
  loadRoute: (driverId: string, rutaId: string) => Promise<void>;
  loadRouteByHojaRuta: (driverId: string, hojaRutaId: string) => Promise<void>;
  clearRoute: () => void;
  polylinePath: SnappedPoint[];
  hasSignalGaps: boolean;
  signalGaps: SignalGap[];
  routeStats: {
    pointsCount: number;
    snappedPointsCount: number;
    startTime: string | null;
    endTime: string | null;
    totalDistanceKm: number;
    durationMinutes: number;
    avgSpeedKmh: number;
    stopsCount: number;
  };
}

const MAX_ACCURACY_METERS = 50;
const SIGNAL_GAP_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

// Calculate distance between two points using Haversine formula
function calculateHaversineDistance(
  lat1: number, lng1: number, 
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate total distance for a path
function calculateTotalDistance(points: SnappedPoint[]): number {
  if (points.length < 2) return 0;
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistance += calculateHaversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng
    );
  }
  return totalDistance;
}

// Generate a simple hash for cache lookup
function generatePointsHash(points: { lat: number; lng: number }[]): string {
  if (points.length === 0) return 'empty';
  const first = points[0];
  const last = points[points.length - 1];
  const hashData = `${points.length}|${first.lat.toFixed(5)},${first.lng.toFixed(5)}|${last.lat.toFixed(5)},${last.lng.toFixed(5)}`;
  let hash = 0;
  for (let i = 0; i < hashData.length; i++) {
    const char = hashData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Detect signal gaps (>15 min between consecutive points)
function detectSignalGaps(history: LocationHistoryPoint[]): SignalGap[] {
  const gaps: SignalGap[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = new Date(history[i - 1].recorded_at).getTime();
    const curr = new Date(history[i].recorded_at).getTime();
    const diff = curr - prev;
    if (diff >= SIGNAL_GAP_THRESHOLD_MS) {
      gaps.push({
        fromIndex: i - 1,
        toIndex: i,
        durationMinutes: Math.round(diff / (1000 * 60)),
      });
    }
  }
  return gaps;
}

type RouteIdentifier = 
  | { type: 'ruta'; rutaId: string }
  | { type: 'hoja_ruta'; hojaRutaId: string };

// In-memory cache to avoid redundant snap-to-roads calls
const snappedRouteCache = new Map<string, SnappedPoint[]>();

export function useDriverRoute(): UseDriverRouteReturn {
  const [rawHistory, setRawHistory] = useState<LocationHistoryPoint[]>([]);
  const [snappedRoute, setSnappedRoute] = useState<SnappedPoint[]>([]);
  const [directionsRoute, setDirectionsRoute] = useState<SnappedPoint[]>([]);
  const [deliveryStops, setDeliveryStops] = useState<DeliveryStop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signalGaps, setSignalGaps] = useState<SignalGap[]>([]);

  // Internal function to load route by either ruta_id or hoja_ruta_id
  const loadRouteInternal = useCallback(async (driverId: string, identifier: RouteIdentifier) => {
    setIsLoading(true);
    setIsSnapping(false);
    setError(null);
    setSnappedRoute([]);
    setDirectionsRoute([]);
    setRawHistory([]);
    setDeliveryStops([]);
    setSignalGaps([]);

    const routeIdForCache = identifier.type === 'ruta' ? identifier.rutaId : identifier.hojaRutaId;

    try {
      // Build query - include accuracy for filtering
      let query = supabase
        .from('driver_location_history')
        .select('lat, lng, recorded_at, speed, accuracy')
        .eq('chofer_id', driverId);
      
      if (identifier.type === 'ruta') {
        query = query.eq('ruta_id', identifier.rutaId);
      } else {
        query = query.eq('hoja_ruta_id', identifier.hojaRutaId);
      }
      
      const { data: history, error: historyError } = await query.order('recorded_at', { ascending: true });

      if (historyError) throw historyError;

      // Filter out imprecise points (accuracy > 50m)
      const formattedHistory = (history || [])
        .filter(h => {
          const acc = h.accuracy ? Number(h.accuracy) : 0;
          return acc === 0 || acc <= MAX_ACCURACY_METERS;
        })
        .map(h => ({
          lat: Number(h.lat),
          lng: Number(h.lng),
          recorded_at: h.recorded_at || '',
          speed: h.speed ? Number(h.speed) : null,
          accuracy: h.accuracy ? Number(h.accuracy) : null,
        }));

      setRawHistory(formattedHistory);

      // Detect signal gaps
      const gaps = detectSignalGaps(formattedHistory);
      setSignalGaps(gaps);
      if (gaps.length > 0) {
        console.log(`Detected ${gaps.length} signal gap(s) in route`);
      }

      // Fetch delivery stops
      // ... keep existing code (delivery stops fetching logic)
      let deliveriesQuery;
      if (identifier.type === 'hoja_ruta') {
        const { data: hojaEnvios } = await supabase
          .from('hoja_ruta_envios')
          .select('envio_id')
          .eq('hoja_ruta_id', identifier.hojaRutaId);
        
        const envioIds = hojaEnvios?.map(e => e.envio_id) || [];
        
        if (envioIds.length > 0) {
          deliveriesQuery = await supabase
            .from('envios')
            .select('tracking_number, entrega_lat, entrega_lng, fecha_entrega')
            .in('id', envioIds)
            .eq('estado', 'entregado')
            .not('entrega_lat', 'is', null)
            .not('entrega_lng', 'is', null)
            .not('fecha_entrega', 'is', null)
            .order('fecha_entrega', { ascending: true });
        }
      } else {
        const { data: rutaParadas } = await supabase
          .from('ruta_paradas')
          .select('envio_id')
          .eq('ruta_id', identifier.rutaId);
        
        const envioIds = rutaParadas?.map(p => p.envio_id).filter(Boolean) || [];
        
        if (envioIds.length > 0) {
          deliveriesQuery = await supabase
            .from('envios')
            .select('tracking_number, entrega_lat, entrega_lng, fecha_entrega')
            .in('id', envioIds)
            .eq('estado', 'entregado')
            .not('entrega_lat', 'is', null)
            .not('entrega_lng', 'is', null)
            .not('fecha_entrega', 'is', null)
            .order('fecha_entrega', { ascending: true });
        }
      }
      
      const deliveries = deliveriesQuery?.data;

      if (deliveries && deliveries.length > 0) {
        const stops: DeliveryStop[] = deliveries.map((d, idx) => ({
          position: { lat: Number(d.entrega_lat), lng: Number(d.entrega_lng) },
          time: d.fecha_entrega || '',
          trackingNumber: d.tracking_number,
          order: idx + 1,
        }));
        setDeliveryStops(stops);
      }

      // Process with Snap to Roads if we have enough points
      if (formattedHistory.length >= 2) {
        const pointsHash = generatePointsHash(formattedHistory);
        const memoryCacheKey = `${routeIdForCache}_${driverId}_${pointsHash}`;

        // Check in-memory cache first
        const memoryCached = snappedRouteCache.get(memoryCacheKey);
        if (memoryCached) {
          setSnappedRoute(memoryCached);
          console.log(`Memory cache hit: ${formattedHistory.length} → ${memoryCached.length} points`);
        } else {
          // Check DB cache
          const { data: cachedSegment } = await supabase
            .from('driver_route_segments')
            .select('snapped_points, total_distance')
            .eq('ruta_id', routeIdForCache)
            .eq('chofer_id', driverId)
            .eq('points_hash', pointsHash)
            .maybeSingle();

          if (cachedSegment?.snapped_points) {
            const cachedPoints = cachedSegment.snapped_points as { lat: number; lng: number }[];
            setSnappedRoute(cachedPoints);
            snappedRouteCache.set(memoryCacheKey, cachedPoints);
            console.log(`DB cache hit: ${formattedHistory.length} → ${cachedPoints.length} points`);
          } else {
            // Call snap-to-roads API with interpolate: true
            setIsSnapping(true);
            try {
              const { data: snappedData, error: snapError } = await supabase.functions.invoke('snap-to-roads', {
                body: {
                  points: formattedHistory.map(p => ({ lat: p.lat, lng: p.lng })),
                  interpolate: true
                }
              });

              if (snapError) {
                console.error('Snap to roads error:', snapError);
                setError('Error procesando ruta con calles');
              } else if (snappedData?.snappedPoints && snappedData.snappedPoints.length > 0) {
                const snappedPoints = snappedData.snappedPoints.map((p: { lat: number; lng: number }) => ({
                  lat: p.lat,
                  lng: p.lng
                }));
                setSnappedRoute(snappedPoints);
                snappedRouteCache.set(memoryCacheKey, snappedPoints);
                console.log(`Route snapped: ${formattedHistory.length} → ${snappedPoints.length} points`);

                // Save to DB cache
                try {
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('tenant_id')
                    .eq('user_id', driverId)
                    .single();

                  if (profile?.tenant_id) {
                    const totalDistance = calculateTotalDistance(snappedPoints) * 1000;
                    
                    await supabase
                      .from('driver_route_segments')
                      .upsert({
                        ruta_id: routeIdForCache,
                        chofer_id: driverId,
                        tenant_id: profile.tenant_id,
                        points_hash: pointsHash,
                        raw_points: formattedHistory.map(p => ({ lat: p.lat, lng: p.lng })),
                        snapped_points: snappedPoints,
                        total_distance: totalDistance,
                      }, {
                        onConflict: 'ruta_id,chofer_id,points_hash'
                      });
                    console.log('Route segment cached successfully');
                  }
                } catch (cacheErr) {
                  console.warn('Failed to cache route segment:', cacheErr);
                }
              }
            } catch (snapErr) {
              console.error('Failed to snap route:', snapErr);
              setError('Error al conectar con Roads API');
            } finally {
              setIsSnapping(false);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error loading route history:', err);
      setError('Error cargando historial de ubicación');
      setRawHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadRoute = useCallback(async (driverId: string, rutaId: string) => {
    return loadRouteInternal(driverId, { type: 'ruta', rutaId });
  }, [loadRouteInternal]);

  const loadRouteByHojaRuta = useCallback(async (driverId: string, hojaRutaId: string) => {
    return loadRouteInternal(driverId, { type: 'hoja_ruta', hojaRutaId });
  }, [loadRouteInternal]);

  const clearRoute = useCallback(() => {
    setRawHistory([]);
    setSnappedRoute([]);
    setDirectionsRoute([]);
    setDeliveryStops([]);
    setSignalGaps([]);
    setError(null);
    setIsLoading(false);
    setIsSnapping(false);
  }, []);

  // After snap/raw data is ready, generate street-level path via Directions API
  const basePoints = useMemo(() => {
    if (snappedRoute.length > 0) return snappedRoute;
    if (rawHistory.length >= 2) return rawHistory.map(p => ({ lat: p.lat, lng: p.lng }));
    return [];
  }, [snappedRoute, rawHistory]);

  // Trigger Directions API when base points change
  useEffect(() => {
    if (basePoints.length < 2 || !window.google?.maps) {
      setDirectionsRoute([]);
      return;
    }
    
    let cancelled = false;
    fetchDirectionsPath(basePoints).then(path => {
      if (!cancelled && path.length > 0) {
        setDirectionsRoute(path);
        console.log(`Directions route: ${basePoints.length} → ${path.length} points`);
      }
    }).catch(err => {
      console.warn('Directions API failed, falling back to snapped/raw:', err);
    });
    
    return () => { cancelled = true; };
  }, [basePoints]);

  // Priority: directionsRoute > snappedRoute > rawHistory
  const polylinePath = useMemo(() => {
    if (directionsRoute.length > 0) return directionsRoute;
    if (snappedRoute.length > 0) return snappedRoute;
    return rawHistory.map(point => ({ lat: point.lat, lng: point.lng }));
  }, [rawHistory, snappedRoute, directionsRoute]);

  const hasSignalGaps = signalGaps.length > 0;

  // Route statistics
  const routeStats = useMemo(() => {
    const pointsCount = rawHistory.length;
    const snappedPointsCount = snappedRoute.length;
    const startTime = rawHistory.length > 0 ? rawHistory[0].recorded_at : null;
    const endTime = rawHistory.length > 0 ? rawHistory[rawHistory.length - 1].recorded_at : null;
    
    const pathToUse = snappedRoute.length > 0 ? snappedRoute : rawHistory.map(p => ({ lat: p.lat, lng: p.lng }));
    const totalDistanceKm = calculateTotalDistance(pathToUse);
    
    let durationMinutes = 0;
    if (startTime && endTime) {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      durationMinutes = Math.round((end - start) / (1000 * 60));
    }
    
    const avgSpeedKmh = durationMinutes > 0 
      ? Math.round((totalDistanceKm / (durationMinutes / 60)) * 10) / 10
      : 0;
    
    return {
      pointsCount,
      snappedPointsCount,
      startTime,
      endTime,
      totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
      durationMinutes,
      avgSpeedKmh,
      stopsCount: deliveryStops.length,
    };
  }, [rawHistory, snappedRoute, deliveryStops]);

  return {
    rawHistory,
    snappedRoute,
    deliveryStops,
    isLoading,
    isSnapping,
    error,
    loadRoute,
    loadRouteByHojaRuta,
    clearRoute,
    polylinePath,
    hasSignalGaps,
    signalGaps,
    routeStats,
  };
}
