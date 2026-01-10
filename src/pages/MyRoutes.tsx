import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Package, Truck, MapPin, Phone, CheckCircle, Clock, XCircle, AlertCircle, Navigation } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type ShipmentStatus = Database['public']['Enums']['shipment_status'];

interface MyShipment {
  id: string;
  tracking_number: string;
  estado: ShipmentStatus;
  precio_total: number;
  pago_contra_entrega: boolean;
  descripcion: string | null;
  notas: string | null;
  created_at: string;
  fecha_entrega: string | null;
  destinatario?: {
    nombre: string;
    apellido: string | null;
    direccion: string;
    ciudad: string | null;
    telefono: string;
  } | null;
  sucursal_destino?: { nombre: string } | null;
}

export default function MyRoutes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedShipment, setSelectedShipment] = useState<MyShipment | null>(null);
  const [actionType, setActionType] = useState<'pickup' | 'deliver' | 'return' | null>(null);
  const [notes, setNotes] = useState('');

  // Fetch my assigned shipments
  const { data: myShipments = [], isLoading } = useQuery({
    queryKey: ['my-shipments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('envios')
        .select(`
          id,
          tracking_number,
          estado,
          precio_total,
          pago_contra_entrega,
          descripcion,
          notas,
          created_at,
          fecha_entrega,
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, direccion, ciudad, telefono),
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre)
        `)
        .eq('chofer_id', user.id)
        .in('estado', ['pendiente', 'recogido', 'en_bodega', 'en_transito', 'en_reparto', 'entregado', 'devuelto'])
        .order('estado', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as MyShipment[];
    },
    enabled: !!user?.id,
  });

  // Mutation to update shipment status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      shipmentId, 
      newStatus, 
      notes 
    }: { 
      shipmentId: string; 
      newStatus: ShipmentStatus; 
      notes?: string;
    }) => {
      const currentShipment = myShipments.find(s => s.id === shipmentId);
      
      // Update shipment
      const updateData: Record<string, unknown> = { estado: newStatus };
      if (newStatus === 'entregado') {
        updateData.fecha_entrega = new Date().toISOString();
      }
      if (notes) {
        updateData.notas = notes;
      }

      const { error: updateError } = await supabase
        .from('envios')
        .update(updateData)
        .eq('id', shipmentId);

      if (updateError) throw updateError;

      // Create history entry
      const { error: historyError } = await supabase
        .from('envio_historial')
        .insert({
          envio_id: shipmentId,
          estado_anterior: currentShipment?.estado || 'pendiente',
          estado_nuevo: newStatus,
          notas: notes || null,
          created_by: user?.id,
        });

      if (historyError) throw historyError;

      // Generate driver commission when shipment is delivered
      if (newStatus === 'entregado' && user?.id) {
        // Fetch shipment with tarifa to calculate commission
        const { data: envioData } = await supabase
          .from('envios')
          .select(`
            id,
            precio_total,
            tarifa_id,
            tarifas:tarifas(comision_chofer_porcentaje, comision_chofer_fija)
          `)
          .eq('id', shipmentId)
          .single();

        if (envioData && envioData.tarifas) {
          const tarifa = envioData.tarifas as { comision_chofer_porcentaje: number | null; comision_chofer_fija: number | null };
          const porcentaje = tarifa.comision_chofer_porcentaje || 0;
          const montoFijo = tarifa.comision_chofer_fija || 0;
          const comisionPorcentaje = (envioData.precio_total * porcentaje) / 100;
          const montoTotal = comisionPorcentaje + montoFijo;

          if (montoTotal > 0) {
            // Check if commission already exists for this shipment
            const { data: existingCommission } = await supabase
              .from('comisiones')
              .select('id')
              .eq('envio_id', shipmentId)
              .eq('chofer_id', user.id)
              .maybeSingle();

            if (!existingCommission) {
              const { error: commissionError } = await supabase
                .from('comisiones')
                .insert({
                  chofer_id: user.id,
                  envio_id: shipmentId,
                  monto: montoTotal,
                  porcentaje_aplicado: porcentaje,
                  monto_fijo_aplicado: montoFijo,
                });

              if (commissionError) {
                console.error('Error creating commission:', commissionError);
                // Don't throw - commission is secondary, shipment update succeeded
              }
            }
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('Estado actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['my-shipments'] });
      closeActionDialog();
    },
    onError: (error) => {
      toast.error('Error al actualizar: ' + error.message);
    },
  });

  const openActionDialog = (shipment: MyShipment, action: 'pickup' | 'deliver' | 'return') => {
    setSelectedShipment(shipment);
    setActionType(action);
    setNotes('');
  };

  const closeActionDialog = () => {
    setSelectedShipment(null);
    setActionType(null);
    setNotes('');
  };

  const handleAction = () => {
    if (!selectedShipment || !actionType) return;

    let newStatus: ShipmentStatus;
    switch (actionType) {
      case 'pickup':
        newStatus = 'en_transito';
        break;
      case 'deliver':
        newStatus = 'entregado';
        break;
      case 'return':
        newStatus = 'devuelto';
        break;
      default:
        return;
    }

    updateStatusMutation.mutate({
      shipmentId: selectedShipment.id,
      newStatus,
      notes: notes || undefined,
    });
  };

  const getStatusBadge = (estado: ShipmentStatus) => {
    const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      pendiente: { 
        label: 'Pendiente', 
        className: 'bg-warning/10 text-warning border-warning',
        icon: <Clock className="h-3 w-3" />
      },
      recogido: { 
        label: 'Recogido', 
        className: 'bg-info/10 text-info border-info',
        icon: <Package className="h-3 w-3" />
      },
      en_bodega: { 
        label: 'En Bodega', 
        className: 'bg-muted text-muted-foreground border-muted-foreground',
        icon: <Package className="h-3 w-3" />
      },
      en_transito: { 
        label: 'En Tránsito', 
        className: 'bg-chofer/10 text-chofer border-chofer',
        icon: <Truck className="h-3 w-3" />
      },
      en_reparto: { 
        label: 'En Reparto', 
        className: 'bg-primary/10 text-primary border-primary',
        icon: <Navigation className="h-3 w-3" />
      },
      entregado: { 
        label: 'Entregado', 
        className: 'bg-success/10 text-success border-success',
        icon: <CheckCircle className="h-3 w-3" />
      },
      devuelto: { 
        label: 'Devuelto', 
        className: 'bg-destructive/10 text-destructive border-destructive',
        icon: <XCircle className="h-3 w-3" />
      },
      cancelado: { 
        label: 'Cancelado', 
        className: 'bg-muted text-muted-foreground border-muted-foreground',
        icon: <XCircle className="h-3 w-3" />
      },
    };
    const c = config[estado] || { label: estado, className: '', icon: null };
    return (
      <Badge variant="outline" className={`${c.className} flex items-center gap-1`}>
        {c.icon}
        {c.label}
      </Badge>
    );
  };

  const pendingShipments = myShipments.filter(s => 
    ['pendiente', 'recogido', 'en_bodega'].includes(s.estado)
  );
  const inTransitShipments = myShipments.filter(s => 
    ['en_transito', 'en_reparto'].includes(s.estado)
  );
  const completedShipments = myShipments.filter(s => 
    ['entregado', 'devuelto'].includes(s.estado)
  );

  const stats = {
    pending: pendingShipments.length,
    inTransit: inTransitShipments.length,
    completed: completedShipments.filter(s => s.estado === 'entregado').length,
    returned: completedShipments.filter(s => s.estado === 'devuelto').length,
  };

  const ShipmentCard = ({ shipment }: { shipment: MyShipment }) => {
    const canPickup = ['pendiente', 'recogido', 'en_bodega'].includes(shipment.estado);
    const canDeliver = ['en_transito', 'en_reparto'].includes(shipment.estado);
    const isCompleted = ['entregado', 'devuelto'].includes(shipment.estado);

    return (
      <Card className={isCompleted ? 'opacity-70' : ''}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono font-bold">{shipment.tracking_number}</span>
                {getStatusBadge(shipment.estado)}
              </div>
              {shipment.pago_contra_entrega && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500">
                  Pago contra entrega
                </Badge>
              )}
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">${shipment.precio_total.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(shipment.created_at), 'dd/MM/yy', { locale: es })}
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-medium">
                  {shipment.destinatario?.nombre} {shipment.destinatario?.apellido}
                </div>
                <div className="text-muted-foreground">
                  {shipment.destinatario?.direccion}
                  {shipment.destinatario?.ciudad && `, ${shipment.destinatario.ciudad}`}
                </div>
              </div>
            </div>
            
            {shipment.destinatario?.telefono && (
              <a 
                href={`tel:${shipment.destinatario.telefono}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Phone className="h-4 w-4" />
                {shipment.destinatario.telefono}
              </a>
            )}

            {shipment.descripcion && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                <span className="font-medium">Descripción:</span> {shipment.descripcion}
              </div>
            )}

            {shipment.notas && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                <span className="font-medium">Notas:</span> {shipment.notas}
              </div>
            )}
          </div>

          {!isCompleted && (
            <div className="flex gap-2">
              {canPickup && (
                <Button 
                  className="flex-1 bg-chofer hover:bg-chofer/90"
                  onClick={() => openActionDialog(shipment, 'pickup')}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Recoger
                </Button>
              )}
              {canDeliver && (
                <>
                  <Button 
                    className="flex-1 bg-success hover:bg-success/90"
                    onClick={() => openActionDialog(shipment, 'deliver')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Entregar
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => openActionDialog(shipment, 'return')}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Devolver
                  </Button>
                </>
              )}
            </div>
          )}

          {shipment.estado === 'entregado' && shipment.fecha_entrega && (
            <div className="text-sm text-success flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Entregado el {format(new Date(shipment.fecha_entrega), 'dd/MM/yy HH:mm', { locale: es })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mis Rutas</h1>
        <p className="text-muted-foreground">Gestiona tus envíos asignados</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Recoger</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="border-chofer/30 bg-chofer/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Tránsito</CardTitle>
            <Truck className="h-4 w-4 text-chofer" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chofer">{stats.inTransit}</div>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregados</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devueltos</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.returned}</div>
          </CardContent>
        </Card>
      </div>

      {/* Shipments Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendientes
            {stats.pending > 0 && (
              <Badge variant="secondary" className="ml-1">{stats.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="transit" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            En Tránsito
            {stats.inTransit > 0 && (
              <Badge variant="secondary" className="ml-1">{stats.inTransit}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : pendingShipments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-success mb-4" />
                <h3 className="text-lg font-semibold">Sin pendientes</h3>
                <p className="text-muted-foreground">No tienes envíos pendientes de recoger</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingShipments.map((shipment) => (
                <ShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transit" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : inTransitShipments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Sin envíos en tránsito</h3>
                <p className="text-muted-foreground">Recoge envíos pendientes para verlos aquí</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {inTransitShipments.map((shipment) => (
                <ShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : completedShipments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Sin entregas completadas</h3>
                <p className="text-muted-foreground">Tus entregas completadas aparecerán aquí</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {completedShipments.map((shipment) => (
                <ShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'pickup' && 'Confirmar Recogida'}
              {actionType === 'deliver' && 'Confirmar Entrega'}
              {actionType === 'return' && 'Registrar Devolución'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'pickup' && 'El envío pasará a estado "En Tránsito"'}
              {actionType === 'deliver' && 'El envío se marcará como entregado'}
              {actionType === 'return' && 'El envío se marcará como devuelto'}
            </DialogDescription>
          </DialogHeader>

          {selectedShipment && (
            <div className="py-4">
              <div className="bg-muted/50 p-4 rounded-lg mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold">{selectedShipment.tracking_number}</span>
                  <span className="font-bold">${selectedShipment.precio_total.toFixed(2)}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedShipment.destinatario?.nombre} - {selectedShipment.destinatario?.direccion}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {actionType === 'return' ? 'Razón de la devolución *' : 'Notas (opcional)'}
                </label>
                <Textarea
                  placeholder={
                    actionType === 'return' 
                      ? 'Ej: Destinatario no encontrado, dirección incorrecta...'
                      : 'Agregar notas sobre la entrega...'
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAction}
              disabled={updateStatusMutation.isPending || (actionType === 'return' && !notes.trim())}
              className={
                actionType === 'deliver' 
                  ? 'bg-success hover:bg-success/90' 
                  : actionType === 'return'
                  ? 'bg-destructive hover:bg-destructive/90'
                  : 'bg-chofer hover:bg-chofer/90'
              }
            >
              {updateStatusMutation.isPending ? 'Procesando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
