import { useState, useCallback, useMemo, useRef } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Package, PackagePlus, Search, Filter, RefreshCw, Truck, Clock, CheckCircle, AlertCircle, Printer, XCircle, Eye, History, Shield, CalendarIcon, AlertTriangle, Handshake, CalendarClock, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { MLSyncBadge } from '@/components/shipments/MLSyncBadge';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { ShipmentHistoryDialog } from '@/components/shipments/ShipmentHistoryDialog';
import { ShipmentDetailsDialog } from '@/components/shipments/ShipmentDetailsDialog';
import { ChangeStatusDialog } from '@/components/shipments/ChangeStatusDialog';
import { DeriveShipmentDialog } from '@/components/partners/DeriveShipmentDialog';
import { parseDateString } from '@/lib/dateUtils';

type ShipmentStatus = Database['public']['Enums']['shipment_status'];

const statusConfig: Record<ShipmentStatus, { label: string; color: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500', icon: Clock },
  recogido: { label: 'Recogido', color: 'bg-blue-500', icon: Package },
  en_sucursal: { label: 'En Sucursal', color: 'bg-purple-500', icon: Package },
  en_bodega: { label: 'En Sucursal', color: 'bg-purple-500', icon: Package },
  en_transito: { label: 'En Tránsito', color: 'bg-blue-600', icon: Truck },
  en_reparto: { label: 'En Reparto', color: 'bg-orange-500', icon: Truck },
  entregado: { label: 'Entregado', color: 'bg-green-500', icon: CheckCircle },
  devuelto: { label: 'Devuelto', color: 'bg-red-500', icon: AlertCircle },
  cancelado: { label: 'Cancelado', color: 'bg-gray-500', icon: AlertCircle },
  incidencia: { label: 'Incidencia', color: 'bg-amber-500', icon: AlertCircle },
  no_entregado: { label: 'No Entregado', color: 'bg-red-600', icon: AlertCircle },
  primera_visita: { label: '1a Visita', color: 'bg-amber-600', icon: AlertCircle },
  segunda_visita: { label: '2a Visita', color: 'bg-red-400', icon: AlertCircle },
  reprogramado: { label: 'Reprogramado', color: 'bg-indigo-500', icon: CalendarClock },
};

