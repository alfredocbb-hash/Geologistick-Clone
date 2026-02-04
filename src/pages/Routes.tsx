import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { MapPin, Package, Search, Truck, UserPlus, X, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type ShipmentStatus = Database['public']['Enums']['shipment_status'];

interface UnassignedShipment {
  id: string;
  tracking_number: string;
  estado: ShipmentStatus;
  precio_total: number;
  created_at: string;
  sucursal_destino?: { nombre: string } | null;
  destinatario?: {
    nombre: string;
    direccion: string;
    ciudad: string | null;
  } | null;
}

interface Driver {
  id: string;
  user_id: string;
  nombre: string;
  apellido: string | null;
  avatar_url: string | null;
  sucursal?: { nombre: string } | null;
}

interface DriverWithShipments extends Driver {
  shipments: {
    id: string;
    tracking_number: string;
    estado: ShipmentStatus;
    destinatario?: { nombre: string; direccion: string; ciudad: string | null } | null;
  }[];
}

export default function Routes() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedShipments, setSelectedShipments] = useState<string[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  // Fetch unassigned shipments (no chofer_id or pending status)
  const { data: unassignedShipments = [], isLoading: loadingShipments } = useQuery({
    queryKey: ['unassigned-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('envios')
        .select(`
          id,
          tracking_number,
          estado,
          precio_total,
          created_at,
          nombre_destinatario,
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, direccion, ciudad)
        `)
        .is('chofer_id', null)
        .in('estado', ['pendiente', 'recogido', 'en_bodega'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as UnassignedShipment[];
    },
  });

  // Fetch drivers with their current shipments
  const { data: driversWithShipments = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ['drivers-with-shipments'],
    queryFn: async () => {
      // Get drivers
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'chofer');

      if (rolesError) throw rolesError;
      if (!userRoles?.length) return [];

      const userIds = userRoles.map(r => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          nombre,
          apellido,
          avatar_url,
          sucursal:sucursales(nombre)
        `)
        .in('user_id', userIds)
        .eq('activo', true);

      if (profilesError) throw profilesError;

      // Get current shipments for each driver
      const { data: shipments, error: shipmentsError } = await supabase
        .from('envios')
        .select(`
          id,
          tracking_number,
          estado,
          chofer_id,
          destinatario:clientes!envios_destinatario_id_fkey(nombre, direccion, ciudad)
        `)
        .in('chofer_id', userIds)
        .in('estado', ['pendiente', 'recogido', 'en_bodega', 'en_transito', 'en_reparto']);

      if (shipmentsError) throw shipmentsError;

      // Combine data
      const driversData: DriverWithShipments[] = (profiles || []).map(profile => ({
        ...profile,
        shipments: (shipments || [])
          .filter(s => s.chofer_id === profile.user_id)
          .map(s => ({
            id: s.id,
            tracking_number: s.tracking_number,
            estado: s.estado as ShipmentStatus,
            destinatario: s.destinatario as { nombre: string; direccion: string; ciudad: string | null } | null,
          })),
      }));

      return driversData;
    },
  });

  // Mutation to assign shipments to driver
  const assignMutation = useMutation({
    mutationFn: async ({ shipmentIds, driverId }: { shipmentIds: string[]; driverId: string }) => {
      const { error } = await supabase
        .from('envios')
        .update({ chofer_id: driverId })
        .in('id', shipmentIds);

      if (error) throw error;

      // Create history entries
      for (const shipmentId of shipmentIds) {
        await supabase.from('envio_historial').insert({
          envio_id: shipmentId,
          estado_anterior: 'pendiente' as ShipmentStatus,
          estado_nuevo: 'pendiente' as ShipmentStatus,
          notas: 'Asignado a chofer',
        });
      }
    },
    onSuccess: () => {
      toast.success('Envíos asignados correctamente');
      queryClient.invalidateQueries({ queryKey: ['unassigned-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['drivers-with-shipments'] });
      setSelectedShipments([]);
      setAssignDialogOpen(false);
      setSelectedDriver(null);
    },
    onError: (error) => {
      toast.error('Error al asignar envíos: ' + error.message);
    },
  });

  // Mutation to unassign shipment
  const unassignMutation = useMutation({
    mutationFn: async (shipmentId: string) => {
      const { error } = await supabase
        .from('envios')
        .update({ chofer_id: null })
        .eq('id', shipmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Envío desasignado');
      queryClient.invalidateQueries({ queryKey: ['unassigned-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['drivers-with-shipments'] });
    },
    onError: (error) => {
      toast.error('Error al desasignar: ' + error.message);
    },
  });

  const filteredShipments = unassignedShipments.filter(shipment => {
    const matchesSearch = 
      shipment.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.destinatario?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.destinatario?.ciudad?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || shipment.estado === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const toggleShipmentSelection = (id: string) => {
    setSelectedShipments(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredShipments.map(s => s.id);
    setSelectedShipments(prev => {
      const allSelected = filteredIds.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !filteredIds.includes(id));
      }
      return [...new Set([...prev, ...filteredIds])];
    });
  };

  const handleAssign = () => {
    if (!selectedDriver || selectedShipments.length === 0) return;
    assignMutation.mutate({ shipmentIds: selectedShipments, driverId: selectedDriver });
  };

  const getStatusBadge = (estado: string) => {
    const config: Record<string, { label: string; className: string }> = {
      pendiente: { label: 'Pendiente', className: 'bg-warning/10 text-warning border-warning' },
      recogido: { label: 'Recogido', className: 'bg-info/10 text-info border-info' },
      en_bodega: { label: 'En Sucursal', className: 'bg-muted text-muted-foreground border-muted-foreground' },
      en_transito: { label: 'En Tránsito', className: 'bg-chofer/10 text-chofer border-chofer' },
      en_reparto: { label: 'En Reparto', className: 'bg-primary/10 text-primary border-primary' },
    };
    const c = config[estado] || { label: estado, className: '' };
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  const getInitials = (nombre: string, apellido?: string | null) => {
    return `${nombre.charAt(0)}${apellido?.charAt(0) || ''}`.toUpperCase();
  };

  const stats = {
    unassigned: unassignedShipments.length,
    inTransit: driversWithShipments.reduce((acc, d) => 
      acc + d.shipments.filter(s => s.estado === 'en_transito' || s.estado === 'en_reparto').length, 0
    ),
    activeDrivers: driversWithShipments.filter(d => d.shipments.length > 0).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rutas de Entrega</h1>
        <p className="text-muted-foreground">Asigna envíos a los choferes disponibles</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Asignar</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.unassigned}</div>
            <p className="text-xs text-muted-foreground">Envíos pendientes de asignación</p>
          </CardContent>
        </Card>
        <Card className="border-chofer/30 bg-chofer/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Tránsito</CardTitle>
            <Truck className="h-4 w-4 text-chofer" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chofer">{stats.inTransit}</div>
            <p className="text-xs text-muted-foreground">Envíos en camino</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Choferes Activos</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.activeDrivers}</div>
            <p className="text-xs text-muted-foreground">Con envíos asignados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Unassigned Shipments */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Envíos Sin Asignar
                </CardTitle>
                <CardDescription>Selecciona envíos para asignar a un chofer</CardDescription>
              </div>
              {selectedShipments.length > 0 && (
                <Button onClick={() => setAssignDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Asignar ({selectedShipments.length})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por tracking, nombre o ciudad..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="recogido">Recogido</SelectItem>
                    <SelectItem value="en_bodega">En Bodega</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filteredShipments.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={filteredShipments.every(s => selectedShipments.includes(s.id))}
                    onCheckedChange={selectAllFiltered}
                  />
                  <span className="text-sm text-muted-foreground">
                    Seleccionar todos ({filteredShipments.length})
                  </span>
                </div>
              )}
            </div>

            <ScrollArea className="h-[400px]">
              {loadingShipments ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredShipments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-success mb-4" />
                  <h3 className="text-lg font-semibold">Todo asignado</h3>
                  <p className="text-muted-foreground">No hay envíos pendientes de asignación</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredShipments.map((shipment) => (
                    <div
                      key={shipment.id}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedShipments.includes(shipment.id) 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleShipmentSelection(shipment.id)}
                    >
                      <Checkbox
                        checked={selectedShipments.includes(shipment.id)}
                        onCheckedChange={() => toggleShipmentSelection(shipment.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-medium">{shipment.tracking_number}</span>
                          {getStatusBadge(shipment.estado)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 truncate">
                          {(shipment as any).nombre_destinatario || shipment.destinatario?.nombre || 'Sin destinatario'} - {shipment.destinatario?.direccion || ''}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {shipment.destinatario?.ciudad && (
                            <>
                              <MapPin className="h-3 w-3" />
                              {shipment.destinatario.ciudad}
                            </>
                          )}
                          <Clock className="h-3 w-3 ml-2" />
                          {format(new Date(shipment.created_at), 'dd/MM HH:mm', { locale: es })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${shipment.precio_total.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Drivers with current routes */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Choferes y sus Rutas
            </CardTitle>
            <CardDescription>Vista actual de envíos asignados por chofer</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {loadingDrivers ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : driversWithShipments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Truck className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No hay choferes</h3>
                  <p className="text-muted-foreground">No se encontraron choferes activos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {driversWithShipments.map((driver) => (
                    <div key={driver.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar>
                          <AvatarImage src={driver.avatar_url || undefined} />
                          <AvatarFallback className="bg-chofer/10 text-chofer">
                            {getInitials(driver.nombre, driver.apellido)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium">{driver.nombre} {driver.apellido}</div>
                          <div className="text-sm text-muted-foreground">
                            {driver.sucursal?.nombre || 'Sin sucursal'}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {driver.shipments.length} envíos
                        </Badge>
                      </div>

                      {driver.shipments.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-2 bg-muted/30 rounded">
                          Sin envíos asignados
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {driver.shipments.slice(0, 3).map((shipment) => (
                            <div 
                              key={shipment.id}
                              className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="font-mono">{shipment.tracking_number}</span>
                                {getStatusBadge(shipment.estado)}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => unassignMutation.mutate(shipment.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          {driver.shipments.length > 3 && (
                            <div className="text-xs text-muted-foreground text-center">
                              +{driver.shipments.length - 3} más
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Envíos</DialogTitle>
            <DialogDescription>
              Selecciona un chofer para asignar {selectedShipments.length} envío(s)
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {driversWithShipments.map((driver) => (
                  <div
                    key={driver.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedDriver === driver.user_id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedDriver(driver.user_id)}
                  >
                    <Avatar>
                      <AvatarImage src={driver.avatar_url || undefined} />
                      <AvatarFallback className="bg-chofer/10 text-chofer">
                        {getInitials(driver.nombre, driver.apellido)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{driver.nombre} {driver.apellido}</div>
                      <div className="text-sm text-muted-foreground">
                        {driver.sucursal?.nombre || 'Sin sucursal'} • {driver.shipments.length} envíos actuales
                      </div>
                    </div>
                    {selectedDriver === driver.user_id && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAssign} 
              disabled={!selectedDriver || assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Asignando...' : 'Asignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
