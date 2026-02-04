import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Package,
  MapPin,
  Phone,
  Truck,
  CheckCircle,
  Loader2,
  AlertCircle,
  Navigation,
  Camera,
} from 'lucide-react';

interface MLDeliveryDialogProps {
  open: boolean;
  shipment: {
    id: string;
    tracking_number: string;
    estado: string;
    ml_shipment_id?: number | null;
    ml_order_id?: number | null;
    ml_sync_status?: string | null;
    nombre_destinatario?: string | null;
    direccion_entrega?: string | null;
    ciudad_entrega?: string | null;
    whatsapp_destinatario?: string | null;
    precio_total: number;
    pago_contra_entrega?: boolean | null;
    destinatario?: {
      nombre: string;
      apellido: string | null;
      telefono?: string;
    } | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function MLDeliveryDialog({ open, shipment, onClose, onSuccess }: MLDeliveryDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const destinatarioNombre = shipment.nombre_destinatario || 
    (shipment.destinatario ? `${shipment.destinatario.nombre} ${shipment.destinatario.apellido || ''}`.trim() : 'Destinatario');
  const telefono = shipment.whatsapp_destinatario || shipment.destinatario?.telefono || '';

  // Update status and sync with ML
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      setIsUpdating(true);

      // First update local status
      const updateData: Record<string, unknown> = {
        estado: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'recogido' || newStatus === 'en_reparto') {
        updateData.chofer_id = user?.id;
      }

      if (newStatus === 'en_reparto') {
        updateData.fecha_recogida = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('envios')
        .update(updateData)
        .eq('id', shipment.id);

      if (updateError) throw updateError;

      // Add history entry
      await supabase.from('envio_historial').insert({
        envio_id: shipment.id,
        estado_anterior: shipment.estado as any,
        estado_nuevo: newStatus as any,
        created_by: user?.id,
        notas: 'Estado actualizado desde app móvil (ML Flex)',
      });

      // Sync with MercadoLibre API
      try {
        const { error: syncError } = await supabase.functions.invoke('mercadolibre-update-status', {
          body: { envio_id: shipment.id, estado: newStatus },
        });
        
        if (syncError) {
          console.warn('ML sync failed:', syncError);
          toast.warning('Estado actualizado localmente, pero falló la sincronización con MercadoLibre');
        }
      } catch (syncErr) {
        console.warn('ML sync error:', syncErr);
      }

      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-recent-scans'] });
      toast.success(`Estado actualizado a: ${getStatusLabel(newStatus)}`);
      onSuccess();
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar el estado');
    },
    onSettled: () => {
      setIsUpdating(false);
    },
  });

  const getStatusLabel = (estado: string) => {
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      recogido: 'Recogido',
      en_sucursal: 'En Sucursal',
      en_transito: 'En tránsito',
      en_reparto: 'En reparto',
      entregado: 'Entregado',
      no_entregado: 'No entregado',
      cancelado: 'Cancelado',
      devuelto: 'Devuelto',
    };
    return labels[estado] || estado;
  };

  const getStatusColor = (estado: string) => {
    const colors: Record<string, string> = {
      pendiente: 'bg-yellow-500',
      recogido: 'bg-blue-500',
      en_sucursal: 'bg-purple-500',
      en_transito: 'bg-cyan-500',
      en_reparto: 'bg-orange-500',
      entregado: 'bg-green-500',
      no_entregado: 'bg-red-500',
      cancelado: 'bg-gray-500',
      devuelto: 'bg-pink-500',
    };
    return colors[estado] || 'bg-gray-500';
  };

  const getSyncStatusBadge = () => {
    if (!shipment.ml_shipment_id) return null;
    
    const status = shipment.ml_sync_status;
    if (status === 'synced') {
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Sincronizado</Badge>;
    } else if (status === 'error') {
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Error sync</Badge>;
    } else {
      return <Badge variant="secondary">Pendiente sync</Badge>;
    }
  };

  // Determine available actions based on current status
  const getAvailableActions = () => {
    const actions: Array<{
      label: string;
      status: string;
      variant: 'default' | 'outline' | 'secondary';
      icon: React.ReactNode;
    }> = [];

    switch (shipment.estado) {
      case 'pendiente':
        actions.push({
          label: 'Confirmar Pickup',
          status: 'recogido',
          variant: 'default',
          icon: <Truck className="w-4 h-4 mr-2" />,
        });
        break;
      case 'recogido':
      case 'en_sucursal':
        actions.push({
          label: 'Salir a Reparto',
          status: 'en_reparto',
          variant: 'default',
          icon: <Navigation className="w-4 h-4 mr-2" />,
        });
        break;
      case 'en_reparto':
        actions.push({
          label: 'Confirmar Entrega',
          status: 'entregado',
          variant: 'default',
          icon: <CheckCircle className="w-4 h-4 mr-2" />,
        });
        actions.push({
          label: 'No Entregado',
          status: 'no_entregado',
          variant: 'outline',
          icon: <AlertCircle className="w-4 h-4 mr-2" />,
        });
        break;
    }

    return actions;
  };

  const handleOpenMaps = () => {
    const address = encodeURIComponent(
      `${shipment.direccion_entrega || ''}, ${shipment.ciudad_entrega || ''}`
    );
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
  };

  const handleCall = () => {
    if (telefono) {
      window.open(`tel:${telefono}`, '_self');
    }
  };

  const actions = getAvailableActions();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {/* ML Logo */}
            <div className="w-8 h-8 rounded bg-yellow-400 flex items-center justify-center">
              <span className="text-xs font-bold text-yellow-900">ML</span>
            </div>
            <div>
              <DialogTitle className="text-lg">Envío MercadoLibre Flex</DialogTitle>
              <DialogDescription className="text-xs">
                Shipment ID: {shipment.ml_shipment_id}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getStatusColor(shipment.estado)}>
              {getStatusLabel(shipment.estado)}
            </Badge>
            {getSyncStatusBadge()}
          </div>

          {/* Tracking info */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{shipment.tracking_number}</span>
            </div>
            
            {shipment.ml_order_id && (
              <div className="text-xs text-muted-foreground">
                Orden ML: #{shipment.ml_order_id}
              </div>
            )}
          </div>

          <Separator />

          {/* Recipient info */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Destinatario</h4>
            
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">{destinatarioNombre}</p>
                <p className="text-muted-foreground">{shipment.direccion_entrega}</p>
                {shipment.ciudad_entrega && (
                  <p className="text-muted-foreground">{shipment.ciudad_entrega}</p>
                )}
              </div>
            </div>

            {telefono && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{telefono}</span>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleOpenMaps}>
              <Navigation className="w-4 h-4 mr-1" />
              Navegar
            </Button>
            {telefono && (
              <Button variant="outline" size="sm" className="flex-1" onClick={handleCall}>
                <Phone className="w-4 h-4 mr-1" />
                Llamar
              </Button>
            )}
          </div>

          {/* Payment info */}
          {shipment.pago_contra_entrega && (
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                💰 Cobrar al entregar: ${shipment.precio_total.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {actions.map((action) => (
            <Button
              key={action.status}
              variant={action.variant}
              className="w-full"
              disabled={isUpdating}
              onClick={() => updateStatusMutation.mutate(action.status)}
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                action.icon
              )}
              {action.label}
            </Button>
          ))}
          
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}