export default function Shipments() {
  const { isAdmin, isSuperAdmin, hasRole, user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = usePersistedState('shipments-search', '');
  const [statusFilter, setStatusFilter] = usePersistedState('shipments-status-filter', 'all');
  const [dateFromISO, setDateFromISO] = usePersistedState('shipments-date-from', new Date().toISOString());
  const [dateToISO, setDateToISO] = usePersistedState('shipments-date-to', new Date().toISOString());
  const dateFrom = useMemo(() => new Date(dateFromISO), [dateFromISO]);
  const dateTo = useMemo(() => new Date(dateToISO), [dateToISO]);
  const setDateFrom = useCallback((d: Date) => setDateFromISO(d.toISOString()), [setDateFromISO]);
  const setDateTo = useCallback((d: Date) => setDateToISO(d.toISOString()), [setDateToISO]);
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [envioToCancel, setEnvioToCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  // New dialog states
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedEnvio, setSelectedEnvio] = useState<any>(null);
  const [deriveDialogOpen, setDeriveDialogOpen] = useState(false);
  const [envioToDerive, setEnvioToDerive] = useState<any>(null);
  // Check if user can change status (admin, supervisor, or centro logístico)
  const [isCentroLogistico, setIsCentroLogistico] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [envioToDelete, setEnvioToDelete] = useState<any>(null);
  const [selectedEnvioIds, setSelectedEnvioIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const toggleSelectEnvio = useCallback((id: string) => {
    setSelectedEnvioIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!filteredEnviosRef.current) return;
    setSelectedEnvioIds(prev => {
      const allIds = filteredEnviosRef.current!.map((e: any) => e.id);
      const allSelected = allIds.every((id: string) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedEnvioIds(new Set()), []);
  const filteredEnviosRef = useRef<any[] | null>(null);
  
  useQuery({
    queryKey: ['user-sucursal-check', profile?.sucursal_id],
    queryFn: async () => {
      if (!profile?.sucursal_id) return false;
      const { data } = await supabase
        .from('sucursales')
        .select('es_centro_logistico')
        .eq('id', profile.sucursal_id)
        .single();
      setIsCentroLogistico(data?.es_centro_logistico || false);
      return data?.es_centro_logistico || false;
    },
    enabled: !!profile?.sucursal_id,
  });

  // Check if tenant has ML sellers
  const { data: mlSellers } = useQuery({
    queryKey: ['ml-sellers-check', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      const { data } = await supabase
        .from('ecommerce_sellers')
        .select('id, nombre, store_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('plataforma', 'mercadolibre')
        .eq('activo', true);
      return data || [];
    },
    enabled: !!profile?.tenant_id,
  });

  const handleSyncML = useCallback(async () => {
    if (!mlSellers?.length) return;
    setIsSyncing(true);
    try {
      let totalSynced = 0;
      for (const seller of mlSellers) {
        const { data, error } = await supabase.functions.invoke('mercadolibre-sync', {
          body: { seller_id: seller.id },
        });
        if (error) {
          console.error(`Error syncing seller ${seller.nombre}:`, error);
        } else {
          totalSynced += data?.synced || 0;
        }
      }
      toast.success(`Sincronización ML completada. ${totalSynced} envío(s) actualizados.`);
      refetch();
    } catch (err) {
      toast.error('Error al sincronizar con Mercado Libre');
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  }, [mlSellers]);

  const canChangeStatus = isAdmin() || hasRole('supervisor') || isCentroLogistico;

  const cancelMutation = useMutation({
    mutationFn: async ({ envioId, reason, previousStatus }: { envioId: string; reason: string; previousStatus: string | null }) => {
      const { data: updateData, error: updateError } = await supabase
        .from('envios')
        .update({ estado: 'cancelado' })
        .eq('id', envioId)
        .select('id');
      
      if (updateError) throw updateError;
      if (!updateData || updateData.length === 0) {
        throw new Error('No se pudo actualizar el envío. Verificá que tenés permisos para cancelar envíos de esta sucursal.');
      }

      const { error: historyError } = await supabase
        .from('envio_historial')
        .insert({
          envio_id: envioId,
          estado_anterior: previousStatus as ShipmentStatus,
          estado_nuevo: 'cancelado' as ShipmentStatus,
          notas: reason || 'Envío cancelado',
          created_by: user?.id
        });
      
      if (historyError) throw historyError;

      // Anular pagos activos del envío
      const { data: pagos } = await supabase
        .from('pagos')
        .select('id')
        .eq('envio_id', envioId)
        .in('estado', ['cobrado_chofer', 'rendido', 'pagado']);

      if (pagos?.length) {
        await supabase
          .from('pagos')
          .update({ estado: 'anulado' })
          .in('id', pagos.map(p => p.id));
      }

      // Compensar movimientos de caja (insertar egreso por cada ingreso)
      const { data: movimientos } = await supabase
        .from('movimientos_caja')
        .select('id, sesion_caja_id, monto, concepto, metodo_pago')
        .eq('envio_id', envioId)
        .eq('tipo', 'ingreso');

      if (movimientos?.length) {
        for (const mov of movimientos) {
          await supabase.from('movimientos_caja').insert({
            sesion_caja_id: mov.sesion_caja_id,
            envio_id: envioId,
            tipo: 'egreso',
            monto: mov.monto,
            concepto: `Anulación: ${mov.concepto}`,
            metodo_pago: mov.metodo_pago || 'efectivo',
            created_by: user?.id,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success('Envío cancelado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      queryClient.invalidateQueries({ queryKey: ['envios-stats'] });
      setCancelDialogOpen(false);
      setEnvioToCancel(null);
      setCancelReason('');
    },
    onError: (error) => {
      toast.error('Error al cancelar el envío');
      console.error(error);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (envioId: string) => {
      // Delete related records in order
      await supabase.from('envio_historial').delete().eq('envio_id', envioId);
      await supabase.from('envio_detalles').delete().eq('envio_id', envioId);
      await supabase.from('comisiones').delete().eq('envio_id', envioId);
      await supabase.from('pagos').delete().eq('envio_id', envioId);
      await supabase.from('movimientos_caja').delete().eq('envio_id', envioId);
      await supabase.from('ruta_paradas').delete().eq('envio_id', envioId);
      await supabase.from('hoja_ruta_envios').delete().eq('envio_id', envioId);
      // Unlink ecommerce orders
      await supabase.from('ecommerce_orders').update({ envio_id: null }).eq('envio_id', envioId);
      // Delete the shipment
      const { error } = await supabase.from('envios').delete().eq('id', envioId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Envío eliminado permanentemente');
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      queryClient.invalidateQueries({ queryKey: ['envios-stats'] });
      setDeleteDialogOpen(false);
      setEnvioToDelete(null);
    },
    onError: (error) => {
      toast.error('Error al eliminar el envío');
      console.error(error);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (let i = 0; i < ids.length; i++) {
        const envioId = ids[i];
        toast.loading(`Eliminando ${i + 1} de ${ids.length}...`, { id: 'bulk-delete' });
        await supabase.from('envio_historial').delete().eq('envio_id', envioId);
        await supabase.from('envio_detalles').delete().eq('envio_id', envioId);
        await supabase.from('comisiones').delete().eq('envio_id', envioId);
        await supabase.from('pagos').delete().eq('envio_id', envioId);
        await supabase.from('movimientos_caja').delete().eq('envio_id', envioId);
        await supabase.from('ruta_paradas').delete().eq('envio_id', envioId);
        await supabase.from('hoja_ruta_envios').delete().eq('envio_id', envioId);
        await supabase.from('ecommerce_orders').update({ envio_id: null }).eq('envio_id', envioId);
        const { error } = await supabase.from('envios').delete().eq('id', envioId);
        if (error) throw error;
      }
    },
    onSuccess: (_data, ids) => {
      toast.success(`${ids.length} envío(s) eliminados permanentemente`, { id: 'bulk-delete' });
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      queryClient.invalidateQueries({ queryKey: ['envios-stats'] });
      setBulkDeleteDialogOpen(false);
      clearSelection();
    },
    onError: (error) => {
      toast.error('Error al eliminar envíos', { id: 'bulk-delete' });
      console.error(error);
    },
  });

  const { data: enviosData, isLoading, refetch } = useQuery({
    queryKey: ['envios', statusFilter, dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const dayStart = startOfDay(dateFrom);
      const dayEnd = endOfDay(dateTo);

      let query = supabase
        .from('envios')
        .select(`
          *,
          sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(nombre),
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre),
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido),
          chofer_id
        `)
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString())
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('estado', statusFilter as ShipmentStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch chofer names separately
      const choferIds = [...new Set((data || []).map((e: any) => e.chofer_id).filter(Boolean))];
      let choferMap: Record<string, string> = {};
      if (choferIds.length > 0) {
        const { data: choferProfiles } = await supabase
          .from('profiles')
          .select('user_id, nombre, apellido')
          .in('user_id', choferIds);
        if (choferProfiles) {
          choferMap = Object.fromEntries(
            choferProfiles.map(p => [p.user_id, `${p.nombre} ${p.apellido || ''}`.trim()])
          );
        }
      }

      return { envios: data, choferMap };
    },
  });

  const envios = enviosData?.envios;
  const choferMap = enviosData?.choferMap || {};

  const { data: stats } = useQuery({
    queryKey: ['envios-stats'],
    queryFn: async () => {
      const [totalRes, pendienteRes, transitoRes, entregadoRes, problemasRes] = await Promise.all([
        supabase.from('envios').select('*', { count: 'exact', head: true }),
        supabase.from('envios').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabase.from('envios').select('*', { count: 'exact', head: true }).in('estado', ['en_transito', 'en_reparto', 'recogido']),
        supabase.from('envios').select('*', { count: 'exact', head: true }).eq('estado', 'entregado'),
        supabase.from('envios').select('*', { count: 'exact', head: true }).in('estado', ['devuelto', 'cancelado']),
      ]);

      return {
        total: totalRes.count ?? 0,
        pendiente: pendienteRes.count ?? 0,
        en_transito: transitoRes.count ?? 0,
        entregado: entregadoRes.count ?? 0,
        problemas: problemasRes.count ?? 0,
      };
    },
  });

  const filteredEnvios = envios?.filter(envio => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const choferNombre = envio.chofer_id ? (choferMap[envio.chofer_id] || '') : '';
    return (
      envio.tracking_number?.toLowerCase().includes(searchLower) ||
      envio.tracking_externo?.toLowerCase().includes(searchLower) ||
      envio.remitente?.nombre?.toLowerCase().includes(searchLower) ||
      envio.destinatario?.nombre?.toLowerCase().includes(searchLower) ||
      envio.nombre_destinatario?.toLowerCase().includes(searchLower) ||
      envio.direccion_entrega?.toLowerCase().includes(searchLower) ||
      envio.ciudad_entrega?.toLowerCase().includes(searchLower) ||
      (envio.destinatario as any)?.direccion?.toLowerCase().includes(searchLower) ||
      (envio.destinatario as any)?.ciudad?.toLowerCase().includes(searchLower) ||
      choferNombre.toLowerCase().includes(searchLower)
    );
  });
  filteredEnviosRef.current = filteredEnvios || null;

  const StatusBadge = ({ status }: { status: ShipmentStatus }) => {
    const config = statusConfig[status];
    if (!config) {
      return (
        <Badge className="bg-gray-400 text-white gap-1">
          <AlertCircle className="h-3 w-3" />
          {status || 'Desconocido'}
        </Badge>
      );
    }
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Package className="h-8 w-8 text-shipments" />
            Gestión de Envíos
          </h1>
          <p className="text-muted-foreground mt-1">
            Administra todos los envíos del sistema
          </p>
        </div>
        <Button asChild className="gradient-primary">
          <Link to="/shipments/new">
            <PackagePlus className="mr-2 h-4 w-4" />
            Nuevo Envío
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card className="card-hover border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pendiente || 0}</div>
          </CardContent>
        </Card>
        <Card className="card-hover border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En Tránsito</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.en_transito || 0}</div>
          </CardContent>
        </Card>
        <Card className="card-hover border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entregados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.entregado || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por tracking, remitente o destinatario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, 'dd/MM/yyyy', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => { if (date) { setDateFrom(date); setDateFromOpen(false); } }}
                    locale={es}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, 'dd/MM/yyyy', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => { if (date) { setDateTo(date); setDateToOpen(false); } }}
                    locale={es}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mlSellers && mlSellers.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncML}
                  disabled={isSyncing}
                  className="gap-1.5"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sincronizar ML
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {isSuperAdmin() && selectedEnvioIds.size > 0 && (
        <Card className="border-destructive">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedEnvioIds.size} envío(s) seleccionado(s)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Deseleccionar todo
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar seleccionados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredEnvios && filteredEnvios.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                   {isSuperAdmin() && (
                     <TableHead className="w-10">
                       <Checkbox
                         checked={filteredEnvios.length > 0 && filteredEnvios.every((e: any) => selectedEnvioIds.has(e.id))}
                         onCheckedChange={toggleSelectAll}
                       />
                     </TableHead>
                   )}
                   <TableHead>Tracking</TableHead>
                   <TableHead>IDML</TableHead>
                   <TableHead>Remitente</TableHead>
                   <TableHead>Destinatario</TableHead>
                   <TableHead>CP Dest.</TableHead>
                   <TableHead>Origen</TableHead>
                   <TableHead>Destino</TableHead>
                   <TableHead>Chofer</TableHead>
                   <TableHead>Estado</TableHead>
                   <TableHead>Estado ML</TableHead>
                   <TableHead className="text-right">Precio</TableHead>
                   <TableHead>Fecha</TableHead>
                   <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnvios.map((envio) => (
                  <TableRow key={envio.id} className="cursor-pointer hover:bg-muted/50">
                    {isSuperAdmin() && (
                      <TableCell>
                        <Checkbox
                          checked={selectedEnvioIds.has(envio.id)}
                          onCheckedChange={() => toggleSelectEnvio(envio.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="font-mono font-medium text-primary">
                        {envio.tracking_number}
                      </div>
                      {envio.es_terciarizado && (
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {envio.empresa_terciarizada === 'correo_argentino' ? 'Correo Arg.' :
                             envio.empresa_terciarizada === 'oca' ? 'OCA' :
                             envio.empresa_terciarizada === 'andreani' ? 'Andreani' :
                             envio.empresa_terciarizada}
                          </Badge>
                          {envio.tracking_externo && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {envio.tracking_externo}
                            </span>
                          )}
                        </div>
                      )}
                     </TableCell>
                     <TableCell>
                       <span className="text-xs font-mono text-muted-foreground">{envio.ml_shipment_id || '-'}</span>
                     </TableCell>
                     <TableCell>
                       {envio.nombre_remitente || (envio.remitente ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}` : '-')}
                     </TableCell>
                    <TableCell>
                      {envio.nombre_destinatario || (envio.destinatario ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}` : '-')}
                    </TableCell>
                     <TableCell>
                       <span className="text-xs text-muted-foreground">{envio.cp_entrega || envio.codigo_postal_destino || '-'}</span>
                     </TableCell>
                     <TableCell className="text-muted-foreground">
                       {envio.sucursal_origen?.nombre || '-'}
                     </TableCell>
                     <TableCell className="text-muted-foreground">
                       {envio.sucursal_destino?.nombre || envio.ciudad_entrega || envio.direccion_entrega || '-'}
                     </TableCell>
                     <TableCell>
                       <span className="text-xs text-muted-foreground">
                         {envio.chofer_id ? (choferMap[envio.chofer_id] || '-') : '-'}
                       </span>
                     </TableCell>
                     <TableCell>
                      <StatusBadge status={envio.estado as ShipmentStatus} />
                    </TableCell>
                     <TableCell>
                       {envio.ml_shipment_id ? (
                         <div className="flex items-center gap-1 flex-wrap">
                           {envio.estado_ml ? (
                             <>
                               <StatusBadge status={envio.estado_ml as ShipmentStatus} />
                               {envio.estado_ml !== envio.estado && (
                                 <span title="Discrepancia entre estado interno y ML">
                                   <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                 </span>
                               )}
                             </>
                           ) : (
                             <span className="text-xs text-muted-foreground">Sin sync</span>
                           )}
                           <MLSyncBadge
                             ml_shipment_id={envio.ml_shipment_id}
                             ml_sync_status={(envio as any).ml_sync_status}
                             ml_sync_error_detail={(envio as any).ml_sync_error_detail}
                             ml_last_sync_at={(envio as any).ml_last_sync_at}
                             compact
                           />
                         </div>
                       ) : null}
                     </TableCell>
                    <TableCell className="text-right font-medium">
                      ${envio.precio_total?.toLocaleString('es-AR')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {envio.created_at ? format(parseDateString(envio.created_at), 'dd MMM yyyy', { locale: es }) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ver detalles"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEnvio(envio);
                            setDetailsDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ver historial"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEnvio(envio);
                            setHistoryDialogOpen(true);
                          }}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="Imprimir etiqueta"
                        >
                          <Link to={`/print-label?id=${envio.id}`}>
                            <Printer className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canChangeStatus && ((envio.estado !== 'entregado' && envio.estado !== 'cancelado') || isSuperAdmin()) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Cambiar estado"
                            className="text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEnvio(envio);
                              setStatusDialogOpen(true);
                            }}
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                        )}
                        {envio.estado !== 'cancelado' && envio.estado !== 'entregado' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Derivar a partner"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEnvioToDerive(envio);
                              setDeriveDialogOpen(true);
                            }}
                          >
                            <Handshake className="h-4 w-4" />
                          </Button>
                        )}
                        {envio.estado !== 'cancelado' && envio.estado !== 'entregado' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Cancelar envío"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEnvioToCancel(envio);
                              setCancelDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {isSuperAdmin() && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Eliminar envío permanentemente"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEnvioToDelete(envio);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No hay envíos</h3>
              <p className="text-muted-foreground">Crea tu primer envío para comenzar</p>
              <Button asChild className="mt-4">
                <Link to="/shipments/new">
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Crear Envío
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este envío?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de cancelar el envío <strong>{envioToCancel?.tracking_number}</strong>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2">
            <Label>Motivo de cancelación (opcional)</Label>
            <Textarea
              placeholder="Ingresa el motivo de la cancelación..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setEnvioToCancel(null);
              setCancelReason('');
            }}>
              No, mantener
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate({ 
                envioId: envioToCancel?.id, 
                reason: cancelReason,
                previousStatus: envioToCancel?.estado
              })}
              className="bg-destructive hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelando...' : 'Sí, cancelar envío'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog (Super Admin only) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar envío permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Estás a punto de eliminar permanentemente el envío{' '}
                  <strong>{envioToDelete?.tracking_number}</strong>.
                </p>
                <p className="font-medium text-destructive">
                  Se eliminarán todos los registros asociados: historial, pagos, movimientos de caja, paradas de ruta y comisiones.
                </p>
                <p className="text-sm font-semibold text-foreground">
                  Esta acción es irreversible.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEnvioToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(envioToDelete?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog (Super Admin only) */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar {selectedEnvioIds.size} envío(s) permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Estás a punto de eliminar permanentemente <strong>{selectedEnvioIds.size} envío(s)</strong>.
                </p>
                <p className="font-medium text-destructive">
                  Se eliminarán todos los registros asociados de cada envío: historial, pagos, movimientos de caja, paradas de ruta y comisiones.
                </p>
                <p className="text-sm font-semibold text-foreground">
                  Esta acción es irreversible.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate([...selectedEnvioIds])}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? 'Eliminando...' : `Eliminar ${selectedEnvioIds.size} envío(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <ShipmentHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        envioId={selectedEnvio?.id}
        trackingNumber={selectedEnvio?.tracking_number || ''}
      />

      {/* Details Dialog */}
      <ShipmentDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        envioId={selectedEnvio?.id}
      />

      {/* Change Status Dialog */}
      <ChangeStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        envioId={selectedEnvio?.id}
        currentStatus={selectedEnvio?.estado}
        trackingNumber={selectedEnvio?.tracking_number || ''}
      />

      {/* Derive Shipment Dialog */}
      {envioToDerive && (
        <DeriveShipmentDialog
          open={deriveDialogOpen}
          onOpenChange={setDeriveDialogOpen}
          envioId={envioToDerive.id}
          trackingNumber={envioToDerive.tracking_number}
        />
      )}
    </div>
  );
}
