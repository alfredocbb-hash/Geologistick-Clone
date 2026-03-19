import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { startOfDay, endOfDay } from 'date-fns';
import type { ReportsFilters } from './useReportsData';

export interface CostoChofer {
  chofer_id: string;
  chofer_nombre: string;
  km_totales: number;
  entregas: number;
  combustible_estimado: number;
  costo_por_entrega: number;
  costo_por_km: number;
}

export interface CostosResumen {
  km_totales: number;
  combustible_total: number;
  costo_promedio_entrega: number;
  total_entregas: number;
  por_chofer: CostoChofer[];
}

const CONSUMO_L_POR_100KM = 12;
const PRECIO_LITRO = 1200; // ARS default

export function useCostosData(filters: ReportsFilters) {
  const { tenantId } = useTenant();
  const from = startOfDay(filters.dateFrom).toISOString();
  const to = endOfDay(filters.dateTo).toISOString();

  return useQuery({
    queryKey: ['reports-costos', tenantId, from, to, filters.sucursalId],
    queryFn: async (): Promise<CostosResumen> => {
      // Get completed routes with distance data
      let query = supabase
        .from('rutas_planificadas')
        .select('id, chofer_id, distancia_total_km')
        .eq('tenant_id', tenantId!)
        .gte('created_at', from)
        .lte('created_at', to)
        .not('chofer_id', 'is', null);

      const { data: rutas, error } = await query;
      if (error) throw error;

      // Get envios for delivery count per driver
      let envQuery = supabase
        .from('envios')
        .select('id, chofer_id, estado, distancia_km')
        .eq('tenant_id', tenantId!)
        .eq('estado', 'entregado')
        .gte('created_at', from)
        .lte('created_at', to)
        .not('chofer_id', 'is', null);

      if (filters.sucursalId) {
        envQuery = envQuery.eq('sucursal_origen_id', filters.sucursalId);
      }

      const { data: envios, error: envError } = await envQuery;
      if (envError) throw envError;

      const choferIds = [...new Set([
        ...(rutas || []).map(r => r.chofer_id!),
        ...(envios || []).map(e => e.chofer_id!),
      ])];

      if (choferIds.length === 0) {
        return { km_totales: 0, combustible_total: 0, costo_promedio_entrega: 0, total_entregas: 0, por_chofer: [] };
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nombre, apellido')
        .in('user_id', choferIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre']));

      // Aggregate km from rutas and envio distances
      const choferData = new Map<string, { km: number; entregas: number }>();

      for (const ruta of rutas || []) {
        const cid = ruta.chofer_id!;
        if (!choferData.has(cid)) choferData.set(cid, { km: 0, entregas: 0 });
        choferData.get(cid)!.km += ruta.distancia_total_km || 0;
      }

      for (const envio of envios || []) {
        const cid = envio.chofer_id!;
        if (!choferData.has(cid)) choferData.set(cid, { km: 0, entregas: 0 });
        const d = choferData.get(cid)!;
        d.entregas++;
        // If no route distance, use envio distance as fallback
        if (!d.km && envio.distancia_km) {
          d.km += envio.distancia_km;
        }
      }

      let kmTotales = 0;
      const porChofer: CostoChofer[] = [];

      for (const [id, data] of choferData) {
        const combustible = (data.km / 100) * CONSUMO_L_POR_100KM * PRECIO_LITRO;
        const costoPorEntrega = data.entregas > 0 ? Math.round(combustible / data.entregas) : 0;
        const costoPorKm = data.km > 0 ? Math.round((combustible / data.km) * 10) / 10 : 0;
        kmTotales += data.km;

        porChofer.push({
          chofer_id: id,
          chofer_nombre: profileMap.get(id) || 'Sin nombre',
          km_totales: Math.round(data.km * 10) / 10,
          entregas: data.entregas,
          combustible_estimado: Math.round(combustible),
          costo_por_entrega: costoPorEntrega,
          costo_por_km: costoPorKm,
        });
      }

      porChofer.sort((a, b) => b.entregas - a.entregas);

      const combustibleTotal = (kmTotales / 100) * CONSUMO_L_POR_100KM * PRECIO_LITRO;
      const totalEntregas = porChofer.reduce((s, c) => s + c.entregas, 0);

      return {
        km_totales: Math.round(kmTotales * 10) / 10,
        combustible_total: Math.round(combustibleTotal),
        costo_promedio_entrega: totalEntregas > 0 ? Math.round(combustibleTotal / totalEntregas) : 0,
        total_entregas: totalEntregas,
        por_chofer: porChofer,
      };
    },
    enabled: !!tenantId,
  });
}
