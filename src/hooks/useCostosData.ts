import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { startOfDay, endOfDay } from 'date-fns';

export interface CostoRuta {
  ruta_id: string;
  ruta_nombre: string;
  total_envios: number;
  ingresos: number;
  distancia_km: number;
  costo_por_envio: number;
}

export interface ResumenCostos {
  totalEnvios: number;
  ingresosTotales: number;
  distanciaTotal: number;
  costoPromedioPorEnvio: number;
  ingresoPorKm: number;
}

export function useCostosData(filters: { dateFrom: Date; dateTo: Date; sucursalId?: string }) {
  const { tenantId } = useTenant();
  const from = startOfDay(filters.dateFrom).toISOString();
  const to = endOfDay(filters.dateTo).toISOString();

  const rutasQuery = useQuery({
    queryKey: ['costos-rutas', tenantId, from, to, filters.sucursalId],
    queryFn: async (): Promise<CostoRuta[]> => {
      let query = supabase
        .from('envios')
        .select('id, precio_total, distancia_km, sucursal_origen_id, sucursales!envios_sucursal_origen_id_fkey(nombre)')
        .eq('tenant_id', tenantId!)
        .gte('created_at', from)
        .lte('created_at', to);

      if (filters.sucursalId) {
        query = query.eq('sucursal_origen_id', filters.sucursalId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by sucursal as proxy for route
      const grouped = new Map<string, {
        nombre: string;
        total: number;
        ingresos: number;
        distancia: number;
      }>();

      for (const envio of data || []) {
        const sid = envio.sucursal_origen_id || 'sin_ruta';
        const nombre = (envio.sucursales as any)?.nombre || 'Sin ruta';
        if (!grouped.has(sid)) {
          grouped.set(sid, { nombre, total: 0, ingresos: 0, distancia: 0 });
        }
        const g = grouped.get(sid)!;
        g.total++;
        g.ingresos += Number(envio.precio_total) || 0;
        g.distancia += Number(envio.distancia_km) || 0;
      }

      return Array.from(grouped.entries()).map(([ruta_id, g]) => ({
        ruta_id,
        ruta_nombre: g.nombre,
        total_envios: g.total,
        ingresos: Math.round(g.ingresos),
        distancia_km: Math.round(g.distancia * 10) / 10,
        costo_por_envio: g.total > 0 ? Math.round(g.ingresos / g.total) : 0,
      })).sort((a, b) => b.ingresos - a.ingresos);
    },
    enabled: !!tenantId,
  });

  const resumenQuery = useQuery({
    queryKey: ['costos-resumen', tenantId, from, to, filters.sucursalId],
    queryFn: async (): Promise<ResumenCostos> => {
      let query = supabase
        .from('envios')
        .select('precio_total, distancia_km')
        .eq('tenant_id', tenantId!)
        .gte('created_at', from)
        .lte('created_at', to);

      if (filters.sucursalId) {
        query = query.eq('sucursal_origen_id', filters.sucursalId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalEnvios = data?.length || 0;
      const ingresosTotales = (data || []).reduce((s, e) => s + (Number(e.precio_total) || 0), 0);
      const distanciaTotal = (data || []).reduce((s, e) => s + (Number(e.distancia_km) || 0), 0);

      return {
        totalEnvios,
        ingresosTotales: Math.round(ingresosTotales),
        distanciaTotal: Math.round(distanciaTotal * 10) / 10,
        costoPromedioPorEnvio: totalEnvios > 0 ? Math.round(ingresosTotales / totalEnvios) : 0,
        ingresoPorKm: distanciaTotal > 0 ? Math.round(ingresosTotales / distanciaTotal) : 0,
      };
    },
    enabled: !!tenantId,
  });

  return { rutas: rutasQuery, resumen: resumenQuery };
}
