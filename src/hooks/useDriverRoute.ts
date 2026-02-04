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

interface UseDriverRouteReturn {
  rawHistory: LocationHistoryPoint[];
  snappedRoute: SnappedPoint[];
  isLoading: boolean;
  isSnapping: boolean;
  error: string | null;
  loadRoute: (driverId: string, rutaId: string) => Promise<void>;
  clearRoute: () => void;
  polylinePath: SnappedPoint[];
  routeStats: {
    pointsCount: number;
    snappedPointsCount: number;
    startTime: string | null;
    endTime: string | null;
  };
}

export function useDriverRoute(): UseDriverRouteReturn {
  const [rawHistory, setRawHistory] = useState<LocationHistoryPoint[]>([]);
  const [snappedRoute, setSnappedRoute] = useState<SnappedPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoute = useCallback(async (driverId: string, rutaId: string) => {
    setIsLoading(true);
    setIsSnapping(false);
    setError(null);
    setSnappedRoute([]);
    setRawHistory([]);

    try {
      // Fetch location history for the route
      const { data: history, error: historyError } = await supabase
        .from('driver_location_history')
        .select('lat, lng, recorded_at, speed')
        .eq('chofer_id', driverId)
        .eq('ruta_id', rutaId)
        .order('recorded_at', { ascending: true });

      if (historyError) throw historyError;

      const formattedHistory = history?.map(h => ({
        lat: Number(h.lat),
        lng: Number(h.lng),
        recorded_at: h.recorded_at || '',
        speed: h.speed ? Number(h.speed) : null,
      })) || [];

      setRawHistory(formattedHistory);

      // Process with Snap to Roads if we have enough points
      if (formattedHistory.length >= 2) {
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
            setSnappedRoute(snappedData.snappedPoints.map((p: { lat: number; lng: number }) => ({
              lat: p.lat,
              lng: p.lng
            })));
            console.log(`Route snapped: ${formattedHistory.length} → ${snappedData.snappedPoints.length} points`);
          }
        } catch (snapErr) {
          console.error('Failed to snap route:', snapErr);
          setError('Error al conectar con Roads API');
        } finally {
          setIsSnapping(false);
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

  const clearRoute = useCallback(() => {
    setRawHistory([]);
    setSnappedRoute([]);
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
  const routeStats = useMemo(() => ({
    pointsCount: rawHistory.length,
    snappedPointsCount: snappedRoute.length,
    startTime: rawHistory.length > 0 ? rawHistory[0].recorded_at : null,
    endTime: rawHistory.length > 0 ? rawHistory[rawHistory.length - 1].recorded_at : null,
  }), [rawHistory, snappedRoute]);

  return {
    rawHistory,
    snappedRoute,
    isLoading,
    isSnapping,
    error,
    loadRoute,
    clearRoute,
    polylinePath,
    routeStats,
  };
}
