import { useState } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { DollarSign, TrendingUp, TrendingDown, Plus, Calculator, FileText, Eye, Check, X, CalendarIcon, Download, Loader2, Printer, Package, ChevronsUpDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { parseDateString } from '@/lib/dateUtils';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SellerSettlementDialog } from '@/components/ecommerce/SellerSettlementDialog';
import { SellerLiquidacionDetailDialog } from '@/components/ecommerce/SellerLiquidacionDetailDialog';
import { downloadSellerSettlementPDF } from '@/lib/generateSettlementPDF';

interface Seller {
  id: string;
  nombre: string;
  saldo_cuenta_corriente: number;
  tiene_cuenta_corriente: boolean;
  cliente_id: string | null;
  tarifa_id: string | null;
}


interface SellerLiquidacion {
  id: string;
  seller_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  total_cargos: number | null;
  total_pagos: number | null;
  saldo_periodo: number | null;
  saldo_anterior: number | null;
  saldo_final: number | null;
  cantidad_movimientos: number | null;
  estado: string | null;
  notas: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  fecha_pago: string | null;
  factura_id: string | null;
  seller?: { nombre: string };
}

interface CalculatedMovement {
  id: string;
  tipo: string;
  monto: number;
  descripcion: string | null;
  referencia: string | null;
  created_at: string;
  seller_id?: string;
  saldo_anterior?: number;
}

interface ConceptoAdicional {
  nombre: string;
  monto: number;
}

interface CalculatedEnvio {
  id: string;
  tracking_number: string;
  nombre_destinatario: string | null;
  direccion_entrega: string | null;
  ciudad_entrega: string | null;
  precio_total: number;
  precio_original: number;
  precio_calculado: boolean;
  zona_match: string | null;
  estado: string | null;
  created_at: string;
  tiene_visitas?: boolean;
  destinatario?: { nombre: string | null; apellido: string | null } | null;
  estado_liquidacion: 'a_liquidar' | 'liquidado';
  conceptos_adicionales: ConceptoAdicional[];
}

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'otro', label: 'Otro' },
];

