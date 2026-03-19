import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { startOfDay, endOfDay, differenceInMinutes } from 'date-fns';

export interface ProductividadChofer {
  chofer_id: string;
  chofer_nombre: string;
  total: number;
  entregados: number;
  tasa_exito: number;
  entregas_por_hora: number;
  tiempo_promedio_min: number | null;
}

export function useProductividadData(filters: { dateFrom: Date; dateTo: Date; sucursalId?: string }) {
  const { tenantId } = useTenant();
  const from = startOfDay(filters.dateFrom).toISOString();
  const to = endOfDay(filters.dateTo).toISOString();

  return useQuery({
    queryKey: ['productividad', tenantId, from, to, filters.sucursalId],
    queryFn: async (): Promise<ProductividadChofer[]> => {
      let query = supabase
        .from('envios')
        .select('id, estado, chofer_id, created_at, fecha_entrega, profiles!envios_chofer_id_fkey(nombre, apellido)')
        .eq('tenant_id', tenantId!)
        .not('chofer_id', 'is', null)
        .gte('created_at', from)
        .lte('created_at', to);

      if (filters.sucursalId) {
        query = query.eq('sucursal_origen_id', filters.sucursalId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped = new Map<string, {
        nombre: string;
        total: number;
        entregados: number;
        tiempos: number[];
      }>();

      for (const envio of data || []) {
        const cid = envio.chofer_id!;
        const p = envio.profiles as any;
        const nombre = p ? `${p.nombre || ''} ${p.apellido || ''}`.trim() : 'Sin nombre';

        if (!grouped.has(cid)) {
          grouped.set(cid, { nombre, total: 0, entregados: 0, tiempos: [] });
        }
        const g = grouped.get(cid)!;
        g.total++;
        if (envio.estado === 'entregado') {
          g.entregados++;
          if (envio.created_at && envio.fecha_entrega) {
            const mins = differenceInMinutes(new Date(envio.fecha_entrega), new Date(envio.created_at));
            if (mins > 0 && mins < 14400) g.tiempos.push(mins);
          }
        }
      }

      // Assume 8-hour workday for entregas/hora
      const horasTrabajo = 8;

      return Array.from(grouped.entries())
        .map(([chofer_id, g]) => ({
          chofer_id,
          chofer_nombre: g.nombre,
          total: g.total,
          entregados: g.entregados,
          tasa_exito: g.total > 0 ? Math.round((g.entregados / g.total) * 100) : 0,
          entregas_por_hora: g.total > 0 ? Math.round((g.entregados / horasTrabajo) * 10) / 10 : 0,
          tiempo_promedio_min: g.tiempos.length > 0
            ? Math.round(g.tiempos.reduce((a, b) => a + b, 0) / g.tiempos.length)
            : null,
        }))
        .sort((a, b) => b.entregados - a.entregados);
    },
    enabled: !!tenantId,
  });
}
