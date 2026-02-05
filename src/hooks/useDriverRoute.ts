import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LocationHistoryPoint {
  lat: number;
  lng: number;
  recorded_at: string;
  speed?: number | null;
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
  
  // Hash based on count + first point + last point
  const hashData = `${points.length}|${first.lat.toFixed(5)},${first.lng.toFixed(5)}|${last.lat.toFixed(5)},${last.lng.toFixed(5)}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < hashData.length; i++) {
    const char = hashData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

type RouteIdentifier = 
  | { type: 'ruta'; rutaId: string }
  | { type: 'hoja_ruta'; hojaRutaId: string };

export function useDriverRoute(): UseDriverRouteReturn {
  const [rawHistory, setRawHistory] = useState<LocationHistoryPoint[]>([]);
  const [snappedRoute, setSnappedRoute] = useState<SnappedPoint[]>([]);
  const [deliveryStops, setDeliveryStops] = useState<DeliveryStop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Internal function to load route by either ruta_id or hoja_ruta_id
  const loadRouteInternal = useCallback(async (driverId: string, identifier: RouteIdentifier) => {
    setIsLoading(true);
    setIsSnapping(false);
    setError(null);
    setSnappedRoute([]);
    setRawHistory([]);
    setDeliveryStops([]);

    const routeIdForCache = identifier.type === 'ruta' ? identifier.rutaId : identifier.hojaRutaId;

    try {
      // Build query based on identifier type
      let query = supabase
        .from('driver_location_history')
        .select('lat, lng, recorded_at, speed')
        .eq('chofer_id', driverId);
      
      if (identifier.type === 'ruta') {
        query = query.eq('ruta_id', identifier.rutaId);
      } else {
        query = query.eq('hoja_ruta_id', identifier.hojaRutaId);
      }
      
      const { data: history, error: historyError } = await query.order('recorded_at', { ascending: true });

      if (historyError) throw historyError;

      const formattedHistory = history?.map(h => ({
        lat: Number(h.lat),
        lng: Number(h.lng),
        recorded_at: h.recorded_at || '',
        speed: h.speed ? Number(h.speed) : null,
      })) || [];

      setRawHistory(formattedHistory);

      // Fetch delivery stops (completed deliveries) for this route
      // For hoja_ruta, we need to get envios linked to it
      let deliveriesQuery;
      if (identifier.type === 'hoja_ruta') {
        // Get envios from hoja_ruta_envios junction table
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
        // For ruta_id: get envio_ids from ruta_paradas junction table
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
        
        // Check cache first (only for ruta_id since that's the cache key)
        const { data: cachedSegment } = await supabase
          .from('driver_route_segments')
          .select('snapped_points, total_distance')
          .eq('ruta_id', routeIdForCache)
          .eq('chofer_id', driverId)
          .eq('points_hash', pointsHash)
          .maybeSingle();

        if (cachedSegment?.snapped_points) {
          // Use cached data
          const cachedPoints = cachedSegment.snapped_points as { lat: number; lng: number }[];
          setSnappedRoute(cachedPoints);
          console.log(`Cache hit: ${formattedHistory.length} → ${cachedPoints.length} points`);
        } else {
          // Call snap-to-roads API
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
              console.log(`Route snapped: ${formattedHistory.length} → ${snappedPoints.length} points`);

              // Save to cache (get user's tenant_id first)
              try {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('tenant_id')
                  .eq('user_id', driverId)
                  .single();

                if (profile?.tenant_id) {
                  const totalDistance = calculateTotalDistance(snappedPoints) * 1000; // Convert to meters
                  
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
                // Non-blocking error - continue with the snapped route
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
    } catch (err) {
      console.error('Error loading route history:', err);
      setError('Error cargando historial de ubicación');
      setRawHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Public function to load by ruta_id
  const loadRoute = useCallback(async (driverId: string, rutaId: string) => {
    return loadRouteInternal(driverId, { type: 'ruta', rutaId });
  }, [loadRouteInternal]);

  // Public function to load by hoja_ruta_id
  const loadRouteByHojaRuta = useCallback(async (driverId: string, hojaRutaId: string) => {
    return loadRouteInternal(driverId, { type: 'hoja_ruta', hojaRutaId });
  }, [loadRouteInternal]);

  const clearRoute = useCallback(() => {
    setRawHistory([]);
    setSnappedRoute([]);
    setDeliveryStops([]);
    setError(null);
    setIsLoading(false);
    setIsSnapping(false);
  }, []);

  // Use snapped route if available, otherwise raw points
  const polylinePath = useMemo(() => {
    if (snappedRoute.length > 0) {
      return snappedRoute;
    }
    return rawHistory.map(point => ({ lat: point.lat, lng: point.lng }));
  }, [rawHistory, snappedRoute]);

  // Route statistics
  const routeStats = useMemo(() => {
    const pointsCount = rawHistory.length;
    const snappedPointsCount = snappedRoute.length;
    const startTime = rawHistory.length > 0 ? rawHistory[0].recorded_at : null;
    const endTime = rawHistory.length > 0 ? rawHistory[rawHistory.length - 1].recorded_at : null;
    
    // Calculate distance from the path we're using
    const pathToUse = snappedRoute.length > 0 ? snappedRoute : rawHistory.map(p => ({ lat: p.lat, lng: p.lng }));
    const totalDistanceKm = calculateTotalDistance(pathToUse);
    
    // Calculate duration
    let durationMinutes = 0;
    if (startTime && endTime) {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      durationMinutes = Math.round((end - start) / (1000 * 60));
    }
    
    // Calculate average speed
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
    routeStats,
  };
}
