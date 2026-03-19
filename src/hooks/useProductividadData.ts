import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { startOfDay, endOfDay } from 'date-fns';
import type { ReportsFilters } from './useReportsData';

export interface ProductividadChofer {
  chofer_id: string;
  chofer_nombre: string;
  total: number;
  entregados: number;
  efectividad: number;
  horas_reparto: number;
  entregas_por_hora: number;
  tiempo_promedio_minutos: number | null;
}

export function useProductividadData(filters: ReportsFilters) {
  const { tenantId } = useTenant();
  const from = startOfDay(filters.dateFrom).toISOString();
  const to = endOfDay(filters.dateTo).toISOString();

  return useQuery({
    queryKey: ['reports-productividad', tenantId, from, to, filters.sucursalId],
    queryFn: async (): Promise<ProductividadChofer[]> => {
      let query = supabase
        .from('envios')
        .select('id, estado, chofer_id')
        .eq('tenant_id', tenantId!)
        .gte('created_at', from)
        .lte('created_at', to)
        .not('chofer_id', 'is', null);

      if (filters.sucursalId) {
        query = query.eq('sucursal_origen_id', filters.sucursalId);
      }

      const { data: enviosData, error } = await query;
      if (error) throw error;

      const choferIds = [...new Set((enviosData || []).map(e => e.chofer_id).filter(Boolean))] as string[];
      if (choferIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, nombre, apellido')
        .in('user_id', choferIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre']));

      const entregadoIds = (enviosData || []).filter(e => e.estado === 'entregado').map(e => e.id);
      const envioChoferMap = new Map((enviosData || []).map(e => [e.id, e.chofer_id!]));

      // Time calculations
      const choferTiempos = new Map<string, number[]>();

      if (entregadoIds.length > 0) {
        const { data: historial } = await supabase
          .from('envio_historial')
          .select('envio_id, estado_nuevo, created_at')
          .in('envio_id', entregadoIds.slice(0, 500))
          .in('estado_nuevo', ['en_reparto', 'entregado']);

        const historialByEnvio = new Map<string, { en_reparto?: string; entregado?: string }>();
        for (const h of historial || []) {
          if (!historialByEnvio.has(h.envio_id)) historialByEnvio.set(h.envio_id, {});
          const entry = historialByEnvio.get(h.envio_id)!;
          if (h.estado_nuevo === 'en_reparto' && !entry.en_reparto) entry.en_reparto = h.created_at!;
          if (h.estado_nuevo === 'entregado') entry.entregado = h.created_at!;
        }

        for (const [envioId, times] of historialByEnvio) {
          if (times.en_reparto && times.entregado) {
            const diff = (new Date(times.entregado).getTime() - new Date(times.en_reparto).getTime()) / 60000;
            if (diff > 0 && diff < 1440) {
              const choferId = envioChoferMap.get(envioId);
              if (choferId) {
                if (!choferTiempos.has(choferId)) choferTiempos.set(choferId, []);
                choferTiempos.get(choferId)!.push(diff);
              }
            }
          }
        }
      }

      // Aggregate
      const grouped = new Map<string, { total: number; entregados: number }>();
      for (const envio of enviosData || []) {
        const cid = envio.chofer_id!;
        if (!grouped.has(cid)) grouped.set(cid, { total: 0, entregados: 0 });
        const g = grouped.get(cid)!;
        g.total++;
        if (envio.estado === 'entregado') g.entregados++;
      }

      return Array.from(grouped.entries()).map(([id, v]) => {
        const tiempos = choferTiempos.get(id) || [];
        const totalMinutos = tiempos.reduce((a, b) => a + b, 0);
        const horasReparto = totalMinutos / 60;
        const tiempoPromedio = tiempos.length > 0 ? Math.round(totalMinutos / tiempos.length) : null;
        const entregasPorHora = horasReparto > 0 ? Math.round((v.entregados / horasReparto) * 10) / 10 : 0;

        return {
          chofer_id: id,
          chofer_nombre: profileMap.get(id) || 'Sin nombre',
          total: v.total,
          entregados: v.entregados,
          efectividad: v.total > 0 ? Math.round((v.entregados / v.total) * 100) : 0,
          horas_reparto: Math.round(horasReparto * 10) / 10,
          entregas_por_hora: entregasPorHora,
          tiempo_promedio_minutos: tiempoPromedio,
        };
      }).sort((a, b) => b.entregas_por_hora - a.entregas_por_hora);
    },
    enabled: !!tenantId,
  });
}
