import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RouteProgress {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  percentage: number;
}

export interface DriverEnhancedData {
  choferId: string;
  routeProgress: RouteProgress | null;
  speed: number | null;
  lastMovedAt: string | null;
  idleMinutes: number;
  phone: string | null;
  avatarUrl: string | null;
}

export function useDriverRouteProgress(driverIds: string[], activeRoutes: Record<string, string>) {
  return useQuery({
    queryKey: ['driver-route-progress', driverIds.join(','), JSON.stringify(activeRoutes)],
    queryFn: async () => {
      if (driverIds.length === 0) return {};

      const result: Record<string, DriverEnhancedData> = {};

      // 1. Fetch route progress for drivers with active routes
      const driversWithRoutes = driverIds.filter(id => activeRoutes[id]);
      
      if (driversWithRoutes.length > 0) {
        const routeIds = driversWithRoutes.map(id => activeRoutes[id]);
        
        const { data: paradas } = await supabase
          .from('ruta_paradas')
          .select('ruta_id, estado')
          .in('ruta_id', routeIds);

        const progressByRoute: Record<string, RouteProgress> = {};
        if (paradas) {
          for (const p of paradas) {
            if (!p.ruta_id) continue;
            if (!progressByRoute[p.ruta_id]) {
              progressByRoute[p.ruta_id] = { total: 0, completed: 0, pending: 0, failed: 0, percentage: 0 };
            }
            const prog = progressByRoute[p.ruta_id];
            prog.total++;
            if (p.estado === 'completada') prog.completed++;
            else if (p.estado === 'fallida' || p.estado === 'reprogramado') prog.failed++;
            else prog.pending++;
          }
          for (const key of Object.keys(progressByRoute)) {
            const p = progressByRoute[key];
            p.percentage = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
          }
        }

        for (const driverId of driversWithRoutes) {
          const routeId = activeRoutes[driverId];
          if (!result[driverId]) {
            result[driverId] = { choferId: driverId, routeProgress: null, speed: null, lastMovedAt: null, idleMinutes: 0, phone: null, avatarUrl: null };
          }
          result[driverId].routeProgress = progressByRoute[routeId] || null;
        }
      }

      // 2. Fetch latest speed from driver_location_history (last record per driver)
      for (const driverId of driverIds) {
        if (!result[driverId]) {
          result[driverId] = { choferId: driverId, routeProgress: null, speed: null, lastMovedAt: null, idleMinutes: 0, phone: null, avatarUrl: null };
        }

        const { data: lastLoc } = await supabase
          .from('driver_location_history')
          .select('speed, recorded_at, lat, lng')
          .eq('chofer_id', driverId)
          .order('recorded_at', { ascending: false })
          .limit(5);

        if (lastLoc && lastLoc.length > 0) {
          const latestSpeed = lastLoc[0].speed ? Number(lastLoc[0].speed) : 0;
          result[driverId].speed = latestSpeed;

          // Detect idle: check if position hasn't changed in recent points
          if (lastLoc.length >= 2) {
            const latest = lastLoc[0];
            let lastMoveIdx = 0;
            for (let i = 1; i < lastLoc.length; i++) {
              const dist = Math.abs(Number(latest.lat) - Number(lastLoc[i].lat)) + Math.abs(Number(latest.lng) - Number(lastLoc[i].lng));
              if (dist > 0.0002) { // ~20m threshold
                lastMoveIdx = i;
                break;
              }
            }
            if (lastMoveIdx === 0 && latestSpeed < 2) {
              // Driver hasn't moved
              const oldestSamePos = lastLoc[lastLoc.length - 1];
              result[driverId].lastMovedAt = oldestSamePos.recorded_at;
              const idleSince = new Date(oldestSamePos.recorded_at || '').getTime();
              result[driverId].idleMinutes = Math.round((Date.now() - idleSince) / (1000 * 60));
            }
          }
        }
      }

      // 3. Fetch phone numbers from profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, telefono, avatar_url')
        .in('user_id', driverIds);

      if (profiles) {
        for (const p of profiles) {
          if (result[p.user_id]) {
            result[p.user_id].phone = p.telefono || null;
            result[p.user_id].avatarUrl = p.avatar_url || null;
          }
        }
      }

      return result;
    },
    refetchInterval: 30000,
    enabled: driverIds.length > 0,
  });
}
