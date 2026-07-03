import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Truck, Calculator, FileText, Check, DollarSign, Calendar, CreditCard, Eye, Edit2, Package, Clock, Download, Minus, Banknote, Trash2, Printer } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { downloadDriverSettlementPDF } from '@/lib/generateSettlementPDF';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';
import { SettlementDetailDialog } from '@/components/settlements/SettlementDetailDialog';
import { toLocalISOStart, toLocalISOEnd, parseDateString } from '@/lib/dateUtils';
import { AssignShipmentsRetroactiveDialog } from '@/components/drivers/AssignShipmentsRetroactiveDialog';
import { UserPlus } from 'lucide-react';

type PaymentMethod = Database['public']['Enums']['payment_method'];

interface Chofer {
  id: string;
  nombre: string;
  apellido: string | null;
  user_id: string;
  comision_tipo: string | null;
  comision_porcentaje: number | null;
  comision_fija: number | null;
}

interface EnvioParaLiquidar {
  id: string;
  tracking_number: string;
  tracking_externo?: string | null;
  precio_total: number;
  precio_efectivo: number;
  fecha_entrega: string;
  pago_contra_entrega: boolean;
  tipo_pago?: string | null;
  cobra_en_destino: boolean;
  tarifa?: {
    comision_chofer_porcentaje: number | null;
    comision_chofer_fija: number | null;
  } | null;
  // Commission info
  comision_id?: string | null;
  comision_monto?: number | null;
  liquidacion_id?: string | null;
  estado_liquidacion: 'a_liquidar' | 'liquidado';
  comision_calculada: number;
  regla_aplicada?: string | null;
}


interface Liquidacion {
  id: string;
  chofer_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  monto_total: number;
  cantidad_envios: number | null;
  estado: string | null;
  notas: string | null;
  created_at: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  chofer?: { nombre: string; apellido: string | null };
}

interface ChoferZonaRegla {
  id: string;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal_desde: string | null;
  codigo_postal_hasta: string | null;
  monto_fijo: number;
  porcentaje: number;
  prioridad: number;
  activa: boolean;
}

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function extractCP(cp: string): number {
  const cleaned = cp.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : NaN;
}

// Parses codigo_postal_desde. Supports either a single CP, a list "1880,1885,1890",
// or a range (when codigo_postal_hasta is also set).
function parseCPField(desde: string | null, hasta: string | null): { mode: 'none' } | { mode: 'list'; cps: Set<number> } | { mode: 'range'; from: number; to: number } {
  if (!desde) return { mode: 'none' };
  if (desde.includes(',')) {
    const cps = new Set<number>();
    for (const part of desde.split(',')) {
      const n = extractCP(part);
      if (!isNaN(n)) cps.add(n);
    }
    if (cps.size === 0) return { mode: 'none' };
    return { mode: 'list', cps };
  }
  const from = extractCP(desde);
  if (isNaN(from)) return { mode: 'none' };
  const to = hasta ? extractCP(hasta) : from;
  return { mode: 'range', from, to: isNaN(to) ? from : to };
}

function matchZonaRegla(
  reglas: ChoferZonaRegla[],
  ciudad: string | null | undefined,
  provincia: string | null | undefined,
  cp: string | null | undefined
): { regla: ChoferZonaRegla; matchedBy: 'cp' | 'ciudad' | 'ciudad_parcial' | 'provincia' | 'global' } | null {
  if (!reglas || reglas.length === 0) return null;
  const cN = ciudad ? normalizeStr(ciudad) : '';
  const pN = provincia ? normalizeStr(provincia) : '';
  const cpStr = cp?.trim() || '';
  const cpNum = cpStr ? extractCP(cpStr) : NaN;
  const sorted = [...reglas].filter(r => r.activa).sort((a, b) => a.prioridad - b.prioridad);

  // 1. CP (cualquier regla con CP cargado: lista o rango), independientemente de ciudad
  if (!isNaN(cpNum)) {
    const hit = sorted.find(r => {
      const parsed = parseCPField(r.codigo_postal_desde, r.codigo_postal_hasta);
      if (parsed.mode === 'list') return parsed.cps.has(cpNum);
      if (parsed.mode === 'range') return cpNum >= parsed.from && cpNum <= parsed.to;
      return false;
    });
    if (hit) return { regla: hit, matchedBy: 'cp' };
  }
  // 2. Ciudad exacta
  if (cN) {
    const hit = sorted.find(r => r.ciudad && normalizeStr(r.ciudad) === cN);
    if (hit) return { regla: hit, matchedBy: 'ciudad' };
  }
  // 3. Ciudad parcial
  if (cN) {
    const hit = sorted.find(r => r.ciudad && (normalizeStr(r.ciudad).includes(cN) || cN.includes(normalizeStr(r.ciudad))));
    if (hit) return { regla: hit, matchedBy: 'ciudad_parcial' };
  }
  // 4. Provincia catch-all (sólo reglas con provincia y SIN ciudad ni CP)
  if (pN) {
    const hit = sorted.find(r => {
      if (r.ciudad) return false;
      if (r.codigo_postal_desde) return false;
      if (!r.provincia) return false;
      const rp = normalizeStr(r.provincia);
      return rp === pN || pN.includes(rp) || rp.includes(pN);
    });
    if (hit) return { regla: hit, matchedBy: 'provincia' };
  }
  // 5. Catch-all global
  const fallback = sorted.find(r => !r.ciudad && !r.codigo_postal_desde && !r.provincia);
  if (fallback) return { regla: fallback, matchedBy: 'global' };
  return null;
}

