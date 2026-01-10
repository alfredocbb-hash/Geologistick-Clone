import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Search, Phone, MapPin, Package, CheckCircle, Clock, AlertCircle, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Driver {
  id: string;
  user_id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  email: string;
  avatar_url: string | null;
  sucursal_id: string | null;
  activo: boolean;
  sucursal?: {
    nombre: string;
  } | null;
}

interface DriverShipment {
  id: string;
  tracking_number: string;
  estado: string;
  destinatario?: {
    nombre: string;
    direccion: string;
    ciudad: string | null;
  } | null;
  precio_total: number;
  created_at: string;
  fecha_entrega: string | null;
}

export default function Drivers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sucursalFilter, setSucursalFilter] = useState<string>('all');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // Fetch drivers (users with chofer role)
  const { data: drivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      // First get all users with chofer role
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'chofer');

      if (rolesError) throw rolesError;
      if (!userRoles?.length) return [];

      const userIds = userRoles.map(r => r.user_id);

      // Then get their profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          nombre,
          apellido,
          telefono,
          email,
          avatar_url,
          sucursal_id,
          activo,
          sucursal:sucursales(nombre)
        `)
        .in('user_id', userIds);

      if (profilesError) throw profilesError;
      return profiles as Driver[];
    },
  });

  // Fetch sucursales for filter
  const { data: sucursales = [] } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  // Fetch today's shipments count per driver
  const { data: shipmentCounts = {} } = useQuery({
    queryKey: ['driver-shipment-counts'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('envios')
        .select('chofer_id, estado')
        .not('chofer_id', 'is', null)
        .gte('created_at', today.toISOString());

      if (error) throw error;

      const counts: Record<string, { pending: number; completed: number; inTransit: number }> = {};
      
      data?.forEach(envio => {
        if (!envio.chofer_id) return;
        if (!counts[envio.chofer_id]) {
          counts[envio.chofer_id] = { pending: 0, completed: 0, inTransit: 0 };
        }
        
        if (envio.estado === 'entregado') {
          counts[envio.chofer_id].completed++;
        } else if (envio.estado === 'en_transito' || envio.estado === 'en_reparto') {
          counts[envio.chofer_id].inTransit++;
        } else if (envio.estado !== 'cancelado' && envio.estado !== 'devuelto') {
          counts[envio.chofer_id].pending++;
        }
      });

      return counts;
    },
  });

  // Fetch selected driver's shipments
  const { data: driverShipments = [], isLoading: loadingShipments } = useQuery({
    queryKey: ['driver-shipments', selectedDriver?.user_id],
    queryFn: async () => {
      if (!selectedDriver) return [];
      
      const { data, error } = await supabase
        .from('envios')
        .select(`
          id,
          tracking_number,
          estado,
          precio_total,
          created_at,
          fecha_entrega,
          destinatario:clientes!envios_destinatario_id_fkey(nombre, direccion, ciudad)
        `)
        .eq('chofer_id', selectedDriver.user_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as DriverShipment[];
    },
    enabled: !!selectedDriver,
  });

  const getDriverStatus = (userId: string) => {
    const counts = shipmentCounts[userId];
    if (!counts) return 'disponible';
    if (counts.inTransit > 0) return 'en_ruta';
    if (counts.pending > 0) return 'con_pendientes';
    return 'disponible';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'en_ruta':
        return <Badge className="bg-chofer text-chofer-foreground">En Ruta</Badge>;
      case 'con_pendientes':
        return <Badge variant="outline" className="border-warning text-warning">Con Pendientes</Badge>;
      case 'disponible':
        return <Badge variant="outline" className="border-success text-success">Disponible</Badge>;
      default:
        return <Badge variant="secondary">Inactivo</Badge>;
    }
  };

  const getShipmentStatusBadge = (estado: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pendiente: { label: 'Pendiente', className: 'bg-warning/10 text-warning border-warning' },
      recogido: { label: 'Recogido', className: 'bg-info/10 text-info border-info' },
      en_bodega: { label: 'En Bodega', className: 'bg-muted text-muted-foreground border-muted-foreground' },
      en_transito: { label: 'En Tránsito', className: 'bg-chofer/10 text-chofer border-chofer' },
      en_reparto: { label: 'En Reparto', className: 'bg-primary/10 text-primary border-primary' },
      entregado: { label: 'Entregado', className: 'bg-success/10 text-success border-success' },
      devuelto: { label: 'Devuelto', className: 'bg-destructive/10 text-destructive border-destructive' },
      cancelado: { label: 'Cancelado', className: 'bg-muted text-muted-foreground border-muted-foreground' },
    };
    const config = statusConfig[estado] || { label: estado, className: '' };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = 
      driver.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.apellido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSucursal = sucursalFilter === 'all' || driver.sucursal_id === sucursalFilter;
    
    const driverStatus = getDriverStatus(driver.user_id);
    const matchesStatus = statusFilter === 'all' || driverStatus === statusFilter;
    
    const matchesActive = driver.activo;

    return matchesSearch && matchesSucursal && matchesStatus && matchesActive;
  });

  const stats = {
    total: drivers.filter(d => d.activo).length,
    enRuta: drivers.filter(d => d.activo && getDriverStatus(d.user_id) === 'en_ruta').length,
    disponibles: drivers.filter(d => d.activo && getDriverStatus(d.user_id) === 'disponible').length,
    conPendientes: drivers.filter(d => d.activo && getDriverStatus(d.user_id) === 'con_pendientes').length,
  };

  const getInitials = (nombre: string, apellido?: string | null) => {
    return `${nombre.charAt(0)}${apellido?.charAt(0) || ''}`.toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Choferes Activos</h1>
        <p className="text-muted-foreground">Gestión y monitoreo de choferes en ruta</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Choferes</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Choferes activos</p>
          </CardContent>
        </Card>
        <Card className="border-chofer/30 bg-chofer/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Ruta</CardTitle>
            <MapPin className="h-4 w-4 text-chofer" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chofer">{stats.enRuta}</div>
            <p className="text-xs text-muted-foreground">Realizando entregas</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponibles</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.disponibles}</div>
            <p className="text-xs text-muted-foreground">Sin envíos activos</p>
          </CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.conPendientes}</div>
            <p className="text-xs text-muted-foreground">Envíos por recoger</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Choferes</CardTitle>
          <CardDescription>Visualiza y gestiona los choferes del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="en_ruta">En Ruta</SelectItem>
                <SelectItem value="disponible">Disponible</SelectItem>
                <SelectItem value="con_pendientes">Con Pendientes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingDrivers ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No hay choferes</h3>
              <p className="text-muted-foreground">No se encontraron choferes con los filtros seleccionados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Pendientes</TableHead>
                  <TableHead className="text-center">En Tránsito</TableHead>
                  <TableHead className="text-center">Completados</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.map((driver) => {
                  const counts = shipmentCounts[driver.user_id] || { pending: 0, completed: 0, inTransit: 0 };
                  const status = getDriverStatus(driver.user_id);
                  
                  return (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={driver.avatar_url || undefined} />
                            <AvatarFallback className="bg-chofer/10 text-chofer">
                              {getInitials(driver.nombre, driver.apellido)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{driver.nombre} {driver.apellido}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {driver.telefono || 'Sin teléfono'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {driver.sucursal?.nombre || <span className="text-muted-foreground">Sin asignar</span>}
                      </TableCell>
                      <TableCell>{getStatusBadge(status)}</TableCell>
                      <TableCell className="text-center">
                        <span className={counts.pending > 0 ? 'font-medium text-warning' : 'text-muted-foreground'}>
                          {counts.pending}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={counts.inTransit > 0 ? 'font-medium text-chofer' : 'text-muted-foreground'}>
                          {counts.inTransit}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={counts.completed > 0 ? 'font-medium text-success' : 'text-muted-foreground'}>
                          {counts.completed}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedDriver(driver)}
                        >
                          Ver Detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Driver Details Dialog */}
      <Dialog open={!!selectedDriver} onOpenChange={(open) => !open && setSelectedDriver(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedDriver?.avatar_url || undefined} />
                <AvatarFallback className="bg-chofer/10 text-chofer">
                  {selectedDriver ? getInitials(selectedDriver.nombre, selectedDriver.apellido) : ''}
                </AvatarFallback>
              </Avatar>
              <div>
                <span>{selectedDriver?.nombre} {selectedDriver?.apellido}</span>
                <p className="text-sm font-normal text-muted-foreground">{selectedDriver?.email}</p>
              </div>
            </DialogTitle>
            <DialogDescription>
              Detalles del chofer y sus envíos asignados
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {/* Driver Info */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Phone className="h-4 w-4" />
                    Teléfono
                  </div>
                  <div className="font-medium">{selectedDriver?.telefono || 'No registrado'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <MapPin className="h-4 w-4" />
                    Sucursal
                  </div>
                  <div className="font-medium">{selectedDriver?.sucursal?.nombre || 'Sin asignar'}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <User className="h-4 w-4" />
                    Estado
                  </div>
                  <div>{selectedDriver && getStatusBadge(getDriverStatus(selectedDriver.user_id))}</div>
                </CardContent>
              </Card>
            </div>

            {/* Shipments */}
            <Tabs defaultValue="all" className="w-full">
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="pending">Pendientes</TabsTrigger>
                <TabsTrigger value="transit">En Tránsito</TabsTrigger>
                <TabsTrigger value="completed">Completados</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                {loadingShipments ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : driverShipments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2" />
                    <p>No hay envíos asignados</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-auto">
                    {driverShipments.map((shipment) => (
                      <div 
                        key={shipment.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">{shipment.tracking_number}</span>
                            {getShipmentStatusBadge(shipment.estado)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {shipment.destinatario?.nombre} - {shipment.destinatario?.direccion}
                            {shipment.destinatario?.ciudad && `, ${shipment.destinatario.ciudad}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${shipment.precio_total.toFixed(2)}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(shipment.created_at), 'dd/MM/yy', { locale: es })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pending" className="mt-4">
                <div className="space-y-2 max-h-[300px] overflow-auto">
                  {driverShipments
                    .filter(s => ['pendiente', 'recogido', 'en_bodega'].includes(s.estado))
                    .map((shipment) => (
                      <div 
                        key={shipment.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">{shipment.tracking_number}</span>
                            {getShipmentStatusBadge(shipment.estado)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {shipment.destinatario?.nombre} - {shipment.destinatario?.direccion}
                          </div>
                        </div>
                        <div className="text-right font-medium">${shipment.precio_total.toFixed(2)}</div>
                      </div>
                    ))}
                  {driverShipments.filter(s => ['pendiente', 'recogido', 'en_bodega'].includes(s.estado)).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">No hay envíos pendientes</div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="transit" className="mt-4">
                <div className="space-y-2 max-h-[300px] overflow-auto">
                  {driverShipments
                    .filter(s => ['en_transito', 'en_reparto'].includes(s.estado))
                    .map((shipment) => (
                      <div 
                        key={shipment.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">{shipment.tracking_number}</span>
                            {getShipmentStatusBadge(shipment.estado)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {shipment.destinatario?.nombre} - {shipment.destinatario?.direccion}
                          </div>
                        </div>
                        <div className="text-right font-medium">${shipment.precio_total.toFixed(2)}</div>
                      </div>
                    ))}
                  {driverShipments.filter(s => ['en_transito', 'en_reparto'].includes(s.estado)).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">No hay envíos en tránsito</div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="completed" className="mt-4">
                <div className="space-y-2 max-h-[300px] overflow-auto">
                  {driverShipments
                    .filter(s => s.estado === 'entregado')
                    .map((shipment) => (
                      <div 
                        key={shipment.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">{shipment.tracking_number}</span>
                            {getShipmentStatusBadge(shipment.estado)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {shipment.destinatario?.nombre} - {shipment.destinatario?.direccion}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${shipment.precio_total.toFixed(2)}</div>
                          {shipment.fecha_entrega && (
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(shipment.fecha_entrega), 'dd/MM/yy HH:mm', { locale: es })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  {driverShipments.filter(s => s.estado === 'entregado').length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">No hay envíos completados</div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
