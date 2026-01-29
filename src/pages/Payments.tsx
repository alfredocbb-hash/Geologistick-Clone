import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  CreditCard, 
  DollarSign, 
  Clock, 
  Users, 
  Smartphone,
  Banknote,
  Building2,
  Search,
  Filter,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentMethodDialog } from '@/components/shipments/PaymentMethodDialog';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type PaymentMethod = Database['public']['Enums']['payment_method'];
type PaymentStatus = Database['public']['Enums']['payment_status'];

interface Pago {
  id: string;
  envio_id: string | null;
  cliente_id: string | null;
  monto: number;
  metodo: PaymentMethod;
  estado: PaymentStatus | null;
  referencia: string | null;
  notas: string | null;
  mercado_pago_id: string | null;
  mercado_pago_status: string | null;
  created_at: string | null;
  envio?: {
    tracking_number: string;
    direccion_entrega: string | null;
  } | null;
  cliente?: {
    nombre: string;
    apellido: string | null;
  } | null;
}

interface EnvioPendiente {
  id: string;
  tracking_number: string;
  precio_total: number;
  tipo_pago: string | null;
  estado: string | null;
  created_at: string | null;
  direccion_entrega: string | null;
  remitente?: {
    nombre: string;
    apellido: string | null;
  } | null;
  destinatario?: {
    nombre: string;
    apellido: string | null;
  } | null;
  sucursal_origen?: {
    nombre: string;
  } | null;
}

interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  tiene_cuenta_corriente: boolean | null;
  saldo_cuenta_corriente: number | null;
  limite_credito: number | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
};

const getMethodIcon = (method: PaymentMethod) => {
  switch (method) {
    case 'efectivo': return <Banknote className="h-4 w-4" />;
    case 'mercado_pago': return <Smartphone className="h-4 w-4" />;
    case 'transferencia': return <Building2 className="h-4 w-4" />;
    case 'tarjeta': return <CreditCard className="h-4 w-4" />;
    default: return <DollarSign className="h-4 w-4" />;
  }
};

const getMethodLabel = (method: PaymentMethod) => {
  switch (method) {
    case 'efectivo': return 'Efectivo';
    case 'mercado_pago': return 'Mercado Pago';
    case 'transferencia': return 'Transferencia';
    case 'tarjeta': return 'Tarjeta';
    default: return method;
  }
};

const getStatusBadge = (status: PaymentStatus | null) => {
  switch (status) {
    case 'pagado':
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Pagado</Badge>;
    case 'pendiente':
      return <Badge variant="outline" className="text-amber-600 border-amber-500/50"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
    case 'fallido':
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Fallido</Badge>;
    case 'reembolsado':
      return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Reembolsado</Badge>;
    default:
      return <Badge variant="outline">Desconocido</Badge>;
  }
};

const getMpStatusBadge = (status: string | null) => {
  switch (status) {
    case 'approved':
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Aprobado</Badge>;
    case 'pending':
      return <Badge variant="outline" className="text-amber-600 border-amber-500/50">Pendiente</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Rechazado</Badge>;
    case 'refunded':
      return <Badge variant="secondary">Reembolsado</Badge>;
    case 'in_process':
      return <Badge variant="outline" className="text-blue-600 border-blue-500/50">En proceso</Badge>;
    default:
      return <Badge variant="outline">{status || 'Sin estado'}</Badge>;
  }
};

