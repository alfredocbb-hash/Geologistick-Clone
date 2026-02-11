import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, MoreHorizontal, Package, Eye, Truck, ShoppingBag, Clock, CheckCircle, XCircle, Printer, Edit, MapPin, Trash2, Download, Tag, CalendarIcon } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { OrderDetailsDialog } from '@/components/ecommerce/OrderDetailsDialog';
import { CreateShipmentFromOrderDialog } from '@/components/ecommerce/CreateShipmentFromOrderDialog';
import { EditOrderAddressDialog } from '@/components/ecommerce/EditOrderAddressDialog';
import { parseDateString } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  seller_id: string;
  external_order_id: string;
  external_order_number: string | null;
  plataforma: string;
  order_status: string;
  fulfillment_status: string;
  ml_shipping_status: string | null;
  buyer_name: string;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_dni: string | null;
  shipping_address: string;
  shipping_city: string | null;
  shipping_province: string | null;
  shipping_postal_code: string | null;
  shipping_lat: number | null;
  shipping_lng: number | null;
  shipping_notes: string | null;
  items: any[] | null;
  subtotal: number | null;
  shipping_cost: number | null;
  total: number;
  envio_id: string | null;
  ml_shipment_id: number | null;
  ml_tracking_number: string | null;
  raw_data: any | null;
  created_at: string;
  seller?: {
    id: string;
    nombre: string;
    tarifa_id: string | null;
    sucursal_pickup_id: string | null;
    tiene_cuenta_corriente: boolean;
  };
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'Pendiente', icon: Clock, className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  paid: { label: 'Pagado', icon: CheckCircle, className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  shipped: { label: 'Enviado', icon: Truck, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  delivered: { label: 'Entregado', icon: Package, className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  cancelled: { label: 'Cancelado', icon: XCircle, className: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

const ML_SHIPPING_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'Pendiente ML', icon: Clock, className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  ready_to_ship: { label: 'Listo para enviar', icon: Package, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  shipped: { label: 'En camino', icon: Truck, className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  delivered: { label: 'Entregado', icon: CheckCircle, className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  not_delivered: { label: 'No entregado', icon: XCircle, className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  cancelled: { label: 'Cancelado', icon: XCircle, className: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
};

const FULFILLMENT_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Sin Preparar', className: 'bg-gray-500/10 text-gray-600' },
  processing: { label: 'En Preparación', className: 'bg-yellow-500/10 text-yellow-600' },
  shipped: { label: 'Enviado', className: 'bg-blue-500/10 text-blue-600' },
  delivered: { label: 'Entregado', className: 'bg-green-500/10 text-green-600' },
};

export default function Orders() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);
  const [createShipmentOrder, setCreateShipmentOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);

  // Mutation para eliminar envío
  const deleteShipmentMutation = useMutation({
    mutationFn: async (order: Order) => {
      if (!order.envio_id) throw new Error('No hay envío asociado');
      
      // PASO 0: Buscar movimientos de cargo en cuenta corriente del seller
      const { data: cargos } = await supabase
        .from('seller_cuenta_corriente')
        .select('id, monto, seller_id, descripcion')
        .eq('envio_id', order.envio_id)
        .eq('tipo', 'cargo');
      
      // Si hay cargos, crear reversión y limpiar FK
      if (cargos && cargos.length > 0) {
        for (const cargo of cargos) {
          // Obtener saldo actual del seller
          const { data: seller } = await supabase
            .from('ecommerce_sellers')
            .select('saldo_cuenta_corriente')
            .eq('id', cargo.seller_id)
            .single();
          
          const saldoAnterior = seller?.saldo_cuenta_corriente || 0;
          const montoReversion = -Math.abs(cargo.monto);
          const saldoNuevo = saldoAnterior + montoReversion;
          
          // Crear ajuste de reversión
          await supabase
            .from('seller_cuenta_corriente')
            .insert({
              seller_id: cargo.seller_id,
              tipo: 'ajuste',
              monto: montoReversion,
              saldo_anterior: saldoAnterior,
              saldo_nuevo: saldoNuevo,
              descripcion: `Reversión: ${cargo.descripcion || 'Envío eliminado'}`,
              order_id: order.id,
            });
          
          // Limpiar envio_id del cargo original (romper FK)
          await supabase
            .from('seller_cuenta_corriente')
            .update({ envio_id: null })
            .eq('id', cargo.id);
        }
      }
      
      // PASO 1: Eliminar historial del envío
      await supabase
        .from('envio_historial')
        .delete()
        .eq('envio_id', order.envio_id);
      
      // PASO 2: Eliminar detalles del envío
      await supabase
        .from('envio_detalles')
        .delete()
        .eq('envio_id', order.envio_id);
      
      // PASO 3: Desvincular la orden del envío
      await supabase
        .from('ecommerce_orders')
        .update({ envio_id: null })
        .eq('id', order.id);
      
      // PASO 4: Eliminar el envío
      const { error } = await supabase
        .from('envios')
        .delete()
        .eq('id', order.envio_id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Envío eliminado correctamente' });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-orders'] });
      setDeleteOrder(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error al eliminar', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Fetch sellers for filter
  const { data: sellers } = useQuery({
    queryKey: ['ecommerce-sellers-filter', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_sellers')
        .select('id, nombre')
        .eq('tenant_id', tenantId)
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch orders with seller info — filtered by date server-side
  const { data: orders, isLoading } = useQuery({
    queryKey: ['ecommerce-orders', tenantId, dateFrom.toISOString().slice(0, 10), dateTo.toISOString().slice(0, 10), sellerFilter],
    queryFn: async () => {
      let query = supabase
        .from('ecommerce_orders')
        .select(`
          *,
          seller:ecommerce_sellers(id, nombre, tarifa_id, sucursal_pickup_id, tiene_cuenta_corriente)
        `)
        .eq('tenant_id', tenantId);

      // Date range filter
      const dayStart = startOfDay(dateFrom).toISOString();
      const dayEnd = endOfDay(dateTo).toISOString();
      query = query.gte('created_at', dayStart).lte('created_at', dayEnd);

      // Seller filter
      if (sellerFilter !== 'all') {
        query = query.eq('seller_id', sellerFilter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
    enabled: !!tenantId,
  });

  const filteredOrders = orders?.filter(o => {
    const matchesSearch = 
      o.buyer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.external_order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.external_order_id.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (o.ml_shipping_status ? o.ml_shipping_status === statusFilter : o.order_status === statusFilter);
    const matchesFulfillment = fulfillmentFilter === 'all' || o.fulfillment_status === fulfillmentFilter;
    
    return matchesSearch && matchesStatus && matchesFulfillment;
  });

  // Group orders by seller
  const groupedOrders = filteredOrders?.reduce<Record<string, { sellerName: string; sellerId: string; orders: Order[] }>>((acc, order) => {
    const key = order.seller_id;
    if (!acc[key]) {
      acc[key] = { sellerName: order.seller?.nombre || 'Sin seller', sellerId: key, orders: [] };
    }
    acc[key].orders.push(order);
    return acc;
  }, {});

  const sellerGroups = Object.values(groupedOrders || {});

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders?.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders?.map(o => o.id) || []);
    }
  };

  const toggleSelectGroup = (groupOrders: Order[]) => {
    const groupIds = groupOrders.map(o => o.id);
    const allSelected = groupIds.every(id => selectedOrders.includes(id));
    if (allSelected) {
      setSelectedOrders(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setSelectedOrders(prev => [...new Set([...prev, ...groupIds])]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedOrders(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Stats
  const pendingCount = orders?.filter(o => !o.envio_id && o.order_status === 'paid').length || 0;

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
          <h1 className="text-2xl font-bold tracking-tight">Pedidos e-Commerce</h1>
          <p className="text-muted-foreground">
            {pendingCount > 0 && (
              <span className="text-orange-600 font-medium">{pendingCount} pedidos pendientes de crear envío</span>
            )}
          </p>
        </div>
        {/* Action buttons moved to totalizer bar */}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por pedido, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Popover>
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
              onSelect={(d) => d && setDateFrom(d)}
              locale={es}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Popover>
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
              onSelect={(d) => d && setDateTo(d)}
              locale={es}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Select value={sellerFilter} onValueChange={setSellerFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Seller" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los sellers</SelectItem>
            {sellers?.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado pedido" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
            <SelectItem value="ready_to_ship">Listo para enviar</SelectItem>
            <SelectItem value="shipped">En camino</SelectItem>
            <SelectItem value="delivered">Entregado</SelectItem>
            <SelectItem value="not_delivered">No entregado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Fulfillment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Sin Preparar</SelectItem>
            <SelectItem value="processing">En Preparación</SelectItem>
            <SelectItem value="shipped">Enviado</SelectItem>
            <SelectItem value="delivered">Entregado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Totalizer bar */}
      {selectedOrders.length > 0 && (() => {
        const selectedData = filteredOrders?.filter(o => selectedOrders.includes(o.id)) || [];
        const totalShippingCost = selectedData.reduce((sum, o) => sum + (o.shipping_cost || 0), 0);
        const withShipment = selectedData.filter(o => o.envio_id).length;
        const withoutShipment = selectedData.filter(o => !o.envio_id).length;

        return (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="font-semibold">{selectedOrders.length} seleccionados</span>
                  <span className="text-muted-foreground">|</span>
                  <span>Envío: <strong>${totalShippingCost.toLocaleString()}</strong></span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-green-600">{withShipment} con envío</span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-orange-600">{withoutShipment} sin envío</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => {
                    const ordersToShip = selectedData.filter(o => !o.envio_id && o.order_status !== 'cancelled');
                    if (ordersToShip.length === 0) {
                      toast({ title: 'Sin pedidos válidos', description: 'Los pedidos seleccionados ya tienen envío o están cancelados', variant: 'destructive' });
                      return;
                    }
                    if (ordersToShip.length === 1) {
                      setCreateShipmentOrder(ordersToShip[0]);
                    } else {
                      toast({ title: 'Funcionalidad próximamente', description: `Crear ${ordersToShip.length} envíos masivos` });
                    }
                  }}>
                    <Truck className="mr-2 h-4 w-4" />
                    Crear Envíos ({withoutShipment})
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const ordersWithShipment = selectedData.filter(o => o.envio_id);
                    if (ordersWithShipment.length === 0) {
                      toast({ title: 'Sin envíos', description: 'Las órdenes seleccionadas no tienen envío creado', variant: 'destructive' });
                      return;
                    }
                    const envioIds = ordersWithShipment.map(o => o.envio_id);
                    navigate(`/route-planner?envios=${envioIds.join(',')}`);
                  }}>
                    <MapPin className="mr-2 h-4 w-4" />
                    Planificar ({withShipment})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedOrders.length === filteredOrders?.length && filteredOrders.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead className="text-right">Costo Envío</TableHead>
                  <TableHead>Envío</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellerGroups.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No hay pedidos que mostrar
                    </TableCell>
                  </TableRow>
                )}
                {sellerGroups.map((group) => {
                  const groupIds = group.orders.map(o => o.id);
                  const allGroupSelected = groupIds.length > 0 && groupIds.every(id => selectedOrders.includes(id));
                  const groupWithShipment = group.orders.filter(o => o.envio_id);

                  return (
                    <>
                      {/* Seller group header */}
                      <TableRow key={`group-${group.sellerId}`} className="bg-muted/50 hover:bg-muted/70">
                        <TableCell>
                          <Checkbox
                            checked={allGroupSelected}
                            onCheckedChange={() => toggleSelectGroup(group.orders)}
                          />
                        </TableCell>
                        <TableCell colSpan={6}>
                          <div className="flex items-center gap-3">
                            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{group.sellerName}</span>
                            <Badge variant="secondary">{group.orders.length} pedidos</Badge>
                          </div>
                        </TableCell>
                        <TableCell colSpan={2} className="text-right">
                          {groupWithShipment.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const envioIds = groupWithShipment.map(o => o.envio_id);
                                navigate(`/route-planner?envios=${envioIds.join(',')}`);
                              }}
                            >
                              <MapPin className="mr-1 h-3 w-3" />
                              Planificar ({groupWithShipment.length})
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {/* Individual order rows */}
                      {group.orders.map((order) => {
                        // Use ML shipping status for ML orders, fallback to generic order_status
                        const useMLStatus = order.plataforma === 'mercadolibre' && order.ml_shipping_status;
                        const status = useMLStatus
                          ? (ML_SHIPPING_CONFIG[order.ml_shipping_status!] || STATUS_CONFIG[order.order_status] || STATUS_CONFIG.pending)
                          : (STATUS_CONFIG[order.order_status] || STATUS_CONFIG.pending);
                        const fulfillment = FULFILLMENT_CONFIG[order.fulfillment_status] || FULFILLMENT_CONFIG.pending;
                        const StatusIcon = status.icon;
                        
                        return (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedOrders.includes(order.id)}
                                onCheckedChange={() => toggleSelect(order.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">#{order.external_order_number || order.external_order_id}</span>
                                <span className="text-xs text-muted-foreground">
                                  {format(parseDateString(order.created_at), 'dd/MM/yy', { locale: es })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{order.seller?.nombre || '-'}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{order.buyer_name}</span>
                                <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                                  {order.shipping_city || order.shipping_address}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={status.className}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={fulfillment.className}>
                                {fulfillment.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {order.shipping_cost ? `$${order.shipping_cost.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell>
                              {order.envio_id ? (
                                <div className="flex items-center gap-2">
                                  {order.ml_tracking_number ? (
                                    <Badge variant="default" className="font-mono text-xs">
                                      <Tag className="mr-1 h-3 w-3" />
                                      {order.ml_tracking_number}
                                    </Badge>
                                  ) : (
                                    <Badge variant="default">Creado</Badge>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => navigate(`/print-label?id=${order.envio_id}`)}
                                    title="Imprimir etiqueta"
                                  >
                                    <Printer className="h-3 w-3" />
                                  </Button>
                                  {order.ml_shipment_id && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => {
                                        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadolibre-label?shipment_id=${order.ml_shipment_id}`;
                                        window.open(url, '_blank');
                                      }}
                                      title="Descargar etiqueta ML"
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ) : order.order_status !== 'cancelled' ? (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setCreateShipmentOrder(order)}
                                >
                                  <Truck className="mr-1 h-3 w-3" />
                                  Crear
                                </Button>
                              ) : (
                                <Badge variant="secondary">-</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setDetailsOrder(order)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Ver Detalles
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditOrder(order)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar Pedido
                                  </DropdownMenuItem>
                                  {!order.envio_id && order.order_status !== 'cancelled' && (
                                    <DropdownMenuItem onClick={() => setCreateShipmentOrder(order)}>
                                      <Truck className="mr-2 h-4 w-4" />
                                      Crear Envío
                                    </DropdownMenuItem>
                                  )}
                                  {order.envio_id && order.order_status !== 'delivered' && (
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => setDeleteOrder(order)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Eliminar Envío
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {detailsOrder && (
        <OrderDetailsDialog
          open={!!detailsOrder}
          onOpenChange={() => setDetailsOrder(null)}
          order={detailsOrder}
        />
      )}
      
      {createShipmentOrder && (
        <CreateShipmentFromOrderDialog
          open={!!createShipmentOrder}
          onOpenChange={() => setCreateShipmentOrder(null)}
          order={createShipmentOrder}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['ecommerce-orders'] });
            setCreateShipmentOrder(null);
          }}
        />
      )}

      {editOrder && (
        <EditOrderAddressDialog
          open={!!editOrder}
          onOpenChange={() => setEditOrder(null)}
          order={editOrder}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['ecommerce-orders'] });
            setEditOrder(null);
          }}
        />
      )}

      {/* Delete Shipment Dialog */}
      <AlertDialog open={!!deleteOrder} onOpenChange={() => setDeleteOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este envío?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el envío asociado al pedido #{deleteOrder?.external_order_number || deleteOrder?.external_order_id}.
              La orden quedará disponible para crear un nuevo envío o re-sincronizar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteOrder && deleteShipmentMutation.mutate(deleteOrder)}
              disabled={deleteShipmentMutation.isPending}
            >
              {deleteShipmentMutation.isPending ? 'Eliminando...' : 'Eliminar Envío'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
