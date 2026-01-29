import { useState, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Route, 
  User, 
  Truck, 
  Package, 
  Home,
  X,
  Plus,
  MapPin,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface RouteData {
  id: string;
  numero: string;
  estado: string;
  chofer_id: string | null;
  vehiculo_id: string | null;
  total_paradas: number;
  fecha: string;
}

interface EditRouteDialogProps {
  route: RouteData;
  onClose: () => void;
}

export default function EditRouteDialog({ route, onClose }: EditRouteDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedChofer, setSelectedChofer] = useState<string>(route.chofer_id || '');
  const [selectedVehiculo, setSelectedVehiculo] = useState<string>(route.vehiculo_id || '');
  const [envsToRemove, setEnvsToRemove] = useState<string[]>([]);
  const [envsToAdd, setEnvsToAdd] = useState<string[]>([]);
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});

  const isRouteInProgress = route.estado === 'en_curso' || route.estado === 'en_progreso';

  // Fetch route stops with shipment details
  const { data: paradas = [], isLoading: loadingParadas } = useQuery({
    queryKey: ['route-stops', route.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ruta_paradas')
        .select(`
          *,
          envio:envios(
            id,
            tracking_number,
            estado,
            direccion_entrega,
            direccion_retiro,
            requiere_retiro,
            nombre_remitente,
            nombre_destinatario,
            remitente:clientes!envios_remitente_id_fkey(nombre, apellido),
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido)
          )
        `)
        .eq('ruta_id', route.id)
        .order('orden');

      if (error) throw error;
      return data;
    },
  });

  // Fetch available drivers
  const { data: choferes = [] } = useQuery({
    queryKey: ['choferes-edit'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'chofer');
      
      if (rolesError) throw rolesError;
      
      const choferIds = roles?.map(r => r.user_id) || [];
      if (choferIds.length === 0) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', choferIds)
        .eq('activo', true);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch available vehicles
  const { data: vehiculos = [] } = useQuery({
    queryKey: ['vehiculos-edit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehiculos')
        .select('*')
        .in('estado', ['disponible', 'en_ruta']);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch available shipments to add
  const { data: enviosDisponibles = [] } = useQuery({
    queryKey: ['available-shipments-for-route'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('envios')
        .select(`
          id,
          tracking_number,
          estado,
          direccion_entrega,
          direccion_retiro,
          requiere_retiro,
          destinatario_lat,
          destinatario_lng,
          remitente_lat,
          remitente_lng,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, direccion),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, direccion)
        `)
        .in('estado', ['pendiente', 'recogido', 'en_bodega'])
        .is('chofer_id', null)
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Current stops (excluding those to be removed)
  const currentStops = useMemo(() => {
    return paradas.filter(p => !envsToRemove.includes(p.envio_id));
  }, [paradas, envsToRemove]);

  // Toggle remove shipment
  const toggleRemove = (envioId: string) => {
    setEnvsToRemove(prev => 
      prev.includes(envioId) 
        ? prev.filter(id => id !== envioId)
        : [...prev, envioId]
    );
  };

  // Toggle add shipment
  const toggleAdd = (envioId: string) => {
    setEnvsToAdd(prev => 
      prev.includes(envioId) 
        ? prev.filter(id => id !== envioId)
        : [...prev, envioId]
    );
  };

  // Set reschedule date for a shipment
  const setRescheduleDate = (envioId: string, date: string) => {
    setRescheduleDates(prev => ({
      ...prev,
      [envioId]: date
    }));
  };

  // Save changes mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Update route driver and vehicle
      const { error: routeError } = await supabase
        .from('rutas_planificadas')
        .update({
          chofer_id: selectedChofer || null,
          vehiculo_id: selectedVehiculo || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', route.id);

      if (routeError) throw routeError;

      // Remove shipments from route
      if (envsToRemove.length > 0) {
        // Delete stops
        const { error: deleteError } = await supabase
          .from('ruta_paradas')
          .delete()
          .eq('ruta_id', route.id)
          .in('envio_id', envsToRemove);

        if (deleteError) throw deleteError;

        // Reset shipments - check if they have reschedule dates
        for (const envioId of envsToRemove) {
          const rescheduleDate = rescheduleDates[envioId];
          
          const { error: resetError } = await supabase
            .from('envios')
            .update({
              chofer_id: null,
              estado: 'pendiente',
              ...(rescheduleDate && { ultima_reprogramacion: new Date().toISOString() })
            })
            .eq('id', envioId);

          if (resetError) throw resetError;

          // Add history entry
          await supabase.from('envio_historial').insert({
            envio_id: envioId,
            estado_anterior: 'en_reparto' as const,
            estado_nuevo: 'pendiente' as const,
            notas: rescheduleDate 
              ? `Removido de ruta ${route.numero}. Reprogramado para ${format(new Date(rescheduleDate), 'dd/MM/yyyy', { locale: es })}`
              : `Removido de ruta ${route.numero}`,
            created_by: user?.id,
          });
        }
      }

      // Add new shipments to route
      if (envsToAdd.length > 0) {
        const maxOrden = currentStops.length > 0 
          ? Math.max(...currentStops.map(p => p.orden || 0)) 
          : 0;

        const newStops = envsToAdd.map((envioId, index) => {
          const envio = enviosDisponibles.find(e => e.id === envioId);
          const isRetiro = envio?.requiere_retiro && envio?.estado === 'pendiente';
          
          return {
            ruta_id: route.id,
            envio_id: envioId,
            orden: maxOrden + index + 1,
            tipo: isRetiro ? 'retiro' : 'entrega',
            direccion: isRetiro 
              ? envio?.remitente?.direccion 
              : envio?.destinatario?.direccion,
            lat: isRetiro ? envio?.remitente_lat : envio?.destinatario_lat,
            lng: isRetiro ? envio?.remitente_lng : envio?.destinatario_lng,
          };
        });

        const { error: insertError } = await supabase
          .from('ruta_paradas')
          .insert(newStops);

        if (insertError) throw insertError;

        // Update shipments with driver
        const { error: updateError } = await supabase
          .from('envios')
          .update({
            chofer_id: selectedChofer,
            estado: 'en_reparto',
          })
          .in('id', envsToAdd);

        if (updateError) throw updateError;
      }

      // Update total stops count
      const newTotal = currentStops.length + envsToAdd.length;
      await supabase
        .from('rutas_planificadas')
        .update({ total_paradas: newTotal })
        .eq('id', route.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas-activas'] });
      queryClient.invalidateQueries({ queryKey: ['route-stops'] });
      queryClient.invalidateQueries({ queryKey: ['envios-planificador'] });
      queryClient.invalidateQueries({ queryKey: ['available-shipments-for-route'] });
      toast.success('Ruta actualizada correctamente');
      onClose();
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar ruta: ' + error.message);
    },
  });

  const hasChanges = 
    envsToRemove.length > 0 || 
    envsToAdd.length > 0 || 
    selectedChofer !== (route.chofer_id || '') ||
    selectedVehiculo !== (route.vehiculo_id || '');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            Editar Ruta {route.numero}
          </DialogTitle>
          <DialogDescription>
          Modifica los envíos, chofer o vehículo asignados a esta ruta
          </DialogDescription>
        </DialogHeader>

        {isRouteInProgress && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta ruta está en progreso. Los cambios afectarán inmediatamente al chofer.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="stops" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="stops" className="flex-1">
              Paradas ({currentStops.length})
            </TabsTrigger>
            <TabsTrigger value="add" className="flex-1">
              <Plus className="mr-1 h-3 w-3" />
              Agregar ({envsToAdd.length})
            </TabsTrigger>
            <TabsTrigger value="assign" className="flex-1">
              Asignación
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stops" className="mt-4">
            {loadingParadas ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : currentStops.length === 0 && envsToRemove.length === paradas.length ? (
              <p className="text-center text-muted-foreground py-8">
                Todos los envíos han sido removidos
              </p>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {paradas.map((parada) => {
                    const isRemoved = envsToRemove.includes(parada.envio_id);
                    const envio = parada.envio;
                    
                    return (
                      <div 
                        key={parada.id}
                        className={`p-3 rounded-lg border ${
                          isRemoved 
                            ? 'bg-destructive/10 border-destructive/50' 
                            : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs">
                            {parada.orden}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge variant={parada.tipo === 'retiro' ? 'secondary' : 'default'} className="text-xs">
                                {parada.tipo === 'retiro' ? (
                                  <><Home className="mr-1 h-3 w-3" />Retiro</>
                                ) : (
                                  <><Package className="mr-1 h-3 w-3" />Entrega</>
                                )}
                              </Badge>
                              <span className="font-mono text-xs text-muted-foreground">
                                {envio?.tracking_number}
                              </span>
                            </div>
                            <p className="text-sm truncate">
                              {parada.tipo === 'retiro' 
                                ? envio?.nombre_remitente || `${envio?.remitente?.nombre || ''} ${envio?.remitente?.apellido || ''}`.trim() || 'Sin remitente'
                                : envio?.nombre_destinatario || `${envio?.destinatario?.nombre || ''} ${envio?.destinatario?.apellido || ''}`.trim() || 'Sin destinatario'
                              }
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {parada.direccion}
                            </p>
                          </div>

                          <Button
                            variant={isRemoved ? 'outline' : 'ghost'}
                            size="sm"
                            onClick={() => toggleRemove(parada.envio_id)}
                          >
                            {isRemoved ? (
                              <><Plus className="h-4 w-4 mr-1" />Restaurar</>
                            ) : (
                              <><X className="h-4 w-4 mr-1" />Quitar</>
                            )}
                          </Button>
                        </div>
                        
                        {/* Reschedule date option when removed */}
                        {isRemoved && (
                          <div className="ml-9 mt-2 flex items-center gap-2 bg-muted/30 p-2 rounded">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs">Reprogramar para:</Label>
                            <Input
                              type="date"
                              className="h-7 text-xs w-auto"
                              min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                              value={rescheduleDates[parada.envio_id] || ''}
                              onChange={(e) => setRescheduleDate(parada.envio_id, e.target.value)}
                              placeholder="Opcional"
                            />
                            {rescheduleDates[parada.envio_id] && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => setRescheduleDate(parada.envio_id, '')}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
            
            {envsToRemove.length > 0 && (
              <p className="text-sm text-destructive mt-2">
                {envsToRemove.length} envío(s) serán removidos de la ruta
              </p>
            )}
          </TabsContent>

          <TabsContent value="add" className="mt-4">
            {enviosDisponibles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay envíos disponibles para agregar
              </p>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {enviosDisponibles.map((envio) => {
                    const isSelected = envsToAdd.includes(envio.id);
                    const isRetiro = envio.requiere_retiro && envio.estado === 'pendiente';
                    
                    return (
                      <div 
                        key={envio.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-primary/10 border-primary' 
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                        onClick={() => toggleAdd(envio.id)}
                      >
                        <Checkbox checked={isSelected} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant={isRetiro ? 'secondary' : 'default'} className="text-xs">
                              {isRetiro ? (
                                <><Home className="mr-1 h-3 w-3" />Retiro</>
                              ) : (
                                <><Package className="mr-1 h-3 w-3" />Entrega</>
                              )}
                            </Badge>
                            <span className="font-mono text-xs text-muted-foreground">
                              {envio.tracking_number}
                            </span>
                          </div>
                          <p className="text-sm truncate">
                            {isRetiro 
                              ? `${envio.remitente?.nombre} ${envio.remitente?.apellido || ''}`
                              : `${envio.destinatario?.nombre} ${envio.destinatario?.apellido || ''}`
                            }
                          </p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {isRetiro ? envio.remitente?.direccion : envio.destinatario?.direccion}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="assign" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Chofer Asignado
              </Label>
              <Select value={selectedChofer} onValueChange={setSelectedChofer}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar chofer" />
                </SelectTrigger>
                <SelectContent>
                  {choferes.map(chofer => (
                    <SelectItem key={chofer.user_id} value={chofer.user_id}>
                      {chofer.nombre} {chofer.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Vehículo
              </Label>
              <Select
                value={selectedVehiculo || 'none'}
                onValueChange={(v) => setSelectedVehiculo(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {vehiculos.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.patente} - {v.marca} {v.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
            className="gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Route className="h-4 w-4" />
            )}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
