import { useState } from 'react';
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
import { Search, DollarSign, TrendingUp, TrendingDown, Plus, Calculator, FileText, Eye, Check, X, CalendarIcon, Download, Loader2, Printer, Package, ChevronsUpDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
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
}

interface Movement {
  id: string;
  tipo: string;
  monto: number;
  saldo_anterior: number;
  saldo_nuevo: number;
  descripcion: string | null;
  referencia: string | null;
  created_at: string;
  liquidacion_id: string | null;
  seller: {
    nombre: string;
  };
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
  const [activeTab, setActiveTab] = useState('sellers');

  // Existing states
  const [search, setSearch] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
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
  const [previewTab, setPreviewTab] = useState('movimientos');
  const [notas, setNotas] = useState('');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLiquidacion, setSelectedLiquidacion] = useState<SellerLiquidacion | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingLiquidacion, setPayingLiquidacion] = useState<SellerLiquidacion | null>(null);
  const [payMetodo, setPayMetodo] = useState('transferencia');
  const [payReferencia, setPayReferencia] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelingLiquidacion, setCancelingLiquidacion] = useState<SellerLiquidacion | null>(null);

  // Fetch sellers with account
  const { data: sellers, isLoading: loadingSellers } = useQuery({
    queryKey: ['ecommerce-sellers-cta-cte', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_sellers')
        .select('id, nombre, saldo_cuenta_corriente, tiene_cuenta_corriente, cliente_id')
        .eq('tenant_id', tenantId)
        .eq('tiene_cuenta_corriente', true)
        .order('nombre');

      if (error) throw error;
      return data as Seller[];
    },
    enabled: !!tenantId,
  });

  // Fetch movements
  const { data: movements, isLoading: loadingMovements } = useQuery({
    queryKey: ['seller-movements', tenantId, selectedSeller],
    queryFn: async () => {
      let query = supabase
        .from('seller_cuenta_corriente')
        .select(`
          *,
          seller:ecommerce_sellers(nombre)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedSeller !== 'all') {
        query = query.eq('seller_id', selectedSeller);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Movement[];
    },
    enabled: !!tenantId,
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

      // 2. Fetch envíos using fecha_entrega_estimada for all related cliente_ids
      if (uniqueClienteIds.length > 0) {
        // Query principal: envíos por remitente_id matching any cliente_id
        const { data: enviosData, error: enviosError } = await supabase
          .from('envios')
          .select('id, tracking_number, nombre_destinatario, direccion_entrega, ciudad_entrega, precio_total, estado, created_at')
          .in('remitente_id', uniqueClienteIds)
          .gte('fecha_entrega_estimada', fechaInicioStr)
          .lte('fecha_entrega_estimada', fechaFinStr)
          .is('liquidacion_seller_id', null)
          .order('created_at', { ascending: true });

        if (enviosError) throw enviosError;

        // Fallback: buscar envíos via ecommerce_orders para sellers con mismo cliente_id
        const { data: relatedSellers } = await supabase
          .from('ecommerce_sellers')
          .select('id')
          .in('cliente_id', uniqueClienteIds)
          .eq('tenant_id', tenantId);

        const relatedSellerIds = (relatedSellers || []).map(s => s.id);
        let fallbackEnvios: any[] = [];

        if (relatedSellerIds.length > 0) {
          const { data: ordersWithEnvio } = await supabase
            .from('ecommerce_orders')
            .select('envio_id')
            .in('seller_id', relatedSellerIds)
            .not('envio_id', 'is', null);

          const envioIdsFromOrders = (ordersWithEnvio || [])
            .map(o => o.envio_id)
            .filter((id): id is string => id !== null);

          if (envioIdsFromOrders.length > 0) {
            const existingIds = new Set((enviosData || []).map(e => e.id));
            const missingIds = envioIdsFromOrders.filter(id => !existingIds.has(id));

            if (missingIds.length > 0) {
              const { data: extraEnvios } = await supabase
                .from('envios')
                .select('id, tracking_number, nombre_destinatario, direccion_entrega, ciudad_entrega, precio_total, estado, created_at')
                .in('id', missingIds)
                .gte('fecha_entrega_estimada', fechaInicioStr)
                .lte('fecha_entrega_estimada', fechaFinStr)
                .is('liquidacion_seller_id', null)
                .order('created_at', { ascending: true });

              fallbackEnvios = extraEnvios || [];
            }
          }
        }

        const allEnviosData = [...(enviosData || []), ...fallbackEnvios];

        // Fetch zone rates for recalculating $0 envíos
        const { data: zoneTarifas } = await supabase
          .from('tarifas')
          .select('id, precio_base, zona_destino, nombre')
          .eq('tenant_id', tenantId)
          .eq('tipo_tarifa', 'zona')
          .eq('activa', true);

        const normalize = (str: string) => str.toLowerCase().trim()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        allEnvios = allEnviosData.map((e: any) => {
          let precioFinal = e.precio_total || 0;
          let precioCalculado = false;
          let zonaMatch: string | null = null;

          if (precioFinal === 0 && e.ciudad_entrega && zoneTarifas && zoneTarifas.length > 0) {
            const ciudadNorm = normalize(e.ciudad_entrega);
            for (const tarifa of zoneTarifas) {
              if (!tarifa.zona_destino) continue;
              const zonas = tarifa.zona_destino.split(',').map((z: string) => normalize(z));
              for (const zona of zonas) {
                if (zona === ciudadNorm || ciudadNorm.includes(zona) || zona.includes(ciudadNorm)) {
                  precioFinal = tarifa.precio_base || 0;
                  precioCalculado = true;
                  zonaMatch = tarifa.nombre || tarifa.zona_destino;
                  break;
                }
              }
              if (precioFinal > 0) break;
            }
            if (precioFinal === 0) {
              const fallback = zoneTarifas
                .filter(t => t.zona_destino && t.zona_destino.split(',').length > 3)
                .sort((a, b) => (b.zona_destino?.split(',').length || 0) - (a.zona_destino?.split(',').length || 0))[0];
              if (fallback) {
                precioFinal = fallback.precio_base || 0;
                precioCalculado = true;
                zonaMatch = `${fallback.nombre} (fallback)`;
              }
            }
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

      const totalEnvios = allEnvios.reduce((sum, e) => sum + (e.precio_total || 0), 0);

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
      if (data.movements.length === 0 && data.envios.length === 0) {
        toast.info('No hay movimientos ni envíos sin liquidar en el período seleccionado');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Generate liquidacion mutation - creates one per selected seller
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (calcSellers.length === 0 || (calculatedMovements.length === 0 && calculatedEnvios.length === 0)) {
        throw new Error('No hay movimientos ni envíos para liquidar');
      }

      const createdLiquidaciones: any[] = [];

      for (const sellerId of calcSellers) {
        const seller = sellers?.find(s => s.id === sellerId);
        
        // Filter movements for this seller
        const sellerMovs = calculatedMovements.filter(m => (m as any).seller_id === sellerId);
        // For envíos we assign all to first seller (they share cliente_id)
        const isFirstSeller = sellerId === calcSellers[0];
        const sellerEnvios = isFirstSeller ? calculatedEnvios : [];

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
            total_cargos: sellerTotalCargos + sellerTotalEnvios,
            total_pagos: sellerTotalPagos,
            saldo_periodo: sellerTotalCargos + sellerTotalEnvios - sellerTotalPagos,
            saldo_anterior: sellerMovs[0]?.saldo_anterior || 0,
            saldo_final: seller?.saldo_cuenta_corriente || 0,
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
            const updateData: any = { liquidacion_seller_id: liquidacion.id };
            if (envio.precio_calculado && envio.precio_total > 0) {
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
    },
    onSuccess: () => {
      toast.success('Pago registrado correctamente');
      setPayDialogOpen(false);
      setPayingLiquidacion(null);
      setPayMetodo('transferencia');
      setPayReferencia('');
      queryClient.invalidateQueries({ queryKey: ['seller-liquidaciones'] });
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

  // Stats
  const stats = {
    totalSaldo: sellers?.reduce((acc, s) => acc + (s.saldo_cuenta_corriente || 0), 0) || 0,
    sellersConDeuda: sellers?.filter(s => s.saldo_cuenta_corriente > 0).length || 0,
    sellersAFavor: sellers?.filter(s => s.saldo_cuenta_corriente < 0).length || 0,
  };

  const filteredMovements = movements?.filter(m =>
    m.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
    m.referencia?.toLowerCase().includes(search.toLowerCase()) ||
    m.seller?.nombre.toLowerCase().includes(search.toLowerCase())
  );

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
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="liquidaciones">Liquidaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="sellers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cuenta Corriente por Seller</CardTitle>
              <CardDescription>Sellers con cuenta corriente habilitada</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSellers ? (
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
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellers?.map((seller) => (
                      <TableRow key={seller.id}>
                        <TableCell className="font-medium">{seller.nombre}</TableCell>
                        <TableCell className="text-right">
                          <span className={seller.saldo_cuenta_corriente > 0 ? 'text-orange-600 font-semibold' : seller.saldo_cuenta_corriente < 0 ? 'text-green-600 font-semibold' : ''}>
                            ${seller.saldo_cuenta_corriente?.toLocaleString() || '0'}
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
                    ))}
                    {sellers?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
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

        <TabsContent value="movements" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar movimiento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedSeller} onValueChange={setSelectedSeller}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por seller" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los sellers</SelectItem>
                {sellers?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingMovements ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements?.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-sm">
                          {format(new Date(mov.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell className="font-medium">{mov.seller?.nombre}</TableCell>
                        <TableCell>
                          <Badge variant={mov.tipo === 'cargo' ? 'default' : mov.tipo === 'pago' ? 'secondary' : 'outline'}>
                            {mov.tipo === 'cargo' ? 'Cargo' : mov.tipo === 'pago' ? 'Pago' : 'Ajuste'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {mov.descripcion || mov.referencia || '-'}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${mov.tipo === 'cargo' ? 'text-orange-600' : 'text-green-600'}`}>
                          {mov.tipo === 'cargo' ? '+' : '-'}${Math.abs(mov.monto).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">${mov.saldo_nuevo?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {filteredMovements?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No hay movimientos
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
                Seleccione un seller y período para calcular movimientos y envíos a liquidar
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
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Movimientos Cta.</p>
                      <p className="text-xl font-bold">{calculatedMovements.length}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Envíos</p>
                      <p className="text-xl font-bold">{calculatedEnvios.length}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Cargos + Envíos</p>
                      <p className="text-xl font-bold text-orange-600">
                        ${((calculatedTotals.totalCargos || 0) + (calculatedTotals.totalEnvios || 0)).toLocaleString()}
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
                      <p className={`text-xl font-bold ${calculatedTotals.saldoPeriodo > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        ${calculatedTotals.saldoPeriodo.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {hasCalculatedData && (
                    <>
                      <Tabs value={previewTab} onValueChange={setPreviewTab}>
                        <TabsList>
                          <TabsTrigger value="movimientos">
                            Movimientos Cta. Cte. ({calculatedMovements.length})
                          </TabsTrigger>
                          <TabsTrigger value="envios">
                            Envíos ({calculatedEnvios.length})
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="movimientos" className="mt-2">
                          <div className="max-h-48 overflow-y-auto border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Fecha</TableHead>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead>Descripción</TableHead>
                                  <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {calculatedMovements.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                      No hay movimientos de cuenta corriente en el período
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  calculatedMovements.map((mov) => (
                                    <TableRow key={mov.id}>
                                      <TableCell className="text-sm">
                                        {format(new Date(mov.created_at), 'dd/MM/yy')}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={mov.tipo === 'cargo' ? 'default' : 'secondary'} className="text-xs">
                                          {mov.tipo}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {mov.descripcion || mov.referencia || '-'}
                                      </TableCell>
                                      <TableCell className={`text-right font-medium ${mov.tipo === 'cargo' ? 'text-orange-600' : 'text-green-600'}`}>
                                        {mov.tipo === 'cargo' ? '+' : '-'}${Math.abs(mov.monto).toLocaleString()}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>

                        <TabsContent value="envios" className="mt-2">
                          <div className="max-h-48 overflow-y-auto border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Fecha</TableHead>
                                  <TableHead>Tracking</TableHead>
                                  <TableHead>Destinatario</TableHead>
                                  <TableHead>Ciudad</TableHead>
                                  <TableHead>Estado</TableHead>
                                  <TableHead className="text-right">Precio</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {calculatedEnvios.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                      {sellers?.some(s => calcSellers.includes(s.id) && s.cliente_id)
                                        ? 'No hay envíos sin liquidar en el período'
                                        : 'Sellers no tienen cliente vinculado'}
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  calculatedEnvios.map((envio) => (
                                    <TableRow key={envio.id} className={envio.precio_total === 0 ? 'bg-destructive/5' : ''}>
                                      <TableCell className="text-sm">
                                        {format(new Date(envio.created_at), 'dd/MM/yy')}
                                      </TableCell>
                                      <TableCell className="font-mono text-sm">{envio.tracking_number}</TableCell>
                                      <TableCell className="text-sm">{envio.nombre_destinatario || '-'}</TableCell>
                                      <TableCell className="text-sm">{envio.ciudad_entrega || '-'}</TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="text-xs">{envio.estado || '-'}</Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <span className={`font-medium ${envio.precio_total > 0 ? 'text-orange-600' : 'text-destructive'}`}>
                                            {envio.precio_total > 0 ? `+$${envio.precio_total.toLocaleString()}` : '$0'}
                                          </span>
                                          {envio.precio_calculado && (
                                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                              Zona
                                            </Badge>
                                          )}
                                          {envio.precio_total === 0 && (
                                            <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                              Sin precio
                                            </Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>
                      </Tabs>

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
                          {format(new Date(liq.periodo_inicio), 'dd/MM')} - {format(new Date(liq.periodo_fin), 'dd/MM/yy')}
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
              ¿Está seguro de cancelar esta liquidación? Los movimientos y envíos serán liberados y podrán incluirse en una nueva liquidación.
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