export default function Payments() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('historial');
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  
  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedEnvio, setSelectedEnvio] = useState<EnvioPendiente | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Fetch all payments
  const { data: pagos, isLoading: isLoadingPagos } = useQuery({
    queryKey: ['pagos', methodFilter, statusFilter, dateFrom, dateTo, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('pagos')
        .select(`
          *,
          envio:envios(tracking_number, direccion_entrega),
          cliente:clientes(nombre, apellido)
        `)
        .order('created_at', { ascending: false });

      if (methodFilter !== 'all') {
        query = query.eq('metodo', methodFilter as PaymentMethod);
      }
      if (statusFilter !== 'all') {
        query = query.eq('estado', statusFilter as PaymentStatus);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom.toISOString());
      }
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Pago[];
    },
  });

  // Fetch pending shipments (need payment)
  const { data: enviosPendientes, isLoading: isLoadingPendientes } = useQuery({
    queryKey: ['envios-pendientes-pago'],
    queryFn: async () => {
      // Get shipments that need payment (contado or destino) and don't have a confirmed payment
      const { data: envios, error } = await supabase
        .from('envios')
        .select(`
          id,
          tracking_number,
          precio_total,
          tipo_pago,
          estado,
          created_at,
          direccion_entrega,
          nombre_remitente,
          nombre_destinatario,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido),
          sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(nombre)
        `)
        .in('tipo_pago', ['contado', 'destino'])
        .not('estado', 'eq', 'cancelado')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out shipments that already have a confirmed payment
      const { data: pagosPagados } = await supabase
        .from('pagos')
        .select('envio_id')
        .eq('estado', 'pagado');

      const enviosPagados = new Set((pagosPagados || []).map(p => p.envio_id));
      
      return (envios || []).filter(e => !enviosPagados.has(e.id)) as EnvioPendiente[];
    },
  });

  // Fetch MP payments
  const { data: pagosMp, isLoading: isLoadingMp } = useQuery({
    queryKey: ['pagos-mercado-pago'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagos')
        .select(`
          *,
          envio:envios(tracking_number, direccion_entrega),
          cliente:clientes(nombre, apellido)
        `)
        .eq('metodo', 'mercado_pago')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Pago[];
    },
  });

  // Fetch clients with current accounts
  const { data: clientes, isLoading: isLoadingClientes } = useQuery({
    queryKey: ['clientes-cuenta-corriente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, apellido, tiene_cuenta_corriente, saldo_cuenta_corriente, limite_credito')
        .eq('tiene_cuenta_corriente', true)
        .order('nombre');

      if (error) throw error;
      return data as Cliente[];
    },
  });

  // Fetch payments for selected client
  const { data: pagosCliente, isLoading: isLoadingPagosCliente } = useQuery({
    queryKey: ['pagos-cliente', selectedCliente],
    queryFn: async () => {
      if (!selectedCliente) return [];
      
      const { data, error } = await supabase
        .from('pagos')
        .select(`
          *,
          envio:envios(tracking_number, direccion_entrega)
        `)
        .eq('cliente_id', selectedCliente)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Pago[];
    },
    enabled: !!selectedCliente,
  });

  // Statistics
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const totalRecaudadoHoy = (pagos || [])
    .filter(p => p.estado === 'pagado' && p.created_at && new Date(p.created_at) >= todayStart)
    .reduce((sum, p) => sum + p.monto, 0);

  const pendientesCobro = enviosPendientes?.length || 0;
  const montoPendiente = (enviosPendientes || []).reduce((sum, e) => sum + e.precio_total, 0);

  const saldosCtaCte = (clientes || []).reduce((sum, c) => sum + (c.saldo_cuenta_corriente || 0), 0);

  const pagosMpPendientes = (pagosMp || []).filter(p => p.mercado_pago_status === 'pending').length;
  const pagosMpAprobados = (pagosMp || []).filter(p => p.mercado_pago_status === 'approved').length;

  // Register payment mutation
  const registerPaymentMutation = useMutation({
    mutationFn: async ({ envioId, method, reference }: { envioId: string; method: PaymentMethod; reference: string }) => {
      const envio = enviosPendientes?.find(e => e.id === envioId);
      if (!envio) throw new Error('Envío no encontrado');

      const { error } = await supabase
        .from('pagos')
        .insert({
          envio_id: envioId,
          monto: envio.precio_total,
          metodo: method,
          estado: 'pagado',
          referencia: reference || null,
          tenant_id: profile?.tenant_id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagos'] });
      queryClient.invalidateQueries({ queryKey: ['envios-pendientes-pago'] });
      toast.success('Pago registrado correctamente');
    },
    onError: (error) => {
      console.error('Error registering payment:', error);
      toast.error('Error al registrar el pago');
    },
  });

  const handleOpenPaymentDialog = (envio: EnvioPendiente) => {
    setSelectedEnvio(envio);
    setPaymentDialogOpen(true);
  };

  const handleConfirmPayment = async (method: PaymentMethod, reference: string) => {
    if (!selectedEnvio) return;
    
    setIsProcessingPayment(true);
    try {
      await registerPaymentMutation.mutateAsync({
        envioId: selectedEnvio.id,
        method,
        reference,
      });
      setPaymentDialogOpen(false);
      setSelectedEnvio(null);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Filter pagos by search term
  const filteredPagos = (pagos || []).filter(pago => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      pago.envio?.tracking_number?.toLowerCase().includes(search) ||
      pago.cliente?.nombre?.toLowerCase().includes(search) ||
      pago.referencia?.toLowerCase().includes(search)
    );
  });

  const selectedClienteData = clientes?.find(c => c.id === selectedCliente);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Gestión de Pagos
        </h1>
        <p className="text-muted-foreground">
          Administra todos los pagos del sistema
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recaudado Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingPagos ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRecaudadoHoy)}</div>
            )}
            <p className="text-xs text-muted-foreground">Pagos confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes de Cobro</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingPendientes ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-amber-600">{pendientesCobro}</div>
                <p className="text-xs text-muted-foreground">{formatCurrency(montoPendiente)} por cobrar</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldos Cta. Cte.</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingClientes ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${saldosCtaCte > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(saldosCtaCte)}
                </div>
                <p className="text-xs text-muted-foreground">{clientes?.length || 0} clientes con cta. cte.</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mercado Pago</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingMp ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{pagosMpAprobados}</div>
                <p className="text-xs text-muted-foreground">{pagosMpPendientes} pendientes de confirmación</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
          <TabsTrigger value="mercadopago">Mercado Pago</TabsTrigger>
          <TabsTrigger value="clientes">Por Cliente</TabsTrigger>
        </TabsList>

        {/* Tab: Historial de Pagos */}
        <TabsContent value="historial" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por tracking, cliente, referencia..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="fallido">Fallido</SelectItem>
                    <SelectItem value="reembolsado">Reembolsado</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yy') : 'Desde'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      {dateTo ? format(dateTo, 'dd/MM/yy') : 'Hasta'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>

                {(dateFrom || dateTo || methodFilter !== 'all' || statusFilter !== 'all') && (
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setDateFrom(undefined);
                      setDateTo(undefined);
                      setMethodFilter('all');
                      setStatusFilter('all');
                    }}
                  >
                    Limpiar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payments Table */}
          <Card>
            <CardContent className="p-0">
              {isLoadingPagos ? (
                <div className="p-8 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredPagos.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No se encontraron pagos
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tracking / Cliente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Referencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPagos.map((pago) => (
                      <TableRow key={pago.id}>
                        <TableCell className="whitespace-nowrap">
                          {pago.created_at 
                            ? format(new Date(pago.created_at), 'dd/MM/yy HH:mm', { locale: es })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {pago.envio ? (
                            <div>
                              <span className="font-mono text-sm">{pago.envio.tracking_number}</span>
                              {pago.envio.direccion_entrega && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {pago.envio.direccion_entrega}
                                </p>
                              )}
                            </div>
                          ) : pago.cliente ? (
                            <span>{pago.cliente.nombre} {pago.cliente.apellido}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getMethodIcon(pago.metodo)}
                            <span className="text-sm">{getMethodLabel(pago.metodo)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(pago.monto)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(pago.estado)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {pago.referencia || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Pendientes de Cobro */}
        <TabsContent value="pendientes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Envíos Pendientes de Cobro
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingPendientes ? (
                <div className="p-8 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (enviosPendientes?.length || 0) === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No hay envíos pendientes de cobro</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Sucursal</TableHead>
                      <TableHead>Tipo Pago</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enviosPendientes?.map((envio) => (
                      <TableRow key={envio.id}>
                        <TableCell className="font-mono text-sm">
                          {envio.tracking_number}
                        </TableCell>
                        <TableCell>
                          {(envio as any).nombre_remitente || (envio as any).nombre_destinatario || envio.remitente?.nombre || envio.destinatario?.nombre || '-'}
                        </TableCell>
                        <TableCell>
                          {envio.sucursal_origen?.nombre || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {envio.tipo_pago === 'contado' ? 'Contado' : 'Pago en Destino'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(envio.precio_total)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{envio.estado}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            onClick={() => handleOpenPaymentDialog(envio)}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Cobrar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Estado Mercado Pago */}
        <TabsContent value="mercadopago" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-blue-500" />
                Pagos de Mercado Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingMp ? (
                <div className="p-8 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (pagosMp?.length || 0) === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay pagos de Mercado Pago registrados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado MP</TableHead>
                      <TableHead>Estado Pago</TableHead>
                      <TableHead>ID Preferencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagosMp?.map((pago) => (
                      <TableRow key={pago.id}>
                        <TableCell className="whitespace-nowrap">
                          {pago.created_at 
                            ? format(new Date(pago.created_at), 'dd/MM/yy HH:mm', { locale: es })
                            : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {pago.envio?.tracking_number || '-'}
                        </TableCell>
                        <TableCell>
                          {pago.cliente ? `${pago.cliente.nombre} ${pago.cliente.apellido || ''}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(pago.monto)}
                        </TableCell>
                        <TableCell>
                          {getMpStatusBadge(pago.mercado_pago_status)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(pago.estado)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {pago.mercado_pago_id || pago.referencia || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Por Cliente */}
        <TabsContent value="clientes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                Pagos por Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Client selector */}
              <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente con cuenta corriente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes?.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      <div className="flex items-center gap-2">
                        <span>{cliente.nombre} {cliente.apellido}</span>
                        <Badge variant="outline" className={cliente.saldo_cuenta_corriente && cliente.saldo_cuenta_corriente > 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(cliente.saldo_cuenta_corriente || 0)}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Client summary */}
              {selectedClienteData && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Saldo Actual</div>
                      <div className={`text-2xl font-bold ${(selectedClienteData.saldo_cuenta_corriente || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(selectedClienteData.saldo_cuenta_corriente || 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Límite de Crédito</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(selectedClienteData.limite_credito || 0)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Crédito Disponible</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency((selectedClienteData.limite_credito || 0) - (selectedClienteData.saldo_cuenta_corriente || 0))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Client payments table */}
              {selectedCliente && (
                <Card>
                  <CardContent className="p-0">
                    {isLoadingPagosCliente ? (
                      <div className="p-8 space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : (pagosCliente?.length || 0) === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        No hay pagos registrados para este cliente
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tracking</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Referencia</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagosCliente?.map((pago) => (
                            <TableRow key={pago.id}>
                              <TableCell className="whitespace-nowrap">
                                {pago.created_at 
                                  ? format(new Date(pago.created_at), 'dd/MM/yy HH:mm', { locale: es })
                                  : '-'}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {pago.envio?.tracking_number || '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getMethodIcon(pago.metodo)}
                                  <span className="text-sm">{getMethodLabel(pago.metodo)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(pago.monto)}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(pago.estado)}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {pago.referencia || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}

              {!selectedCliente && (
                <div className="text-center py-8 text-muted-foreground">
                  Selecciona un cliente para ver su historial de pagos
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      {selectedEnvio && (
        <PaymentMethodDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          trackingNumber={selectedEnvio.tracking_number}
          amount={selectedEnvio.precio_total}
          envioId={selectedEnvio.id}
          onConfirm={handleConfirmPayment}
          isLoading={isProcessingPayment}
        />
      )}
    </div>
  );
}
