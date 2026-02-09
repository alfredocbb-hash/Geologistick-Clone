import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { startOfDay, endOfDay } from 'date-fns';

export interface ReportsFilters {
  dateFrom: Date;
  dateTo: Date;
  sucursalId?: string;
}

interface EnvioPorSucursal {
  sucursal_id: string;
  sucursal_nombre: string;
  total: number;
  entregados: number;
  pendientes: number;
  cancelados: number;
  efectividad: number;
}

interface Destino {
  ciudad: string;
  provincia: string;
  cantidad: number;
  ingresos: number;
}

interface RendimientoChofer {
  chofer_id: string;
  chofer_nombre: string;
  total: number;
  entregados: number;
  no_entregados: number;
  efectividad: number;
  tiempo_promedio_minutos: number | null;
}

interface ResumenGeneral {
  totalEnvios: number;
  tasaEntrega: number;
  tiempoPromedio: number | null;
  ingresosTotales: number;
  evolucionDiaria: { fecha: string; cantidad: number }[];
  distribucionEstados: { estado: string; cantidad: number }[];
}

export function useReportsData(filters: ReportsFilters) {
  const { tenantId } = useTenant();
  const from = startOfDay(filters.dateFrom).toISOString();
  const to = endOfDay(filters.dateTo).toISOString();

  const enviosPorSucursal = useQuery({
    queryKey: ['reports-sucursales', tenantId, from, to, filters.sucursalId],
    queryFn: async (): Promise<EnvioPorSucursal[]> => {
      let query = supabase
        .from('envios')
        .select('id, estado, sucursal_origen_id, sucursales!envios_sucursal_origen_id_fkey(nombre)')
        .eq('tenant_id', tenantId!)
        .gte('created_at', from)
        .lte('created_at', to);

      if (filters.sucursalId) {
        query = query.eq('sucursal_origen_id', filters.sucursalId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped = new Map<string, { nombre: string; total: number; entregados: number; pendientes: number; cancelados: number }>();

      for (const envio of data || []) {
        const sid = envio.sucursal_origen_id || 'sin_sucursal';
        const nombre = (envio.sucursales as any)?.nombre || 'Sin sucursal';
        if (!grouped.has(sid)) {
          grouped.set(sid, { nombre, total: 0, entregados: 0, pendientes: 0, cancelados: 0 });
        }
        const g = grouped.get(sid)!;
        g.total++;
        if (envio.estado === 'entregado') g.entregados++;
        else if (envio.estado === 'cancelado' || envio.estado === 'devuelto') g.cancelados++;
        else g.pendientes++;
      }

      return Array.from(grouped.entries()).map(([id, v]) => ({
        sucursal_id: id,
        sucursal_nombre: v.nombre,
        total: v.total,
        entregados: v.entregados,
        pendientes: v.pendientes,
        cancelados: v.cancelados,
        efectividad: v.total > 0 ? Math.round((v.entregados / v.total) * 100) : 0,
      })).sort((a, b) => b.total - a.total);
    },
    enabled: !!tenantId,
  });

  const destinos = useQuery({
    queryKey: ['reports-destinos', tenantId, from, to, filters.sucursalId],
    queryFn: async (): Promise<Destino[]> => {
      let query = supabase
        .from('envios')
        .select('ciudad_entrega, provincia, precio_total')
        .eq('tenant_id', tenantId!)
        .gte('created_at', from)
        .lte('created_at', to);

      if (filters.sucursalId) {
        query = query.eq('sucursal_origen_id', filters.sucursalId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const grouped = new Map<string, { ciudad: string; provincia: string; cantidad: number; ingresos: number }>();

      for (const envio of data || []) {
        const ciudad = envio.ciudad_entrega || 'Sin ciudad';
        const provincia = envio.provincia || 'Sin provincia';
        const key = `${ciudad}|${provincia}`;
        if (!grouped.has(key)) {
          grouped.set(key, { ciudad, provincia, cantidad: 0, ingresos: 0 });
        }
        const g = grouped.get(key)!;
        g.cantidad++;
        g.ingresos += envio.precio_total || 0;
      }

      return Array.from(grouped.values()).sort((a, b) => b.cantidad - a.cantidad);
    },
    enabled: !!tenantId,
  });

  const rendimientoChoferes = useQuery({
    queryKey: ['reports-choferes', tenantId, from, to, filters.sucursalId],
    queryFn: async (): Promise<RendimientoChofer[]> => {
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

      // Fetch profiles for chofer names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nombre, apellido')
        .in('id', choferIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre']));

      // Fetch historial for time calculation
      const envioIds = (enviosData || []).filter(e => e.estado === 'entregado').map(e => e.id);
      let tiempoMap = new Map<string, number>();

      if (envioIds.length > 0) {
        const { data: historial } = await supabase
          .from('envio_historial')
          .select('envio_id, estado_nuevo, created_at')
          .in('envio_id', envioIds)
          .in('estado_nuevo', ['en_reparto', 'entregado']);

        const historialByEnvio = new Map<string, { en_reparto?: string; entregado?: string }>();
        for (const h of historial || []) {
          if (!historialByEnvio.has(h.envio_id)) historialByEnvio.set(h.envio_id, {});
          const entry = historialByEnvio.get(h.envio_id)!;
          if (h.estado_nuevo === 'en_reparto' && !entry.en_reparto) entry.en_reparto = h.created_at!;
          if (h.estado_nuevo === 'entregado') entry.entregado = h.created_at!;
        }

        // Map envio_id to chofer_id for aggregation
        const envioChoferMap = new Map((enviosData || []).map(e => [e.id, e.chofer_id!]));
        const choferTiempos = new Map<string, number[]>();

        for (const [envioId, times] of historialByEnvio) {
          if (times.en_reparto && times.entregado) {
            const diff = (new Date(times.entregado).getTime() - new Date(times.en_reparto).getTime()) / 60000;
            if (diff > 0 && diff < 1440) { // reasonable range < 24h
              const choferId = envioChoferMap.get(envioId);
              if (choferId) {
                if (!choferTiempos.has(choferId)) choferTiempos.set(choferId, []);
                choferTiempos.get(choferId)!.push(diff);
              }
            }
          }
        }

        for (const [choferId, tiempos] of choferTiempos) {
          tiempoMap.set(choferId, Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length));
        }
      }

      // Aggregate by chofer
      const grouped = new Map<string, { total: number; entregados: number; no_entregados: number }>();
      for (const envio of enviosData || []) {
        const cid = envio.chofer_id!;
        if (!grouped.has(cid)) grouped.set(cid, { total: 0, entregados: 0, no_entregados: 0 });
        const g = grouped.get(cid)!;
        g.total++;
        if (envio.estado === 'entregado') g.entregados++;
        else if (envio.estado === 'cancelado' || envio.estado === 'devuelto' || envio.estado === 'incidencia') {
          g.no_entregados++;
        }
      }

      return Array.from(grouped.entries()).map(([id, v]) => ({
        chofer_id: id,
        chofer_nombre: profileMap.get(id) || 'Sin nombre',
        total: v.total,
        entregados: v.entregados,
        no_entregados: v.no_entregados,
        efectividad: v.total > 0 ? Math.round((v.entregados / v.total) * 100) : 0,
        tiempo_promedio_minutos: tiempoMap.get(id) ?? null,
      })).sort((a, b) => b.total - a.total);
    },
    enabled: !!tenantId,
  });

  const resumenGeneral = useQuery({
    queryKey: ['reports-resumen', tenantId, from, to, filters.sucursalId],
    queryFn: async (): Promise<ResumenGeneral> => {
      let query = supabase
        .from('envios')
        .select('id, estado, precio_total, created_at')
        .eq('tenant_id', tenantId!)
        .gte('created_at', from)
        .lte('created_at', to);

      if (filters.sucursalId) {
        query = query.eq('sucursal_origen_id', filters.sucursalId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const envios = data || [];
      const totalEnvios = envios.length;
      const entregados = envios.filter(e => e.estado === 'entregado').length;
      const tasaEntrega = totalEnvios > 0 ? Math.round((entregados / totalEnvios) * 100) : 0;
      const ingresosTotales = envios.reduce((sum, e) => sum + (e.precio_total || 0), 0);

      // Evolution by day
      const dailyMap = new Map<string, number>();
      for (const envio of envios) {
        const day = envio.created_at?.substring(0, 10) || '';
        if (day) dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      }
      const evolucionDiaria = Array.from(dailyMap.entries())
        .map(([fecha, cantidad]) => ({ fecha, cantidad }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

      // Distribution by status
      const statusMap = new Map<string, number>();
      for (const envio of envios) {
        const estado = envio.estado || 'pendiente';
        statusMap.set(estado, (statusMap.get(estado) || 0) + 1);
      }
      const distribucionEstados = Array.from(statusMap.entries())
        .map(([estado, cantidad]) => ({ estado, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

      // Average delivery time
      const entregadoIds = envios.filter(e => e.estado === 'entregado').map(e => e.id);
      let tiempoPromedio: number | null = null;

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

        const tiempos: number[] = [];
        for (const [, times] of historialByEnvio) {
          if (times.en_reparto && times.entregado) {
            const diff = (new Date(times.entregado).getTime() - new Date(times.en_reparto).getTime()) / 60000;
            if (diff > 0 && diff < 1440) tiempos.push(diff);
          }
        }
        if (tiempos.length > 0) {
          tiempoPromedio = Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length);
        }
      }

      return { totalEnvios, tasaEntrega, tiempoPromedio, ingresosTotales, evolucionDiaria, distribucionEstados };
    },
    enabled: !!tenantId,
  });

  // Fetch sucursales for the filter dropdown
  const sucursales = useQuery({
    queryKey: ['reports-sucursales-list', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('tenant_id', tenantId!)
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  return {
    enviosPorSucursal,
    destinos,
    rendimientoChoferes,
    resumenGeneral,
    sucursales,
  };
}