function describeReglaAplicada(
  match: { regla: ChoferZonaRegla; matchedBy: 'cp' | 'ciudad' | 'ciudad_parcial' | 'provincia' | 'global' } | null,
  envioCP?: string | null
): string | null {
  if (!match) return null;
  const { regla: r, matchedBy } = match;
  if (matchedBy === 'cp') {
    if (envioCP) return `CP ${envioCP}${r.ciudad ? ` (${r.ciudad})` : ''}`;
    return r.ciudad ? `${r.ciudad} (por CP)` : 'CP coincidente';
  }
  if (matchedBy === 'ciudad' || matchedBy === 'ciudad_parcial') return r.ciudad || 'Ciudad';
  if (matchedBy === 'provincia') return `${r.provincia} (resto)`;
  return 'Catch-all';
}


// Helper to calculate commission based on driver config
function calcularComision(
  precioEnvio: number,
  choferConfig: Pick<Chofer, 'comision_tipo' | 'comision_porcentaje' | 'comision_fija'>,
  tarifaConfig?: { comision_chofer_porcentaje: number | null; comision_chofer_fija: number | null } | null,
  zonaRegla?: ChoferZonaRegla | null
): number {
  const tipo = choferConfig.comision_tipo || 'tarifa';

  switch (tipo) {
    case 'tarifa':
      if (tarifaConfig) {
        const porcentaje = tarifaConfig.comision_chofer_porcentaje || 0;
        const fija = tarifaConfig.comision_chofer_fija || 0;
        return (precioEnvio * porcentaje) / 100 + fija;
      }
      return 0;
    case 'porcentaje':
      return (precioEnvio * (choferConfig.comision_porcentaje || 0)) / 100;
    case 'fija':
      return choferConfig.comision_fija || 0;
    case 'mixta':
      return (precioEnvio * (choferConfig.comision_porcentaje || 0)) / 100 + (choferConfig.comision_fija || 0);
    case 'zona':
      if (zonaRegla) {
        return (precioEnvio * (zonaRegla.porcentaje || 0)) / 100 + (zonaRegla.monto_fijo || 0);
      }
      // Fallback: use driver's flat % / fija if cargados, else 0
      return (precioEnvio * (choferConfig.comision_porcentaje || 0)) / 100 + (choferConfig.comision_fija || 0);
    default:
      return 0;
  }
}