export default function Settlements() {
  const { tenantId } = useTenant();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = usePersistedState('ui-tab-ecommerce-settlements', 'sellers');

  // Existing states
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [activeSeller, setActiveSeller] = useState<Seller | null>(null);

  // Liquidaciones states
  const [calcSellers, setCalcSellers] = useState<string[]>([]);
  const [sellerPopoverOpen, setSellerPopoverOpen] = useState(false);
  const [fechaInicio, setFechaInicio] = useState<Date>(startOfMonth(new Date()));
  const [fechaFin, setFechaFin] = useState<Date>(endOfMonth(new Date()));
  const [calculatedMovements, setCalculatedMovements] = useState<CalculatedMovement[]>([]);
  const [calculatedEnvios, setCalculatedEnvios] = useState<CalculatedEnvio[]>([]);
  const [calculatedTotals, setCalculatedTotals] = useState<{
    totalCargos: number;
    totalPagos: number;
    saldoPeriodo: number;
    saldoAnterior: number;
    totalEnvios: number;
  } | null>(null);
  
  const [notas, setNotas] = useState('');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLiquidacion, setSelectedLiquidacion] = useState<SellerLiquidacion | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingLiquidacion, setPayingLiquidacion] = useState<SellerLiquidacion | null>(null);
  const [payMetodo, setPayMetodo] = useState('transferencia');
  const [payReferencia, setPayReferencia] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelingLiquidacion, setCancelingLiquidacion] = useState<SellerLiquidacion | null>(null);
  const [excludedEnvioIds, setExcludedEnvioIds] = useState<Set<string>>(new Set());

  // Fetch sellers with account
  const { data: sellers, isLoading: loadingSellers } = useQuery({
    queryKey: ['ecommerce-sellers-cta-cte', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_sellers')
        .select('id, nombre, saldo_cuenta_corriente, tiene_cuenta_corriente, cliente_id, tarifa_id')
        .eq('tenant_id', tenantId)
        .eq('tiene_cuenta_corriente', true)
        .order('nombre');

      if (error) throw error;
      return data as Seller[];
    },
    enabled: !!tenantId,
    refetchOnWindowFocus: false,
  });

  // Recalculate balances using tariff logic for Saldos por Seller tab
  const { data: sellerBalances, isLoading: loadingBalances } = useQuery({
    queryKey: ['seller-tariff-balances', tenantId, sellers?.map(s => s.id).join(',')],
    queryFn: async () => {
      if (!sellers || sellers.length === 0) return {};

      const normalize = (str: string) => str.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // 1. Load assigned tarifas + always load zone tarifas for the tenant
      const uniqueTarifaIds = [...new Set(sellers.map(s => s.tarifa_id).filter((id): id is string => !!id))];
      let tarifasMap = new Map<string, any>();

      if (uniqueTarifaIds.length > 0) {
        const { data: tarifasData } = await supabase
          .from('tarifas')
          .select('id, precio_base, zona_destino, nombre, tipo_tarifa')
          .in('id', uniqueTarifaIds);
        (tarifasData || []).forEach(t => tarifasMap.set(t.id, t));
      }

      // Load zone tarifas for the tenant — split into exclusive and general
      const { data: zoneTarifas } = await supabase
        .from('tarifas')
        .select('id, precio_base, zona_destino, nombre, seller_exclusivo_id')
        .eq('tenant_id', tenantId)
        .eq('tipo_tarifa', 'zona')
        .eq('activa', true);
      const allZoneTarifasRaw = zoneTarifas || [];
      // Exclusive tarifas grouped by seller
      const exclusiveTarifasBySeller = new Map<string, any[]>();
      allZoneTarifasRaw.filter(t => t.seller_exclusivo_id).forEach(t => {
        const list = exclusiveTarifasBySeller.get(t.seller_exclusivo_id!) || [];
        list.push(t);
        exclusiveTarifasBySeller.set(t.seller_exclusivo_id!, list);
      });
      // General zone tarifas (no seller_exclusivo_id)
      const allZoneTarifas = allZoneTarifasRaw.filter(t => !t.seller_exclusivo_id);

      // 2. For each seller, fetch their envios and payments
      const balances: Record<string, { totalEnvios: number; totalPagos: number; cantEnvios: number; saldoCalculado: number }> = {};
      const sellerIds = sellers.map(s => s.id);

      // Fetch all ecommerce orders for all sellers at once
      const { data: allOrders } = await supabase
        .from('ecommerce_orders')
        .select('envio_id, seller_id')
        .in('seller_id', sellerIds)
        .not('envio_id', 'is', null);

      // Group envio_ids by seller
      const envioIdsBySeller = new Map<string, string[]>();
      (allOrders || []).forEach(o => {
        if (!o.envio_id) return;
        const list = envioIdsBySeller.get(o.seller_id) || [];
        list.push(o.envio_id);
        envioIdsBySeller.set(o.seller_id, list);
      });

      // Fetch all envios at once
      const allEnvioIds = [...new Set((allOrders || []).map(o => o.envio_id).filter((id): id is string => !!id))];
      let enviosMap = new Map<string, any>();
      if (allEnvioIds.length > 0) {
        // Fetch in chunks of 500
        for (let i = 0; i < allEnvioIds.length; i += 500) {
          const chunk = allEnvioIds.slice(i, i + 500);
          const { data: enviosData } = await supabase
            .from('envios')
            .select('id, ciudad_entrega, precio_total, precio_tarifa_vigente, estado')
            .in('id', chunk);
          (enviosData || []).forEach(e => enviosMap.set(e.id, e));
        }
      }

      // Also fetch common envios per cliente_id
      const uniqueClienteIds = [...new Set(sellers.map(s => s.cliente_id).filter(Boolean))] as string[];
      let commonEnviosBySeller = new Map<string, any[]>();
      if (uniqueClienteIds.length > 0) {
        const allOrderEnvioIds = new Set(allEnvioIds);
        for (const seller of sellers) {
          if (!seller.cliente_id) continue;
          const { data: commonEnvios } = await supabase
            .from('envios')
            .select('id, ciudad_entrega, precio_total, estado')
            .eq('remitente_id', seller.cliente_id);
          const filtered = (commonEnvios || []).filter(e => !allOrderEnvioIds.has(e.id));
          filtered.forEach(e => enviosMap.set(e.id, e));
          const existing = commonEnviosBySeller.get(seller.id) || [];
          commonEnviosBySeller.set(seller.id, [...existing, ...filtered.map(e => e.id)]);
        }
      }

      // Fetch envio_ids from seller_cuenta_corriente (tipo cargo) — terciarizados/planificador
      const { data: ctaCteCargoMovs } = await supabase
        .from('seller_cuenta_corriente')
        .select('envio_id, seller_id')
        .in('seller_id', sellerIds)
        .eq('tipo', 'cargo')
        .not('envio_id', 'is', null);

      const ctaCteBySeller = new Map<string, string[]>();
      const allCtaCteEnvioIds: string[] = [];
      (ctaCteCargoMovs || []).forEach(m => {
        if (!m.envio_id) return;
        const list = ctaCteBySeller.get(m.seller_id) || [];
        list.push(m.envio_id);
        ctaCteBySeller.set(m.seller_id, list);
        allCtaCteEnvioIds.push(m.envio_id);
      });

      // Fetch cta cte envios not already in enviosMap
      const missingCtaCteIds = [...new Set(allCtaCteEnvioIds)].filter(id => !enviosMap.has(id));
      if (missingCtaCteIds.length > 0) {
        for (let i = 0; i < missingCtaCteIds.length; i += 500) {
          const chunk = missingCtaCteIds.slice(i, i + 500);
          const { data: ctaCteEnviosData } = await supabase
            .from('envios')
            .select('id, ciudad_entrega, precio_total, precio_tarifa_vigente, estado')
            .in('id', chunk);
          (ctaCteEnviosData || []).forEach(e => enviosMap.set(e.id, e));
        }
      }

      // Fetch all payments at once
      const { data: allPayments } = await supabase
        .from('seller_cuenta_corriente')
        .select('seller_id, monto, tipo')
        .in('seller_id', sellerIds)
        .eq('tipo', 'pago');

      const paymentsBySeller = new Map<string, number>();
      (allPayments || []).forEach(p => {
        const current = paymentsBySeller.get(p.seller_id) || 0;
        paymentsBySeller.set(p.seller_id, current + Math.abs(p.monto || 0));
      });

      // 3. Batch check visitas for all cancelled envios
      const allCancelledIds = [...enviosMap.values()]
        .filter(e => e.estado === 'cancelado')
        .map(e => e.id);
      let balanceEnviosConVisitas = new Set<string>();
      if (allCancelledIds.length > 0) {
        const { data: visitasData } = await supabase
          .from('envio_historial')
          .select('envio_id')
          .in('envio_id', allCancelledIds)
          .in('estado_nuevo', ['en_reparto', 'no_entregado'] as any[]);
        balanceEnviosConVisitas = new Set((visitasData || []).map(v => v.envio_id));
      }

      // 4. Calculate per seller
      for (const seller of sellers) {
        const ecomEnvioIds = envioIdsBySeller.get(seller.id) || [];
        const commonIds = commonEnviosBySeller.get(seller.id) || [];
        const ctaCteIds = ctaCteBySeller.get(seller.id) || [];
        const allSellerEnvioIds = [...new Set([...ecomEnvioIds, ...commonIds, ...ctaCteIds])];

        let totalEnvios = 0;
        for (const envioId of allSellerEnvioIds) {
          const envio = enviosMap.get(envioId);
          if (!envio) continue;

          // Pendiente = no liquidar
          if (envio.estado === 'pendiente') continue;

          // Cancelado sin visitas = $0
          if (envio.estado === 'cancelado' && !balanceEnviosConVisitas.has(envio.id)) {
            continue; // precio = 0, no sumar
          }

          let precio = 0;

          // Priority: use frozen price if available
          if (envio.precio_tarifa_vigente != null && envio.precio_tarifa_vigente > 0) {
            precio = envio.precio_tarifa_vigente;
          } else {
            // Use precio_total as historical fallback (was calculated with the tariff at creation time)
            precio = envio.precio_total || 0;

            // Only do zone/tarifa lookup if precio_total is 0 or null (truly missing price)
            if (precio === 0) {
              // Helper to match city against a list of zone tarifas
              const matchZoneIn = (ciudad: string, tarifaList: any[]): number | null => {
                if (!ciudad || tarifaList.length === 0) return null;
                const ciudadNorm = normalize(ciudad);
                for (const zt of tarifaList) {
                  if (!zt.zona_destino) continue;
                  const zonas = zt.zona_destino.split(',').map((z: string) => normalize(z.trim()));
                  if (zonas.some((z: string) => z === ciudadNorm)) {
                    return zt.precio_base || 0;
                  }
                }
                for (const zt of tarifaList) {
                  if (!zt.zona_destino) continue;
                  const zonas = zt.zona_destino.split(',').map((z: string) => normalize(z.trim()));
                  if (zonas.some((z: string) => ciudadNorm.includes(z) || z.includes(ciudadNorm))) {
                    return zt.precio_base || 0;
                  }
                }
                const fallback = tarifaList
                  .filter(t => t.zona_destino && t.zona_destino.split(',').length > 3)
                  .sort((a: any, b: any) => (b.zona_destino?.split(',').length || 0) - (a.zona_destino?.split(',').length || 0))[0];
                return fallback ? (fallback.precio_base || 0) : null;
              };

              // Priority: 1) seller exclusive tarifas, 2) assigned tarifa, 3) general zone tarifas
              const sellerExclusives = exclusiveTarifasBySeller.get(seller.id) || [];
              if (sellerExclusives.length > 0 && envio.ciudad_entrega) {
                const exclPrice = matchZoneIn(envio.ciudad_entrega, sellerExclusives);
                if (exclPrice !== null) precio = exclPrice;
              }

              if (precio === 0 && seller.tarifa_id) {
                const tarifa = tarifasMap.get(seller.tarifa_id);
                if (tarifa) {
                  if (tarifa.tipo_tarifa === 'zona' && envio.ciudad_entrega) {
                    const zonePrice = matchZoneIn(envio.ciudad_entrega, allZoneTarifas);
                    if (zonePrice !== null) precio = zonePrice;
                  } else {
                    precio = tarifa.precio_base || 0;
                  }
                }
              }
              
              if (precio === 0 && allZoneTarifas.length > 0 && envio.ciudad_entrega) {
                const zonePrice = matchZoneIn(envio.ciudad_entrega, allZoneTarifas);
                if (zonePrice !== null) precio = zonePrice;
              }
            }
          }
          totalEnvios += precio;
        }

        const totalPagos = paymentsBySeller.get(seller.id) || 0;
        balances[seller.id] = {
          totalEnvios,
          totalPagos,
          cantEnvios: allSellerEnvioIds.filter(id => {
            const e = enviosMap.get(id);
            if (!e) return false;
            if (e.estado === 'pendiente') return false;
            if (e.estado === 'cancelado' && !balanceEnviosConVisitas.has(e.id)) return false;
            return true;
          }).length,
          saldoCalculado: totalEnvios - totalPagos,
        };
      }

      return balances;
    },
    enabled: !!tenantId && !!sellers && sellers.length > 0,
    refetchOnWindowFocus: false,
  });


  // Fetch liquidaciones
  const { data: liquidaciones, isLoading: loadingLiquidaciones } = useQuery({
    queryKey: ['seller-liquidaciones', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liquidaciones_seller')
        .select(`
          *,
          seller:ecommerce_sellers(nombre)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SellerLiquidacion[];
    },
    enabled: !!tenantId,
    refetchOnWindowFocus: false,
  });

  // Calculate mutation - now includes envíos and multi-seller
  const calculateMutation = useMutation({
    mutationFn: async () => {
      if (calcSellers.length === 0) throw new Error('Seleccione al menos un seller');

      const fechaInicioStr = format(fechaInicio, 'yyyy-MM-dd');
      const fechaFinStr = format(fechaFin, 'yyyy-MM-dd') + 'T23:59:59';

      let allMovs: any[] = [];
      let allEnvios: CalculatedEnvio[] = [];

      // Collect unique cliente_ids from selected sellers
      const selectedSellerObjs = sellers?.filter(s => calcSellers.includes(s.id)) || [];
      const uniqueClienteIds = [...new Set(selectedSellerObjs.map(s => s.cliente_id).filter(Boolean))] as string[];

      // 1. Fetch movimientos for all selected sellers
      for (const sellerId of calcSellers) {
        const { data: movs, error } = await supabase
          .from('seller_cuenta_corriente')
          .select('*')
          .eq('seller_id', sellerId)
          .gte('created_at', fechaInicioStr)
          .lte('created_at', fechaFinStr)
          .is('liquidacion_id', null)
          .order('created_at', { ascending: true });

        if (error) throw error;
        allMovs = [...allMovs, ...(movs || [])];
      }

      // 2. Buscar envíos de ecommerce_orders filtrados por fecha_entrega_estimada (fecha de reparto)
      const { data: sellerOrdersWithSeller, error: ordersError } = await supabase
        .from('ecommerce_orders')
        .select('envio_id, seller_id')
        .in('seller_id', calcSellers)
        .not('envio_id', 'is', null)
        .gte('fecha_entrega_estimada', fechaInicioStr)
        .lte('fecha_entrega_estimada', fechaFinStr);

      if (ordersError) throw ordersError;

      const sellerEnvioIds = (sellerOrdersWithSeller || [])
        .map(o => o.envio_id)
        .filter((id): id is string => id !== null);

      // Build envioToSellerMap from ecommerce orders
      const envioToSellerMap = new Map<string, string>();
      (sellerOrdersWithSeller || []).forEach(o => {
        if (o.envio_id) envioToSellerMap.set(o.envio_id, o.seller_id);
      });

      // Cargar los envíos de ecommerce_orders (ya filtrados por fecha de reparto)
      let ecommerceEnvios: any[] = [];
      if (sellerEnvioIds.length > 0) {
        const { data: ecomEnvios, error: ecomError } = await (supabase
          .from('envios') as any)
          .select('id, tracking_number, nombre_destinatario, direccion_entrega, ciudad_entrega, precio_total, precio_tarifa_vigente, estado, created_at, liquidacion_seller_id, tarifa_id, cantidad_bultos, destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido)')
          .in('id', sellerEnvioIds)
          .order('created_at', { ascending: true });

        if (ecomError) throw ecomError;
        ecommerceEnvios = ecomEnvios || [];
      }

      // 3. Buscar TODOS los envio_ids de ecommerce_orders relacionados (para excluirlos de comunes)
      // Necesitamos ALL orders (no solo las del rango) para evitar que aparezcan como envíos comunes
      const { data: allSellerOrders } = await supabase
        .from('ecommerce_orders')
        .select('envio_id')
        .in('seller_id', calcSellers)
        .not('envio_id', 'is', null);
      const allOrderEnvioIds = new Set((allSellerOrders || []).map(o => o.envio_id).filter((id): id is string => id !== null));

      // 4. Envíos comunes (sin orden e-commerce) por remitente_id — SOLO si hay cliente_ids
      let filteredCommonEnvios: any[] = [];
      if (uniqueClienteIds.length > 0) {
        // Count how many sellers in the FULL list share each cliente_id
        const clienteIdFullCount = new Map<string, number>();
        (sellers || []).forEach(s => {
          if (s.cliente_id) {
            clienteIdFullCount.set(s.cliente_id, (clienteIdFullCount.get(s.cliente_id) || 0) + 1);
          }
        });
        // Only use cliente_ids that belong to exactly one seller (avoid ambiguity)
        const uniqueOnlyClienteIds = uniqueClienteIds.filter(cid => (clienteIdFullCount.get(cid) || 0) <= 1);

        if (uniqueOnlyClienteIds.length > 0) {
          // Query 1: envíos comunes filtrados por fecha_entrega en el rango
          const { data: commonEnvios, error: commonError } = await supabase
            .from('envios')
            .select('id, tracking_number, nombre_destinatario, direccion_entrega, ciudad_entrega, precio_total, precio_tarifa_vigente, estado, created_at, liquidacion_seller_id, tarifa_id, cantidad_bultos, destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido)')
            .in('remitente_id', uniqueOnlyClienteIds)
            .gte('fecha_entrega', fechaInicioStr)
            .lte('fecha_entrega', fechaFinStr)
            .order('created_at', { ascending: true });

          if (commonError) throw commonError;

          // Query 2: envíos sin fecha_entrega, filtrados por created_at en el rango
          const { data: commonEnviosNoDate, error: commonNoDateError } = await (supabase
            .from('envios') as any)
            .select('id, tracking_number, nombre_destinatario, direccion_entrega, ciudad_entrega, precio_total, precio_tarifa_vigente, estado, created_at, liquidacion_seller_id, destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido)')
            .in('remitente_id', uniqueOnlyClienteIds)
            .is('fecha_entrega', null)
            .gte('created_at', fechaInicioStr)
            .lte('created_at', fechaFinStr)
            .order('created_at', { ascending: true });

          if (commonNoDateError) throw commonNoDateError;

          // Combinar sin duplicados
          const commonEnvioIds = new Set((commonEnvios || []).map((e: any) => e.id));
          const mergedCommonEnvios = [
            ...(commonEnvios || []),
            ...(commonEnviosNoDate || []).filter((e: any) => !commonEnvioIds.has(e.id))
          ];

          // Filtrar envíos comunes: excluir los que están vinculados a cualquier orden e-commerce
          filteredCommonEnvios = mergedCommonEnvios.filter(e => !allOrderEnvioIds.has(e.id));

          // Map common envios to their seller via cliente_id
          const clienteIdToSellerId = new Map<string, string>();
          selectedSellerObjs.forEach(s => {
            if (s.cliente_id && uniqueOnlyClienteIds.includes(s.cliente_id)) {
              clienteIdToSellerId.set(s.cliente_id, s.id);
            }
          });
          // We'd need remitente_id from commonEnvios to map back — use first seller as fallback
          filteredCommonEnvios.forEach(e => {
            if (!envioToSellerMap.has(e.id)) {
              envioToSellerMap.set(e.id, calcSellers[0]);
            }
          });
        }
      }

      // 4b. Tercera fuente: envíos referenciados en seller_cuenta_corriente (tipo cargo) — cargados desde planificador/terciarizados
      let ctaCteEnvios: any[] = [];
      {
        const { data: ctaCteMovs } = await supabase
          .from('seller_cuenta_corriente')
          .select('envio_id, seller_id')
          .in('seller_id', calcSellers)
          .eq('tipo', 'cargo')
          .not('envio_id', 'is', null)
          .gte('created_at', fechaInicioStr)
          .lte('created_at', fechaFinStr);

        const alreadyIncluded = new Set([
          ...sellerEnvioIds,
          ...filteredCommonEnvios.map(e => e.id),
        ]);

        const ctaCteEnvioIds = [...new Set(
          (ctaCteMovs || [])
            .map(m => m.envio_id)
            .filter((id): id is string => !!id && !alreadyIncluded.has(id))
        )];

        if (ctaCteEnvioIds.length > 0) {
          const { data: fetchedEnvios } = await (supabase
            .from('envios') as any)
            .select('id, tracking_number, nombre_destinatario, direccion_entrega, ciudad_entrega, precio_total, precio_tarifa_vigente, estado, created_at, liquidacion_seller_id, destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido)')
            .in('id', ctaCteEnvioIds)
            .order('created_at', { ascending: true });

          ctaCteEnvios = fetchedEnvios || [];

          // Map to seller
          const ctaCteSellerMap = new Map<string, string>();
          (ctaCteMovs || []).forEach(m => {
            if (m.envio_id && !ctaCteSellerMap.has(m.envio_id)) {
              ctaCteSellerMap.set(m.envio_id, m.seller_id);
            }
          });
          ctaCteEnvios.forEach(e => {
            if (!envioToSellerMap.has(e.id)) {
              envioToSellerMap.set(e.id, ctaCteSellerMap.get(e.id) || calcSellers[0]);
            }
          });
        }
      }

      {
        // 5: Combinar los tres conjuntos sin duplicados
        const ecommerceIds = new Set(ecommerceEnvios.map(e => e.id));
        const commonIds = new Set(filteredCommonEnvios.map(e => e.id));
        const uniqueCommon = filteredCommonEnvios.filter(e => !ecommerceIds.has(e.id));
        const uniqueCtaCte = ctaCteEnvios.filter(e => !ecommerceIds.has(e.id) && !commonIds.has(e.id));
        const allEnviosData = [...ecommerceEnvios, ...uniqueCommon, ...uniqueCtaCte]
          .filter(e => e.estado !== 'pendiente');

        // 5b: Batch query visitas for cancelled shipments
        const cancelledIds = allEnviosData
          .filter(e => e.estado === 'cancelado')
          .map(e => e.id);
        
        let enviosConVisitas = new Set<string>();
        if (cancelledIds.length > 0) {
          const { data: visitasData } = await supabase
            .from('envio_historial')
            .select('envio_id')
            .in('envio_id', cancelledIds)
            .in('estado_nuevo', ['en_reparto', 'no_entregado'] as any[]);
          enviosConVisitas = new Set((visitasData || []).map(v => v.envio_id));
        }
        // Collect unique tarifa_ids from selected sellers
        const sellerTarifaMap = new Map<string, string | null>();
        selectedSellerObjs.forEach(s => sellerTarifaMap.set(s.id, s.tarifa_id));

        const uniqueTarifaIds = [...new Set(
          selectedSellerObjs.map(s => s.tarifa_id).filter((id): id is string => !!id)
        )];

        // Fetch assigned tarifas
        let tarifasMap = new Map<string, any>();
        if (uniqueTarifaIds.length > 0) {
          const { data: tarifasData } = await supabase
            .from('tarifas')
            .select('id, precio_base, zona_destino, nombre, tipo_tarifa')
            .in('id', uniqueTarifaIds);

          (tarifasData || []).forEach(t => tarifasMap.set(t.id, t));
        }

        // Fetch all zone tarifas for the tenant — split into exclusive and general
        const { data: zoneTarifasData } = await supabase
          .from('tarifas')
          .select('id, precio_base, zona_destino, nombre, seller_exclusivo_id')
          .eq('tenant_id', tenantId)
          .eq('tipo_tarifa', 'zona')
          .eq('activa', true);
        const allZoneTarifasRaw = zoneTarifasData || [];
        const mutExclusiveBySeller = new Map<string, any[]>();
        allZoneTarifasRaw.filter(t => t.seller_exclusivo_id).forEach(t => {
          const list = mutExclusiveBySeller.get(t.seller_exclusivo_id!) || [];
          list.push(t);
          mutExclusiveBySeller.set(t.seller_exclusivo_id!, list);
        });
        const allZoneTarifas = allZoneTarifasRaw.filter(t => !t.seller_exclusivo_id);

        // Fetch basic concepts for all tarifas (assigned + zone)
        const allTarifaIdsForConcepts = [...new Set([
          ...uniqueTarifaIds,
          ...allZoneTarifasRaw.map(t => t.id),
        ])];
        const conceptosByTarifa = new Map<string, { nombre: string; monto: number; es_porcentaje: boolean; porcentaje: number; multiplicar_por_bultos: boolean }[]>();
        if (allTarifaIdsForConcepts.length > 0) {
          const { data: conceptoPreciosData } = await supabase
            .from('tarifa_concepto_precios')
            .select('tarifa_id, monto, es_porcentaje, porcentaje, multiplicar_por_bultos, concepto:tarifa_conceptos!inner(nombre, es_basico, activo)')
            .in('tarifa_id', allTarifaIdsForConcepts);

          (conceptoPreciosData || []).forEach((cp: any) => {
            const concepto = cp.concepto;
            if (!concepto || !concepto.activo || !concepto.es_basico) return;
            const list = conceptosByTarifa.get(cp.tarifa_id) || [];
            list.push({
              nombre: concepto.nombre,
              monto: cp.monto || 0,
              es_porcentaje: cp.es_porcentaje || false,
              porcentaje: cp.porcentaje || 0,
              multiplicar_por_bultos: cp.multiplicar_por_bultos || false,
            });
            conceptosByTarifa.set(cp.tarifa_id, list);
          });
        }

        const normalize = (str: string) => str.toLowerCase().trim()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        allEnvios = allEnviosData.map((e: any) => {
          let precioFinal = e.precio_total || 0;
          let precioCalculado = false;
          let zonaMatch: string | null = null;
          let matchedTarifaId: string | null = null;
          let conceptosAdicionales: ConceptoAdicional[] = [];

          // Priority: use frozen price if available
          if (e.precio_tarifa_vigente != null && e.precio_tarifa_vigente > 0) {
            precioFinal = e.precio_tarifa_vigente;
            precioCalculado = true;
            zonaMatch = 'Precio congelado';
            // Try to find the tarifa for concepts — use envio's tarifa_id or seller's assigned tarifa
            matchedTarifaId = e.tarifa_id || null;
            if (!matchedTarifaId) {
              const ownerSellerId = envioToSellerMap.get(e.id) || calcSellers[0];
              matchedTarifaId = sellerTarifaMap.get(ownerSellerId) || null;
            }
          } else if (precioFinal > 0) {
            precioCalculado = false;
            zonaMatch = null;
            matchedTarifaId = e.tarifa_id || null;
            if (!matchedTarifaId) {
              const ownerSellerId = envioToSellerMap.get(e.id) || calcSellers[0];
              matchedTarifaId = sellerTarifaMap.get(ownerSellerId) || null;
            }
          } else {
            const ownerSellerId = envioToSellerMap.get(e.id) || calcSellers[0];
            const sellerTarifaId = sellerTarifaMap.get(ownerSellerId);

            const matchZoneIn = (ciudad: string, tarifaList: any[]): { precio: number; zona: string; tarifaId: string } | null => {
              if (!ciudad || tarifaList.length === 0) return null;
              const ciudadNorm = normalize(ciudad);
              for (const zt of tarifaList) {
                if (!zt.zona_destino) continue;
                const zonas = zt.zona_destino.split(',').map((z: string) => normalize(z.trim()));
                if (zonas.some((z: string) => z === ciudadNorm)) {
                  return { precio: zt.precio_base || 0, zona: zt.nombre || zt.zona_destino, tarifaId: zt.id };
                }
              }
              for (const zt of tarifaList) {
                if (!zt.zona_destino) continue;
                const zonas = zt.zona_destino.split(',').map((z: string) => normalize(z.trim()));
                if (zonas.some((z: string) => ciudadNorm.includes(z) || z.includes(ciudadNorm))) {
                  return { precio: zt.precio_base || 0, zona: zt.nombre || zt.zona_destino, tarifaId: zt.id };
                }
              }
              const fallback = tarifaList
                .filter(t => t.zona_destino && t.zona_destino.split(',').length > 3)
                .sort((a: any, b: any) => (b.zona_destino?.split(',').length || 0) - (a.zona_destino?.split(',').length || 0))[0];
              return fallback ? { precio: fallback.precio_base || 0, zona: `${fallback.nombre} (fallback)`, tarifaId: fallback.id } : null;
            };

            const sellerExclusives = mutExclusiveBySeller.get(ownerSellerId) || [];
            if (sellerExclusives.length > 0 && e.ciudad_entrega) {
              const match = matchZoneIn(e.ciudad_entrega, sellerExclusives);
              if (match) {
                precioFinal = match.precio;
                precioCalculado = true;
                zonaMatch = match.zona + ' (exclusiva)';
                matchedTarifaId = match.tarifaId;
              }
            }

            if (precioFinal === 0 && sellerTarifaId) {
              const tarifa = tarifasMap.get(sellerTarifaId);
              if (tarifa) {
                if (tarifa.tipo_tarifa === 'zona' && e.ciudad_entrega) {
                  const match = matchZoneIn(e.ciudad_entrega, allZoneTarifas);
                  if (match) {
                    precioFinal = match.precio;
                    precioCalculado = true;
                    zonaMatch = match.zona;
                    matchedTarifaId = match.tarifaId;
                  }
                } else {
                  precioFinal = tarifa.precio_base || 0;
                  precioCalculado = true;
                  zonaMatch = tarifa.nombre;
                  matchedTarifaId = tarifa.id;
                }
              }
            }
            
            if (precioFinal === 0 && allZoneTarifas.length > 0 && e.ciudad_entrega) {
              const match = matchZoneIn(e.ciudad_entrega, allZoneTarifas);
              if (match) {
                precioFinal = match.precio;
                precioCalculado = true;
                zonaMatch = match.zona;
                matchedTarifaId = match.tarifaId;
              }
            }
          }

          // Sum basic concepts from the matched tarifa
          if (matchedTarifaId) {
            const concepts = conceptosByTarifa.get(matchedTarifaId) || [];
            for (const c of concepts) {
              let montoConcepto = 0;
              if (c.es_porcentaje && c.porcentaje > 0) {
                montoConcepto = precioFinal * c.porcentaje / 100;
              } else {
                montoConcepto = c.monto;
              }
              if (c.multiplicar_por_bultos) {
                montoConcepto *= (e.cantidad_bultos || 1);
              }
              if (montoConcepto > 0) {
                conceptosAdicionales.push({ nombre: c.nombre, monto: Math.round(montoConcepto * 100) / 100 });
              }
            }
            const totalConceptos = conceptosAdicionales.reduce((sum, ca) => sum + ca.monto, 0);
            precioFinal += totalConceptos;
          }

          // Cancelado sin visitas = $0
          const tieneVisitas = e.estado === 'cancelado' ? enviosConVisitas.has(e.id) : true;
          if (e.estado === 'cancelado' && !tieneVisitas) {
            precioFinal = 0;
            conceptosAdicionales = [];
          }

          return {
            id: e.id,
            tracking_number: e.tracking_number,
            nombre_destinatario: e.nombre_destinatario,
            direccion_entrega: e.direccion_entrega,
            ciudad_entrega: e.ciudad_entrega,
            precio_total: precioFinal,
            precio_original: e.precio_total || 0,
            precio_calculado: precioCalculado,
            zona_match: zonaMatch,
            estado: e.estado,
            created_at: e.created_at,
            tiene_visitas: tieneVisitas,
            destinatario: e.destinatario || null,
            estado_liquidacion: e.liquidacion_seller_id ? 'liquidado' as const : 'a_liquidar' as const,
            conceptos_adicionales: conceptosAdicionales,
          };
        });
      }

      const totalCargos = allMovs
        .filter(m => m.tipo === 'cargo')
        .reduce((sum, m) => sum + (m.monto || 0), 0);

      const totalPagos = allMovs
        .filter(m => m.tipo === 'pago')
        .reduce((sum, m) => sum + Math.abs(m.monto || 0), 0);

      const totalAjustes = allMovs
        .filter(m => m.tipo === 'ajuste')
        .reduce((sum, m) => sum + (m.monto || 0), 0);

      const totalEnvios = allEnvios.filter(e => e.estado_liquidacion === 'a_liquidar').reduce((sum, e) => sum + (e.precio_total || 0), 0);

      const saldoPeriodo = totalCargos + totalEnvios - totalPagos + totalAjustes;
      const saldoAnterior = allMovs[0]?.saldo_anterior || 0;

      return {
        movements: allMovs,
        envios: allEnvios,
        totals: {
          totalCargos,
          totalPagos,
          saldoPeriodo,
          saldoAnterior,
          totalEnvios,
        },
      };
    },
    onSuccess: (data) => {
      setCalculatedMovements(data.movements);
      setCalculatedEnvios(data.envios);
      setCalculatedTotals(data.totals);
      setExcludedEnvioIds(new Set());
      if (data.envios.filter(e => e.estado_liquidacion === 'a_liquidar').length === 0) {
        toast.info(data.envios.length > 0 
          ? 'Todos los envíos del período ya están liquidados' 
          : 'No hay envíos en el período seleccionado');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Generate liquidacion mutation - creates one per selected seller
  const generateMutation = useMutation({
    mutationFn: async () => {
      const pendingEnvios = calculatedEnvios.filter(e => e.estado_liquidacion === 'a_liquidar' && !excludedEnvioIds.has(e.id));
      if (calcSellers.length === 0 || pendingEnvios.length === 0) {
        throw new Error('No hay envíos para liquidar');
      }

      const createdLiquidaciones: any[] = [];

      for (const sellerId of calcSellers) {
        const seller = sellers?.find(s => s.id === sellerId);
        
        // Filter movements for this seller
        const sellerMovs = calculatedMovements.filter(m => (m as any).seller_id === sellerId);
        // For envíos we assign all to first seller (they share cliente_id)
        const isFirstSeller = sellerId === calcSellers[0];
        const sellerEnvios = isFirstSeller ? pendingEnvios : [];

        const sellerTotalCargos = sellerMovs
          .filter(m => m.tipo === 'cargo')
          .reduce((sum, m) => sum + (m.monto || 0), 0);
        const sellerTotalPagos = sellerMovs
          .filter(m => m.tipo === 'pago')
          .reduce((sum, m) => sum + Math.abs(m.monto || 0), 0);
        const sellerTotalEnvios = sellerEnvios.reduce((sum, e) => sum + (e.precio_total || 0), 0);

        // Skip if no data for this seller
        if (sellerMovs.length === 0 && sellerEnvios.length === 0) continue;

        const sellerNames = calcSellers.length > 1
          ? `Liquidación conjunta: ${sellers?.filter(s => calcSellers.includes(s.id)).map(s => s.nombre).join(', ')}`
          : null;

        const { data: liquidacion, error: liqError } = await supabase
          .from('liquidaciones_seller')
          .insert({
            seller_id: sellerId,
            periodo_inicio: format(fechaInicio, 'yyyy-MM-dd'),
            periodo_fin: format(fechaFin, 'yyyy-MM-dd'),
            total_cargos: sellerTotalEnvios,
            total_pagos: sellerTotalPagos,
            saldo_periodo: sellerTotalEnvios - sellerTotalPagos,
            saldo_anterior: sellerMovs[0]?.saldo_anterior || 0,
            saldo_final: (sellerMovs[0]?.saldo_anterior || 0) + sellerTotalEnvios - sellerTotalPagos,
            cantidad_movimientos: sellerMovs.length + sellerEnvios.length,
            estado: 'generada',
            notas: [notas, sellerNames].filter(Boolean).join(' | ') || null,
            generado_por: user?.id,
            tenant_id: profile?.tenant_id,
          })
          .select()
          .single();

        if (liqError) throw liqError;
        createdLiquidaciones.push(liquidacion);

        // Link movements
        if (sellerMovs.length > 0) {
          const movIds = sellerMovs.map(m => m.id);
          const { error: updateError } = await supabase
            .from('seller_cuenta_corriente')
            .update({ liquidacion_id: liquidacion.id })
            .in('id', movIds);
          if (updateError) throw updateError;
        }

        // Link envíos
        if (sellerEnvios.length > 0) {
          for (const envio of sellerEnvios) {
            // Guard: skip pendiente (defensive, shouldn't arrive here)
            if (envio.estado === 'pendiente') continue;
            const updateData: any = { liquidacion_seller_id: liquidacion.id };
            // Cancelado sin visitas: forzar precio_total = 0
            if (envio.estado === 'cancelado' && envio.tiene_visitas === false) {
              updateData.precio_total = 0;
              updateData.tarifa_metodo_aplicado = 'cancelado_sin_visitas';
            } else if (envio.precio_calculado && envio.precio_total > 0) {
              updateData.precio_total = envio.precio_total;
              updateData.tarifa_metodo_aplicado = 'zona_liquidacion';
            }
            await (supabase.from('envios') as any)
              .update(updateData)
              .eq('id', envio.id);
          }
        }
      }

      return createdLiquidaciones;
    },
    onSuccess: (data) => {
      toast.success(`${data.length} liquidación(es) generada(s) correctamente`);
      setCalculatedMovements([]);
      setCalculatedEnvios([]);
      setCalculatedTotals(null);
      setNotas('');
      queryClient.invalidateQueries({ queryKey: ['seller-liquidaciones'] });
      queryClient.invalidateQueries({ queryKey: ['seller-movements'] });
    },
    onError: (error: Error) => {
      toast.error(`Error al generar: ${error.message}`);
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('liquidaciones_seller')
        .update({ 
          estado: 'aprobada',
          aprobado_por: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Liquidación aprobada');
      queryClient.invalidateQueries({ queryKey: ['seller-liquidaciones'] });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Pay mutation
  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payingLiquidacion) throw new Error('No hay liquidación seleccionada');

      // Acción 1: Actualizar estado de la liquidación
      const { error } = await supabase
        .from('liquidaciones_seller')
        .update({
          estado: 'pagada',
          metodo_pago: payMetodo,
          referencia_pago: payReferencia || null,
          fecha_pago: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payingLiquidacion.id);

      if (error) throw error;

      // Acción 2: Registrar movimiento en cuenta corriente del seller
      const montoPago = Math.abs(payingLiquidacion.saldo_periodo || 0);
      if (montoPago > 0) {
        // Obtener saldo actual del seller
        const { data: sellerData, error: sellerError } = await supabase
          .from('ecommerce_sellers')
          .select('saldo_cuenta_corriente')
          .eq('id', payingLiquidacion.seller_id)
          .single();

        if (!sellerError && sellerData) {
          const saldoAnterior = sellerData.saldo_cuenta_corriente || 0;
          const saldoNuevo = saldoAnterior - montoPago;

          const periodoFormateado = payingLiquidacion.periodo_inicio
            ? `${format(parseDateString(payingLiquidacion.periodo_inicio), 'MM/yyyy', { locale: es })}`
            : '';

          await supabase.from('seller_cuenta_corriente').insert({
            seller_id: payingLiquidacion.seller_id,
            tipo: 'pago',
            monto: -montoPago,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: saldoNuevo,
            descripcion: `Pago liquidación período ${periodoFormateado}`,
            referencia: payReferencia || null,
            metodo_pago: payMetodo,
            liquidacion_id: payingLiquidacion.id,
            created_by: user?.id,
          });

          // Actualizar saldo en ecommerce_sellers
          await supabase
            .from('ecommerce_sellers')
            .update({ saldo_cuenta_corriente: saldoNuevo })
            .eq('id', payingLiquidacion.seller_id);

          // Acción 3: Si método = efectivo → registrar egreso en caja activa
          if (payMetodo === 'efectivo' && profile?.sucursal_id) {
            const { data: sesion } = await supabase
              .from('sesiones_caja')
              .select('id')
              .eq('estado', 'abierta')
              .eq('sucursal_id', profile.sucursal_id)
              .order('fecha_apertura', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (sesion) {
              await supabase.from('movimientos_caja').insert({
                sesion_caja_id: sesion.id,
                tipo: 'ingreso',
                concepto: `Cobro liquidación seller: ${payingLiquidacion.seller?.nombre || ''}`,
                monto: montoPago,
                metodo_pago: 'efectivo' as any,
                referencia: payReferencia || payingLiquidacion.id,
                created_by: user?.id,
              });
            }
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('Pago registrado correctamente');
      setPayDialogOpen(false);
      setPayingLiquidacion(null);
      setPayMetodo('transferencia');
      setPayReferencia('');
      queryClient.invalidateQueries({ queryKey: ['seller-liquidaciones'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers-cta-cte'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
      queryClient.invalidateQueries({ queryKey: ['seller-movements', payingLiquidacion?.seller_id] });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Cancel mutation - now also unlinks envíos
  const cancelMutation = useMutation({
    mutationFn: async (liquidacion: SellerLiquidacion) => {
      // Unlink movements
      const { error: unlinkError } = await supabase
        .from('seller_cuenta_corriente')
        .update({ liquidacion_id: null })
        .eq('liquidacion_id', liquidacion.id);

      if (unlinkError) throw unlinkError;

      // Unlink envíos
      const { error: unlinkEnviosError } = await (supabase
        .from('envios') as any)
        .update({ liquidacion_seller_id: null })
        .eq('liquidacion_seller_id', liquidacion.id);

      if (unlinkEnviosError) throw unlinkEnviosError;

      // Delete liquidacion
      const { error: deleteError } = await supabase
        .from('liquidaciones_seller')
        .delete()
        .eq('id', liquidacion.id);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      toast.success('Liquidación cancelada');
      setCancelDialogOpen(false);
      setCancelingLiquidacion(null);
      queryClient.invalidateQueries({ queryKey: ['seller-liquidaciones'] });
      queryClient.invalidateQueries({ queryKey: ['seller-movements'] });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Stats - use recalculated balances when available
  const stats = {
    totalSaldo: sellers?.reduce((acc, s) => {
      const bal = sellerBalances?.[s.id];
      return acc + (bal?.saldoCalculado ?? s.saldo_cuenta_corriente ?? 0);
    }, 0) || 0,
    sellersConDeuda: sellers?.filter(s => {
      const bal = sellerBalances?.[s.id];
      return (bal?.saldoCalculado ?? s.saldo_cuenta_corriente ?? 0) > 0;
    }).length || 0,
    sellersAFavor: sellers?.filter(s => {
      const bal = sellerBalances?.[s.id];
      return (bal?.saldoCalculado ?? s.saldo_cuenta_corriente ?? 0) < 0;
    }).length || 0,
  };


  const getEstadoBadge = (estado: string | null) => {
    switch (estado) {
      case 'generada':
        return <Badge variant="secondary">Generada</Badge>;
      case 'aprobada':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Aprobada</Badge>;
      case 'pagada':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pagada</Badge>;
      case 'cancelada':
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{estado || 'Pendiente'}</Badge>;
    }
  };

  const hasCalculatedData = calculatedMovements.length > 0 || calculatedEnvios.length > 0;

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Liquidaciones Sellers</h1>
          <p className="text-muted-foreground">Gestiona los saldos y pagos de sellers e-commerce</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.totalSaldo.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Saldo Total a Cobrar</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sellersConDeuda}</p>
                <p className="text-xs text-muted-foreground">Sellers con Deuda</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingDown className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sellersAFavor}</p>
                <p className="text-xs text-muted-foreground">Sellers a Favor</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sellers">Saldos por Seller</TabsTrigger>
          <TabsTrigger value="liquidaciones">Liquidaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="sellers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cuenta Corriente por Seller</CardTitle>
              <CardDescription>Saldos recalculados usando tarifa asignada a cada seller</CardDescription>
            </CardHeader>
            <CardContent>
              {(loadingSellers || loadingBalances) ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Seller</TableHead>
                      <TableHead className="text-right">Envíos</TableHead>
                      <TableHead className="text-right">Total (tarifa)</TableHead>
                      <TableHead className="text-right">Pagos</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellers?.map((seller) => {
                      const bal = sellerBalances?.[seller.id];
                      const saldo = bal?.saldoCalculado ?? seller.saldo_cuenta_corriente ?? 0;
                      return (
                        <TableRow key={seller.id}>
                          <TableCell className="font-medium">{seller.nombre}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {bal?.cantEnvios ?? '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${bal?.totalEnvios?.toLocaleString() ?? '-'}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            ${bal?.totalPagos?.toLocaleString() ?? '0'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={saldo > 0 ? 'text-orange-600 font-semibold' : saldo < 0 ? 'text-green-600 font-semibold' : ''}>
                              ${saldo.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setActiveSeller(seller);
                                setSettlementDialogOpen(true);
                              }}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Registrar Pago
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {sellers?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No hay sellers con cuenta corriente
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="liquidaciones" className="mt-4 space-y-6">
          {/* Calculator Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Generar Nueva Liquidación
              </CardTitle>
              <CardDescription>
                Seleccione un seller y período para calcular envíos a liquidar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Sellers ({calcSellers.length} seleccionados)</Label>
                  <Popover open={sellerPopoverOpen} onOpenChange={setSellerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {calcSellers.length === 0
                          ? 'Seleccionar sellers...'
                          : calcSellers.length === 1
                            ? sellers?.find(s => s.id === calcSellers[0])?.nombre || '1 seller'
                            : `${calcSellers.length} sellers`
                        }
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-2" align="start">
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {sellers?.map((s) => (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={calcSellers.includes(s.id)}
                              onCheckedChange={(checked) => {
                                setCalcSellers(prev =>
                                  checked
                                    ? [...prev, s.id]
                                    : prev.filter(id => id !== s.id)
                                );
                              }}
                            />
                            <span className="truncate">{s.nombre}</span>
                          </label>
                        ))}
                      </div>
                      {calcSellers.length > 0 && (
                        <div className="border-t mt-2 pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => setCalcSellers([])}
                          >
                            Limpiar selección
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  {calcSellers.length > 1 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {calcSellers.map(id => {
                        const s = sellers?.find(s => s.id === id);
                        return (
                          <Badge key={id} variant="secondary" className="text-xs">
                            {s?.nombre}
                            <button
                              className="ml-1 hover:text-destructive"
                              onClick={() => setCalcSellers(prev => prev.filter(sid => sid !== id))}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Fecha Inicio</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fechaInicio && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaInicio ? format(fechaInicio, 'dd/MM/yyyy') : 'Seleccionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaInicio}
                        onSelect={(date) => date && setFechaInicio(date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Fecha Fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fechaFin && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaFin ? format(fechaFin, 'dd/MM/yyyy') : 'Seleccionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaFin}
                        onSelect={(date) => date && setFechaFin(date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button 
                    onClick={() => calculateMutation.mutate()} 
                    disabled={calcSellers.length === 0 || calculateMutation.isPending}
                    className="w-full"
                  >
                    {calculateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Calculator className="mr-2 h-4 w-4" />
                    )}
                    Calcular
                  </Button>
                </div>
              </div>

              {/* Results */}
              {calculatedTotals && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(() => {
                      const includedEnvios = calculatedEnvios.filter(e => e.estado_liquidacion === 'a_liquidar' && !excludedEnvioIds.has(e.id));
                      const excludedCount = excludedEnvioIds.size;
                      const liquidadosCount = calculatedEnvios.filter(e => e.estado_liquidacion === 'liquidado').length;
                      const totalEnviosIncluded = includedEnvios.reduce((sum, e) => sum + (e.precio_total || 0), 0);
                      const saldoPeriodoCalc = calculatedTotals.totalCargos + totalEnviosIncluded - calculatedTotals.totalPagos;
                      return (
                        <>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">Envíos</p>
                            <p className="text-xl font-bold">
                              {includedEnvios.length}
                              {(liquidadosCount > 0 || excludedCount > 0) && (
                                <span className="text-sm font-normal text-muted-foreground ml-1">
                                  {liquidadosCount > 0 && `+${liquidadosCount} liq.`}
                                  {excludedCount > 0 && ` -${excludedCount} excl.`}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">Total Envíos</p>
                            <p className="text-xl font-bold text-orange-600">
                              ${totalEnviosIncluded.toLocaleString()}
                            </p>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">Total Pagos</p>
                            <p className="text-xl font-bold text-green-600">
                              ${calculatedTotals.totalPagos.toLocaleString()}
                            </p>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">Saldo Período</p>
                            <p className={`text-xl font-bold ${saldoPeriodoCalc > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              ${saldoPeriodoCalc.toLocaleString()}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {hasCalculatedData && (
                    <>
                      <div className="max-h-48 overflow-y-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8">
                                {(() => {
                                  const pendingEnvios = calculatedEnvios.filter(e => e.estado_liquidacion === 'a_liquidar');
                                  const allIncluded = pendingEnvios.length > 0 && pendingEnvios.every(e => !excludedEnvioIds.has(e.id));
                                  return (
                                    <Checkbox
                                      checked={allIncluded}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setExcludedEnvioIds(new Set());
                                        } else {
                                          setExcludedEnvioIds(new Set(pendingEnvios.map(e => e.id)));
                                        }
                                      }}
                                    />
                                  );
                                })()}
                              </TableHead>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Tracking</TableHead>
                              <TableHead>Destinatario</TableHead>
                              <TableHead>Ciudad</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Estado Liq.</TableHead>
                              <TableHead className="text-right">Precio</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {calculatedEnvios.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                                  {sellers?.some(s => calcSellers.includes(s.id) && s.cliente_id)
                                    ? 'No hay envíos en el período'
                                    : 'Sellers no tienen cliente vinculado'}
                                </TableCell>
                              </TableRow>
                            ) : (
                              calculatedEnvios.map((envio) => {
                                const isExcluded = excludedEnvioIds.has(envio.id);
                                const isPending = envio.estado_liquidacion === 'a_liquidar';
                                return (
                                <TableRow key={envio.id} className={cn(
                                  envio.precio_total === 0 && isPending && !isExcluded ? 'bg-destructive/5' : '',
                                  envio.estado_liquidacion === 'liquidado' ? 'opacity-60' : '',
                                  isExcluded ? 'opacity-40 line-through' : ''
                                )}>
                                  <TableCell>
                                    {isPending ? (
                                      <Checkbox
                                        checked={!isExcluded}
                                        onCheckedChange={(checked) => {
                                          const newSet = new Set(excludedEnvioIds);
                                          if (checked) {
                                            newSet.delete(envio.id);
                                          } else {
                                            newSet.add(envio.id);
                                          }
                                          setExcludedEnvioIds(newSet);
                                        }}
                                      />
                                    ) : null}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {format(new Date(envio.created_at), 'dd/MM/yy')}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">{envio.tracking_number}</TableCell>
                                  <TableCell className="text-sm">{envio.nombre_destinatario || (envio.destinatario ? `${envio.destinatario.nombre || ''} ${envio.destinatario.apellido || ''}`.trim() : '') || '-'}</TableCell>
                                  <TableCell className="text-sm">{envio.ciudad_entrega || '-'}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">{envio.estado || '-'}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {envio.estado_liquidacion === 'liquidado' ? (
                                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]">Liquidado</Badge>
                                    ) : (
                                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-[10px]">A liquidar</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {envio.estado_liquidacion === 'liquidado' || isExcluded ? (
                                        <span className="text-sm font-medium text-muted-foreground">${envio.precio_total.toLocaleString()}</span>
                                      ) : (
                                        <Input
                                          type="number"
                                          value={envio.precio_total}
                                          onChange={(e) => {
                                            const nuevoPrecio = parseFloat(e.target.value) || 0;
                                            const updated = calculatedEnvios.map(ev =>
                                              ev.id === envio.id ? { ...ev, precio_total: nuevoPrecio } : ev
                                            );
                                            setCalculatedEnvios(updated);
                                          }}
                                          className="w-24 h-7 text-right text-sm font-medium px-2"
                                        />
                                      )}
                                      {envio.precio_calculado && (
                                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                          Zona
                                        </Badge>
                                      )}
                                      {envio.precio_total === 0 && isPending && !isExcluded && (
                                        <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                          Sin precio
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="space-y-2">
                        <Label>Notas (opcional)</Label>
                        <Textarea
                          value={notas}
                          onChange={(e) => setNotas(e.target.value)}
                          placeholder="Agregar notas a la liquidación..."
                          rows={2}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button 
                          onClick={() => generateMutation.mutate()}
                          disabled={generateMutation.isPending}
                        >
                          {generateMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          Generar Liquidación
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* History Card */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Liquidaciones</CardTitle>
              <CardDescription>Liquidaciones generadas para sellers</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLiquidaciones ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead className="text-right">Cargos</TableHead>
                      <TableHead className="text-right">Pagos</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liquidaciones?.map((liq) => (
                      <TableRow key={liq.id}>
                        <TableCell className="text-sm">
                          {format(parseDateString(liq.periodo_inicio), 'dd/MM')} - {format(parseDateString(liq.periodo_fin), 'dd/MM/yy')}
                        </TableCell>
                        <TableCell className="font-medium">{liq.seller?.nombre}</TableCell>
                        <TableCell className="text-right text-orange-600">
                          ${(liq.total_cargos || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          ${(liq.total_pagos || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${(liq.saldo_periodo || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          ${(liq.saldo_periodo || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>{getEstadoBadge(liq.estado)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedLiquidacion(liq);
                                setDetailDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadSellerSettlementPDF(liq)}
                              title="Descargar PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              title="Imprimir"
                            >
                              <a href={`/print-settlement?id=${liq.id}&type=seller`} target="_blank" rel="noopener noreferrer">
                                <Printer className="h-4 w-4" />
                              </a>
                            </Button>
                            {liq.estado === 'generada' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => approveMutation.mutate(liq.id)}
                                disabled={approveMutation.isPending}
                              >
                                <Check className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            {liq.estado === 'aprobada' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPayingLiquidacion(liq);
                                  setPayDialogOpen(true);
                                }}
                              >
                                <DollarSign className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            {liq.estado !== 'pagada' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCancelingLiquidacion(liq);
                                  setCancelDialogOpen(true);
                                }}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {liquidaciones?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No hay liquidaciones generadas
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settlement Dialog */}
      {activeSeller && (
        <SellerSettlementDialog
          open={settlementDialogOpen}
          onOpenChange={setSettlementDialogOpen}
          seller={activeSeller}
        />
      )}

      {/* Detail Dialog */}
      <SellerLiquidacionDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        liquidacion={selectedLiquidacion}
      />

      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago de Liquidación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={payMetodo} onValueChange={setPayMetodo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referencia (opcional)</Label>
              <Input
                value={payReferencia}
                onChange={(e) => setPayReferencia(e.target.value)}
                placeholder="Número de transferencia, cheque, etc."
              />
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Monto a pagar</p>
              <p className="text-2xl font-bold">
                ${Math.abs(payingLiquidacion?.saldo_periodo || 0).toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending}>
              {payMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Liquidación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de cancelar esta liquidación? Los envíos serán liberados y podrán incluirse en una nueva liquidación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelingLiquidacion && cancelMutation.mutate(cancelingLiquidacion)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