export default function DriverSettlements() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChofer, setSelectedChofer] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [enviosParaLiquidar, setEnviosParaLiquidar] = useState<EnvioParaLiquidar[]>([]);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedLiquidacion, setSelectedLiquidacion] = useState<string | null>(null);
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>('efectivo');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [notas, setNotas] = useState('');
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailLiquidacion, setDetailLiquidacion] = useState<Liquidacion | null>(null);
  const [montosEditados, setMontosEditados] = useState<Record<string, number>>({});
  const [descuentosCOD, setDescuentosCOD] = useState<Record<string, boolean>>({});
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [liquidacionToCancel, setLiquidacionToCancel] = useState<Liquidacion | null>(null);
  const [showAssignRetro, setShowAssignRetro] = useState(false);

  // Historial filters
  const [histDesde, setHistDesde] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [histHasta, setHistHasta] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [histTipoFecha, setHistTipoFecha] = useState<'periodo' | 'pago'>('periodo');
  const [histEstado, setHistEstado] = useState<string>('all');
  const [histChoferSearch, setHistChoferSearch] = useState<string>('');

  // Fetch choferes with commission config
  const { data: choferes = [] } = useQuery({
    queryKey: ['choferes-for-settlements'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'chofer');
      
      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];
      
      const userIds = roles.map(r => r.user_id);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nombre, apellido, user_id, comision_tipo, comision_porcentaje, comision_fija')
        .in('user_id', userIds)
        .eq('activo', true)
        .order('nombre');
      
      if (profilesError) throw profilesError;
      return (profiles || []) as Chofer[];
    },
  });

  // Fetch existing liquidaciones (con filtros de fecha)
  const { data: liquidaciones = [], isLoading: loadingLiquidaciones } = useQuery({
    queryKey: ['liquidaciones-choferes', histDesde, histHasta, histTipoFecha],
    queryFn: async () => {
      let query = supabase
        .from('liquidaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (histTipoFecha === 'pago') {
        query = query
          .gte('fecha_pago', toLocalISOStart(histDesde))
          .lte('fecha_pago', toLocalISOEnd(histHasta));
      } else {
        query = query
          .gte('periodo_inicio', histDesde)
          .lte('periodo_fin', histHasta);
      }

      const { data, error } = await query;
      if (error) throw error;

      const choferIds = [...new Set(data?.map(l => l.chofer_id) || [])];
      const { data: profiles } = choferIds.length
        ? await supabase
            .from('profiles')
            .select('user_id, nombre, apellido')
            .in('user_id', choferIds)
        : { data: [] as any[] };

      return (data || []).map(l => ({
        ...l,
        chofer: profiles?.find(p => p.user_id === l.chofer_id),
      })) as Liquidacion[];
    },
  });

  // Filtrado en cliente (estado + búsqueda chofer)
  const filteredLiquidaciones = liquidaciones.filter(l => {
    if (histEstado !== 'all' && (l.estado || 'generada') !== histEstado) return false;
    if (histChoferSearch.trim()) {
      const q = histChoferSearch.trim().toLowerCase();
      const nom = `${l.chofer?.nombre || ''} ${l.chofer?.apellido || ''}`.toLowerCase();
      if (!nom.includes(q)) return false;
    }
    return true;
  });

  const histTotals = {
    count: filteredLiquidaciones.length,
    totalPagado: filteredLiquidaciones.filter(l => l.estado === 'pagada').reduce((s, l) => s + (Number(l.monto_total) || 0), 0),
    totalGenerado: filteredLiquidaciones.reduce((s, l) => s + (Number(l.monto_total) || 0), 0),
    envios: filteredLiquidaciones.reduce((s, l) => s + (Number(l.cantidad_envios) || 0), 0),
  };

  // Calculate: fetch envíos completados por el chofer en el rango de fechas
  const calculateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChofer) {
        throw new Error('Seleccione un chofer');
      }
      if (!fechaInicio || !fechaFin) {
        throw new Error('Seleccione el rango de fechas');
      }

      const chofer = choferes.find(c => c.id === selectedChofer);
      if (!chofer) throw new Error('Chofer no encontrado');

      const selectFields = `
          id, tracking_number, tracking_externo, precio_total, precio_tarifa_vigente, fecha_entrega, tarifa_id,
          chofer_id, chofer_ultima_milla_id, pago_contra_entrega, tipo_pago, ciudad_entrega, provincia, cp_entrega,
          tarifas:tarifas(comision_chofer_porcentaje, comision_chofer_fija)
        `;

      // Fetch driver's zone commission rules (used only when comision_tipo='zona')
      let zonaReglas: ChoferZonaRegla[] = [];
      if (chofer.comision_tipo === 'zona') {
        const { data: reglasData } = await (supabase as any)
          .from('chofer_comisiones_zona')
          .select('id, ciudad, provincia, codigo_postal_desde, codigo_postal_hasta, monto_fijo, porcentaje, prioridad, activa')
          .eq('chofer_id', chofer.user_id)
          .eq('activa', true);
        zonaReglas = (reglasData || []) as ChoferZonaRegla[];
      }

      // 1a. Query por fecha_entrega
      const { data: enviosByFecha, error: enviosError } = await supabase
        .from('envios')
        .select(selectFields)
        .eq('estado', 'entregado')
        .or('entregado_en_sucursal.is.null,entregado_en_sucursal.eq.false')
        .or(`chofer_id.eq.${chofer.user_id},chofer_ultima_milla_id.eq.${chofer.user_id}`)
        .gte('fecha_entrega', toLocalISOStart(fechaInicio))
        .lte('fecha_entrega', toLocalISOEnd(fechaFin))
        .order('fecha_entrega', { ascending: false });

      if (enviosError) throw enviosError;

      // 1b. Query por fecha de ruta (cubre envíos con fecha_entrega inconsistente)
      const { data: rutasDelPeriodo } = await supabase
        .from('rutas_planificadas')
        .select('id')
        .eq('chofer_id', chofer.user_id)
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin);

      let enviosByRuta: typeof enviosByFecha = [];
      if (rutasDelPeriodo?.length) {
        const rutaIds = rutasDelPeriodo.map(r => r.id);
        const { data: paradas } = await supabase
          .from('ruta_paradas')
          .select('envio_id')
          .in('ruta_id', rutaIds);

        if (paradas?.length) {
          const envioIds = [...new Set(paradas.map(p => p.envio_id))];
          const { data } = await supabase
            .from('envios')
            .select(selectFields)
            .eq('estado', 'entregado')
            .or('entregado_en_sucursal.is.null,entregado_en_sucursal.eq.false')
            .in('id', envioIds);
          enviosByRuta = data || [];
        }
      }

      // Combinar sin duplicados
      const seenIds = new Set<string>();
      const envios: NonNullable<typeof enviosByFecha> = [];
      for (const e of [...(enviosByFecha || []), ...(enviosByRuta || [])]) {
        if (!seenIds.has(e.id)) {
          seenIds.add(e.id);
          envios.push(e);
        }
      }

      if (envios.length === 0) {
        return [];
      }

      // 2. Fetch zone tarifas for commission fallback (when envio has no tarifa_id)
      const { data: zoneTarifasData } = await supabase
        .from('tarifas')
        .select('id, zona_destino, precio_base, comision_chofer_porcentaje, comision_chofer_fija')
        .eq('tenant_id', profile?.tenant_id)
        .eq('tipo_tarifa', 'zona')
        .eq('activa', true);
      const allZoneTarifas = zoneTarifasData || [];

      // Helper: find zone tarifa precio_base by ciudad_entrega
      const findZoneTarifaPrecio = (ciudad: string | null, provincia?: string | null): number => {
        if (allZoneTarifas.length === 0) return 0;
        if (ciudad) {
          const ciudadNorm = normalize(ciudad);
          for (const zt of allZoneTarifas) {
            if (!zt.zona_destino) continue;
            const zonas = zt.zona_destino.split(',').map((z: string) => normalize(z.trim()));
            if (zonas.some((z: string) => z === ciudadNorm)) return zt.precio_base || 0;
          }
          for (const zt of allZoneTarifas) {
            if (!zt.zona_destino) continue;
            const zonas = zt.zona_destino.split(',').map((z: string) => normalize(z.trim()));
            if (zonas.some((z: string) => ciudadNorm.includes(z) || z.includes(ciudadNorm))) return zt.precio_base || 0;
          }
        }
        // Fallback: match by provincia
        if (provincia) {
          const provNorm = normalize(provincia);
          for (const zt of allZoneTarifas) {
            if (!zt.zona_destino) continue;
            const zonas = zt.zona_destino.split(',').map((z: string) => normalize(z.trim()));
            if (zonas.some((z: string) => z === provNorm || provNorm.includes(z) || z.includes(provNorm))) return zt.precio_base || 0;
          }
        }
        return 0;
      };

      const normalize = (str: string) => str.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Helper: find zone tarifa commission config by ciudad_entrega
      const findZoneTarifaComision = (ciudad: string | null, provincia?: string | null): { comision_chofer_porcentaje: number | null; comision_chofer_fija: number | null } | null => {
        if (allZoneTarifas.length === 0) return null;
        if (ciudad) {
          const ciudadNorm = normalize(ciudad);
          // Exact match first
          for (const zt of allZoneTarifas) {
            if (!zt.zona_destino) continue;
            const zonas = zt.zona_destino.split(',').map((z: string) => normalize(z.trim()));
            if (zonas.some((z: string) => z === ciudadNorm)) {
              return { comision_chofer_porcentaje: zt.comision_chofer_porcentaje, comision_chofer_fija: zt.comision_chofer_fija };
            }
          }
          // Substring match
          for (const zt of allZoneTarifas) {
            if (!zt.zona_destino) continue;
            const zonas = zt.zona_destino.split(',').map((z: string) => normalize(z.trim()));
            if (zonas.some((z: string) => ciudadNorm.includes(z) || z.includes(ciudadNorm))) {
              return { comision_chofer_porcentaje: zt.comision_chofer_porcentaje, comision_chofer_fija: zt.comision_chofer_fija };
            }
          }
        }
        // Fallback: match by provincia
        if (provincia) {
          const provNorm = normalize(provincia);
          for (const zt of allZoneTarifas) {
            if (!zt.zona_destino) continue;
            const zonas = zt.zona_destino.split(',').map((z: string) => normalize(z.trim()));
            if (zonas.some((z: string) => z === provNorm || provNorm.includes(z) || z.includes(provNorm))) {
              return { comision_chofer_porcentaje: zt.comision_chofer_porcentaje, comision_chofer_fija: zt.comision_chofer_fija };
            }
          }
        }
        // Fallback: largest zone
        const fallback = allZoneTarifas
          .filter(t => t.zona_destino && t.zona_destino.split(',').length > 3)
          .sort((a: any, b: any) => (b.zona_destino?.split(',').length || 0) - (a.zona_destino?.split(',').length || 0))[0];
        return fallback ? { comision_chofer_porcentaje: fallback.comision_chofer_porcentaje, comision_chofer_fija: fallback.comision_chofer_fija } : null;
      };

      // 3. Fetch existing comisiones for these envíos
      const envioIds = envios.map(e => e.id);
      const { data: comisiones } = await supabase
        .from('comisiones')
        .select('id, envio_id, monto, liquidacion_id')
        .in('envio_id', envioIds)
        .eq('chofer_id', chofer.user_id);

      const comisionesMap = new Map(comisiones?.map(c => [c.envio_id, c]) || []);

      // 4. Build results
      const results: EnvioParaLiquidar[] = envios.map((envio) => {
        const comision = comisionesMap.get(envio.id);
        let tarifa = envio.tarifas as { comision_chofer_porcentaje: number | null; comision_chofer_fija: number | null } | null;
        
        // If no tarifa from envio join and driver uses 'tarifa' commission type, try zone fallback
        if (!tarifa && (chofer.comision_tipo === 'tarifa' || !chofer.comision_tipo)) {
          tarifa = findZoneTarifaComision((envio as any).ciudad_entrega, (envio as any).provincia);
        }

        // Price hierarchy: precio_tarifa_vigente → precio_total → zone precio_base
        const ptv = (envio as any).precio_tarifa_vigente;
        const precioEfectivo =
          (ptv && ptv > 0) ? ptv :
          (envio.precio_total > 0) ? envio.precio_total :
          findZoneTarifaPrecio((envio as any).ciudad_entrega, (envio as any).provincia);
        
        const zonaMatch = chofer.comision_tipo === 'zona'
          ? matchZonaRegla(zonaReglas, (envio as any).ciudad_entrega, (envio as any).provincia, (envio as any).cp_entrega)
          : null;
        const zonaRegla = zonaMatch?.regla ?? null;

        const comisionCalculada = calcularComision(precioEfectivo, chofer, tarifa, zonaRegla);

        return {
          id: envio.id,
          tracking_number: envio.tracking_number,
          tracking_externo: envio.tracking_externo,
          precio_total: envio.precio_total,
          precio_efectivo: precioEfectivo,
          fecha_entrega: envio.fecha_entrega!,
          pago_contra_entrega: envio.pago_contra_entrega || false,
          tipo_pago: (envio as any).tipo_pago ?? null,
          cobra_en_destino: !!envio.pago_contra_entrega || (envio as any).tipo_pago === 'destino',
          tarifa,
          comision_id: comision?.id || null,
          comision_monto: comision?.monto ?? null,
          liquidacion_id: comision?.liquidacion_id || null,
          estado_liquidacion: comision?.liquidacion_id ? 'liquidado' : 'a_liquidar',
          comision_calculada: comision?.liquidacion_id ? (comision.monto ?? comisionCalculada) : comisionCalculada,
          regla_aplicada: chofer.comision_tipo === 'zona'
            ? (describeReglaAplicada(zonaMatch, (envio as any).cp_entrega) ?? 'sin match → fallback chofer')
            : null,
        };

      });

      // Reset edited amounts and COD discounts
      setMontosEditados({});
      setDescuentosCOD({});
      
      return results;
    },
    onSuccess: (data) => {
      setEnviosParaLiquidar(data);
      const aLiquidar = data.filter(e => e.estado_liquidacion === 'a_liquidar');
      toast.success(`Se encontraron ${data.length} envíos (${aLiquidar.length} pendientes de liquidar)`);
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Generate liquidación
  const generateMutation = useMutation({
    mutationFn: async () => {
      const aLiquidar = enviosParaLiquidar.filter(e => e.estado_liquidacion === 'a_liquidar');
      if (aLiquidar.length === 0) {
        throw new Error('No hay envíos pendientes para liquidar');
      }

      const chofer = choferes.find(c => c.id === selectedChofer);
      if (!chofer) throw new Error('Chofer no encontrado');

      // Calculate total commissions with edited amounts
      const totalComisiones = aLiquidar.reduce((sum, e) => {
        return sum + (montosEditados[e.id] ?? e.comision_calculada);
      }, 0);

      // Calculate COD discounts
      const totalDescuentosCOD = aLiquidar
        .filter(e => e.cobra_en_destino && descuentosCOD[e.id])
        .reduce((sum, e) => sum + e.precio_efectivo, 0);

      // Final amount (commissions - COD)
      const montoTotalFinal = totalComisiones - totalDescuentosCOD;

      // Build notes with breakdown
      const notasFinales = [
        totalDescuentosCOD > 0 ? `Comisiones: $${totalComisiones.toFixed(2)} | Descuentos COD: -$${totalDescuentosCOD.toFixed(2)}` : null,
        notas || null
      ].filter(Boolean).join(' | ');

      // 1. Create liquidación
      const { data: liquidacion, error: liquidacionError } = await supabase
        .from('liquidaciones')
        .insert({
          chofer_id: chofer.user_id,
          periodo_inicio: fechaInicio,
          periodo_fin: fechaFin,
          monto_total: montoTotalFinal,
          cantidad_envios: aLiquidar.length,
          estado: 'generada',
          notas: notasFinales || null,
          generado_por: user?.id,
          tenant_id: profile?.tenant_id,
        })
        .select()
        .single();

      if (liquidacionError) throw liquidacionError;

      // 2. For each envío: create or update comisión
      for (const envio of aLiquidar) {
        const montoFinal = montosEditados[envio.id] ?? envio.comision_calculada;
        const wasEdited = montosEditados[envio.id] !== undefined && montosEditados[envio.id] !== envio.comision_calculada;

        if (envio.comision_id) {
          // Update existing comisión
          await supabase
            .from('comisiones')
            .update({
              liquidacion_id: liquidacion.id,
              ...(wasEdited && {
                monto: montoFinal,
                monto_original: envio.comision_monto,
                editado_por: user?.id,
                editado_at: new Date().toISOString(),
              }),
            })
            .eq('id', envio.comision_id);
        } else {
          // Create new comisión
          await supabase
            .from('comisiones')
            .insert({
              chofer_id: chofer.user_id,
              envio_id: envio.id,
              monto: montoFinal,
              liquidacion_id: liquidacion.id,
              tenant_id: profile?.tenant_id,
              ...(wasEdited && {
                monto_original: envio.comision_calculada,
                editado_por: user?.id,
                editado_at: new Date().toISOString(),
              }),
            });
        }
      }

      return liquidacion;
    },
    onSuccess: () => {
      toast.success('Liquidación generada correctamente');
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-choferes'] });
      setEnviosParaLiquidar([]);
      setNotas('');
      setMontosEditados({});
      setDescuentosCOD({});
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Pay liquidación
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLiquidacion) throw new Error('No hay liquidación seleccionada');

      const liquidacionData = liquidaciones.find(l => l.id === selectedLiquidacion);
      if (!liquidacionData) throw new Error('Liquidación no encontrada');

      const { error } = await supabase
        .from('liquidaciones')
        .update({
          estado: 'pagada',
          metodo_pago: metodoPago,
          referencia_pago: referenciaPago || null,
          fecha_pago: new Date().toISOString(),
          aprobado_por: user?.id,
        })
        .eq('id', selectedLiquidacion);

      if (error) throw error;

      // Registrar egreso en caja si hay sesión abierta y el pago es en efectivo
      if (metodoPago === 'efectivo' && profile?.sucursal_id) {
        const { data: cajaAbierta } = await supabase
          .from('sesiones_caja')
          .select('id')
          .eq('sucursal_id', profile.sucursal_id)
          .eq('estado', 'abierta')
          .order('created_at', { ascending: false })
          .limit(1);

        if (cajaAbierta && cajaAbierta.length > 0) {
          const choferNombre = liquidacionData.chofer
            ? `${liquidacionData.chofer.nombre}${liquidacionData.chofer.apellido ? ` ${liquidacionData.chofer.apellido}` : ''}`
            : 'Chofer';
          const periodo = `${liquidacionData.periodo_inicio} a ${liquidacionData.periodo_fin}`;

          await supabase.from('movimientos_caja').insert({
            sesion_caja_id: cajaAbierta[0].id,
            tipo: 'egreso',
            concepto: `Pago liquidación chofer ${choferNombre} - ${periodo}`,
            monto: liquidacionData.monto_total,
            metodo_pago: 'efectivo' as PaymentMethod,
            referencia: referenciaPago || null,
            created_by: user?.id,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success('Pago registrado');
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-choferes'] });
      setShowPayDialog(false);
      setSelectedLiquidacion(null);
      setMetodoPago('efectivo');
      setReferenciaPago('');
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Cancel/Delete liquidación mutation with optimistic updates
  const cancelMutation = useMutation({
    mutationFn: async (liquidacionId: string) => {
      // 1. Remove association from comisiones
      const { error: comisionesError } = await supabase
        .from('comisiones')
        .update({ liquidacion_id: null })
        .eq('liquidacion_id', liquidacionId);

      if (comisionesError) throw comisionesError;

      // 2. Delete the liquidación and verify it was actually deleted
      const { data, error } = await supabase
        .from('liquidaciones')
        .delete()
        .eq('id', liquidacionId)
        .select('id');

      if (error) throw error;
      
      // Verify that a row was actually deleted
      if (!data || data.length === 0) {
        throw new Error('No se pudo eliminar la liquidación. Puede que no tengas permisos o ya fue eliminada.');
      }
      
      return liquidacionId;
    },
    onMutate: async (liquidacionId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['liquidaciones-choferes'] });
      
      // Snapshot the previous value
      const previousLiquidaciones = queryClient.getQueryData(['liquidaciones-choferes']);
      
      // Optimistically remove from the list
      queryClient.setQueryData(['liquidaciones-choferes'], (old: Liquidacion[] | undefined) => 
        old?.filter((l) => l.id !== liquidacionId) ?? []
      );
      
      return { previousLiquidaciones };
    },
    onSuccess: () => {
      toast.success('Liquidación cancelada correctamente');
      setShowCancelDialog(false);
      setLiquidacionToCancel(null);
    },
    onError: (error, _liquidacionId, context) => {
      // Rollback to the previous value on error
      if (context?.previousLiquidaciones) {
        queryClient.setQueryData(['liquidaciones-choferes'], context.previousLiquidaciones);
      }
      toast.error('Error al cancelar: ' + error.message);
      setShowCancelDialog(false);
      setLiquidacionToCancel(null);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['liquidaciones-choferes'] });
    },
  });

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { label: string; className: string }> = {
      generada: { label: 'Generada', className: 'bg-warning/10 text-warning border-warning' },
      enviada: { label: 'Enviada', className: 'bg-info/10 text-info border-info' },
      pagada: { label: 'Pagada', className: 'bg-success/10 text-success border-success' },
      rechazada: { label: 'Rechazada', className: 'bg-destructive/10 text-destructive border-destructive' },
    };
    const c = config[estado] || { label: estado, className: '' };
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  const openPayDialog = (id: string) => {
    setSelectedLiquidacion(id);
    setShowPayDialog(true);
  };

  // Stats
  const enviosALiquidar = enviosParaLiquidar.filter(e => e.estado_liquidacion === 'a_liquidar');
  const enviosLiquidados = enviosParaLiquidar.filter(e => e.estado_liquidacion === 'liquidado');
  const totalComisiones = enviosALiquidar.reduce((sum, e) => sum + (montosEditados[e.id] ?? e.comision_calculada), 0);
  const totalDescuentosCOD = enviosALiquidar
    .filter(e => e.cobra_en_destino && descuentosCOD[e.id])
    .reduce((sum, e) => sum + e.precio_efectivo, 0);
  const saldoFinal = totalComisiones - totalDescuentosCOD;
  const totalLiquidados = enviosLiquidados.reduce((sum, e) => sum + e.comision_calculada, 0);
  const enviosCOD = enviosALiquidar.filter(e => e.cobra_en_destino);

  const toggleDescuentoCOD = (envioId: string) => {
    setDescuentosCOD(prev => ({
      ...prev,
      [envioId]: !prev[envioId]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Liquidaciones de Choferes</h1>
        <p className="text-muted-foreground">Gestiona los pagos de comisiones a choferes</p>
      </div>

      {/* Calculator Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calcular Liquidación
          </CardTitle>
          <CardDescription>
            Selecciona un chofer y el rango de fechas para ver los envíos entregados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Chofer</Label>
              <Select value={selectedChofer} onValueChange={setSelectedChofer}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar chofer" />
                </SelectTrigger>
                <SelectContent>
                  {choferes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} {c.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin</Label>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => calculateMutation.mutate()}
                disabled={calculateMutation.isPending || !selectedChofer || !fechaInicio || !fechaFin}
                className="flex-1"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {calculateMutation.isPending ? 'Buscando...' : 'Buscar Envíos'}
              </Button>
              <Button
                variant="outline"
                title="Asignar envíos retroactivos al chofer"
                onClick={() => setShowAssignRetro(true)}
                disabled={!selectedChofer}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>


          {/* Results */}
          {enviosParaLiquidar.length > 0 && (
            <div className="mt-6 space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Total Envíos</span>
                    </div>
                    <p className="text-2xl font-bold">{enviosParaLiquidar.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-success/5 border-success/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-success" />
                      <span className="text-sm text-muted-foreground">Comisiones (+)</span>
                    </div>
                    <p className="text-2xl font-bold text-success">
                      ${totalComisiones.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                {enviosCOD.length > 0 && (
                  <Card className="bg-destructive/5 border-destructive/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Banknote className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-muted-foreground">Cobros COD (-)</span>
                      </div>
                      <p className="text-2xl font-bold text-destructive">
                        -${totalDescuentosCOD.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                )}
                <Card className={`${saldoFinal >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-warning/5 border-warning/20'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calculator className="h-4 w-4" />
                      <span className="text-sm text-muted-foreground">Saldo Final</span>
                    </div>
                    <p className={`text-2xl font-bold ${saldoFinal >= 0 ? 'text-primary' : 'text-warning'}`}>
                      ${saldoFinal.toFixed(2)}
                    </p>
                    {saldoFinal < 0 && (
                      <p className="text-xs text-warning mt-1">Chofer debe dinero</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Check className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Ya Liquidados</span>
                    </div>
                    <p className="text-2xl font-bold text-muted-foreground">
                      {enviosLiquidados.length}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Generate Button */}
              {enviosALiquidar.length > 0 && (
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1 max-w-md">
                    <Label>Notas (opcional)</Label>
                    <Textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Observaciones para esta liquidación..."
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    className="bg-chofer hover:bg-chofer/90 ml-4"
                    size="lg"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Generar Liquidación ({enviosALiquidar.length} envíos)
                  </Button>
                </div>
              )}

              {/* Envíos table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Fecha Entrega</TableHead>
                      <TableHead>Monto Envío</TableHead>
                      <TableHead>COD</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                      <TableHead className="text-center">Descuento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enviosParaLiquidar.map((envio) => {
                      const isALiquidar = envio.estado_liquidacion === 'a_liquidar';
                      const montoFinal = montosEditados[envio.id] ?? envio.comision_calculada;
                      const wasEdited = montosEditados[envio.id] !== undefined && montosEditados[envio.id] !== envio.comision_calculada;
                      
                      return (
                        <TableRow key={envio.id} className={!isALiquidar ? 'opacity-60' : ''}>
                          <TableCell className="font-mono">
                            <div className="flex flex-col gap-1">
                              <span>{envio.tracking_externo || envio.tracking_number}</span>
                              {envio.regla_aplicada && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-normal w-fit ${envio.regla_aplicada.startsWith('sin match') ? 'bg-amber-500/10 text-amber-600 border-amber-500' : 'bg-muted text-muted-foreground'}`}
                                >
                                  {envio.regla_aplicada}
                                </Badge>
                              )}
                              {!isALiquidar && envio.liquidacion_id && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-normal w-fit bg-blue-500/10 text-blue-600 border-blue-500 cursor-pointer hover:bg-blue-500/20"
                                  onClick={() => {
                                    const liq = liquidaciones.find(l => l.id === envio.liquidacion_id);
                                    if (liq) {
                                      setDetailLiquidacion(liq);
                                      setShowDetailDialog(true);
                                    } else {
                                      toast.info(`Pertenece a liquidación ${envio.liquidacion_id?.slice(0, 8)}… (no está en las últimas 50)`);
                                    }
                                  }}
                                  title="Ver liquidación. Para recalcular con reglas nuevas, cancelala primero."
                                >
                                  Liq. {envio.liquidacion_id.slice(0, 8)}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            {format(new Date(envio.fecha_entrega), 'dd/MM/yy', { locale: es })}
                          </TableCell>
                          <TableCell>
                            ${envio.precio_efectivo.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {envio.cobra_en_destino ? (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500">
                                <Banknote className="h-3 w-3 mr-1" />
                                ${envio.precio_efectivo.toFixed(2)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isALiquidar ? (
                              <Badge variant="outline" className="bg-warning/10 text-warning border-warning">
                                A liquidar
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-success/10 text-success border-success">
                                <Check className="h-3 w-3 mr-1" />
                                Liquidado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isALiquidar ? (
                              <div className="flex items-center justify-end gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className={`w-24 text-right font-bold ${wasEdited ? 'border-warning text-warning' : 'text-success'}`}
                                  value={montoFinal}
                                  onChange={(e) => setMontosEditados(prev => ({
                                    ...prev,
                                    [envio.id]: parseFloat(e.target.value) || 0
                                  }))}
                                />
                                {wasEdited && <Edit2 className="h-3 w-3 text-warning" />}
                              </div>
                            ) : (
                              <span className="font-bold text-muted-foreground">
                                ${envio.comision_calculada.toFixed(2)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {envio.cobra_en_destino && isALiquidar ? (
                              <Button
                                size="sm"
                                variant={descuentosCOD[envio.id] ? "default" : "outline"}
                                className={descuentosCOD[envio.id] ? "bg-destructive hover:bg-destructive/90" : ""}
                                onClick={() => toggleDescuentoCOD(envio.id)}
                              >
                                {descuentosCOD[envio.id] ? (
                                  <>
                                    <Check className="h-3 w-3 mr-1" />
                                    Descontado
                                  </>
                                ) : (
                                  <>
                                    <Minus className="h-3 w-3 mr-1" />
                                    Descontar
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial de Liquidaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div>
              <Label className="text-xs">Tipo de fecha</Label>
              <Select value={histTipoFecha} onValueChange={(v) => setHistTipoFecha(v as 'periodo' | 'pago')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="periodo">Período de liquidación</SelectItem>
                  <SelectItem value="pago">Fecha de pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={histDesde} onChange={(e) => setHistDesde(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={histHasta} onChange={(e) => setHistHasta(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={histEstado} onValueChange={setHistEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="generada">Generada</SelectItem>
                  <SelectItem value="pagada">Pagada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Buscar chofer</Label>
              <Input value={histChoferSearch} onChange={(e) => setHistChoferSearch(e.target.value)} placeholder="Nombre..." />
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() => {
                  setHistDesde(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                  setHistHasta(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                }}
              >
                Mes actual
              </Button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Liquidaciones</p>
              <p className="text-2xl font-bold">{histTotals.count}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total pagado</p>
              <p className="text-2xl font-bold text-success">${histTotals.totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total generado</p>
              <p className="text-2xl font-bold">${histTotals.totalGenerado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Envíos</p>
              <p className="text-2xl font-bold">{histTotals.envios}</p>
            </CardContent></Card>
          </div>

          {loadingLiquidaciones ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : filteredLiquidaciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay liquidaciones en el rango seleccionado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Fecha pago</TableHead>
                  <TableHead>Envíos</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLiquidaciones.map((liq) => (
                  <TableRow key={liq.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-chofer" />
                        {liq.chofer?.nombre} {liq.chofer?.apellido}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(parseDateString(liq.periodo_inicio), 'dd/MM/yy', { locale: es })} -
                        {format(parseDateString(liq.periodo_fin), 'dd/MM/yy', { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell>{liq.cantidad_envios}</TableCell>
                    <TableCell className="font-bold text-success">
                      ${liq.monto_total.toFixed(2)}
                    </TableCell>
                    <TableCell>{getEstadoBadge(liq.estado || 'generada')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDetailLiquidacion(liq);
                            setShowDetailDialog(true);
                          }}
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadDriverSettlementPDF(liq)}
                          title="Descargar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                          title="Imprimir"
                        >
                          <a href={`/print-settlement?id=${liq.id}&type=driver`} target="_blank" rel="noopener noreferrer">
                            <Printer className="h-4 w-4" />
                          </a>
                        </Button>
                        {liq.estado !== 'pagada' && (
                          <>
                            {liq.estado === 'generada' && (
                              <Button
                                size="sm"
                                onClick={() => openPayDialog(liq.id)}
                              >
                                <CreditCard className="h-4 w-4 mr-1" />
                                Pagar
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setLiquidacionToCancel(liq);
                                setShowCancelDialog(true);
                              }}
                              title="Cancelar liquidación"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {liq.estado === 'pagada' && (
                          <Badge variant="outline" className="bg-success/10 text-success">
                            <Check className="h-3 w-3 mr-1" />
                            Pagada
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pay Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Ingresa los datos del pago realizado al chofer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={metodoPago} onValueChange={(v) => setMetodoPago(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referencia (opcional)</Label>
              <Input
                placeholder="Número de transferencia, recibo, etc."
                value={referenciaPago}
                onChange={(e) => setReferenciaPago(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => payMutation.mutate()} 
              disabled={payMutation.isPending}
              className="bg-success hover:bg-success/90"
            >
              {payMutation.isPending ? 'Procesando...' : 'Confirmar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <SettlementDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        settlementId={detailLiquidacion?.id || null}
        type="driver"
        settlement={detailLiquidacion}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta liquidación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la liquidación y las comisiones asociadas
              quedarán disponibles para una nueva liquidación.
              {liquidacionToCancel && (
                <div className="mt-4 p-3 bg-muted rounded-lg space-y-1">
                  <p><strong>Chofer:</strong> {liquidacionToCancel.chofer?.nombre} {liquidacionToCancel.chofer?.apellido}</p>
                  <p><strong>Monto:</strong> ${liquidacionToCancel.monto_total.toFixed(2)}</p>
                  <p><strong>Envíos:</strong> {liquidacionToCancel.cantidad_envios}</p>
                  <p><strong>Período:</strong> {format(parseDateString(liquidacionToCancel.periodo_inicio), 'dd/MM/yy', { locale: es })} - {format(parseDateString(liquidacionToCancel.periodo_fin), 'dd/MM/yy', { locale: es })}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={(e) => {
              e.preventDefault();
              if (liquidacionToCancel) {
                cancelMutation.mutate(liquidacionToCancel.id);
              }
            }}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar liquidación'}
          </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedChofer && (() => {
        const chofer = choferes.find(c => c.id === selectedChofer);
        if (!chofer) return null;
        return (
          <AssignShipmentsRetroactiveDialog
            open={showAssignRetro}
            onOpenChange={setShowAssignRetro}
            choferUserId={chofer.user_id}
            choferNombre={`${chofer.nombre}${chofer.apellido ? ' ' + chofer.apellido : ''}`}
            tenantId={profile?.tenant_id}
            defaultFechaInicio={fechaInicio}
            defaultFechaFin={fechaFin}
            onAssigned={() => {
              if (fechaInicio && fechaFin) calculateMutation.mutate();
            }}
          />
        );
      })()}
    </div>
  );
}

