import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Clock, 
  Package, 
  Building2, 
  Truck, 
  CheckCircle, 
  AlertCircle,
  ArrowRight,
  Shield,
  CalendarClock,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ShipmentStatus = Database['public']['Enums']['shipment_status'];

interface ChangeStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envioId: string | null;
  currentStatus: ShipmentStatus;
  trackingNumber: string;
}

const statusConfig: Record<ShipmentStatus, { label: string; color: string; icon: React.ElementType; description: string }> = {
  pendiente: { 
    label: 'Pendiente', 
    color: 'bg-yellow-500', 
    icon: Clock, 
    description: 'El envío está esperando ser procesado' 
  },
  recogido: { 
    label: 'Recogido', 
    color: 'bg-blue-500', 
    icon: Package, 
    description: 'El paquete fue recogido del remitente' 
  },
  en_sucursal: { 
    label: 'En Sucursal', 
    color: 'bg-purple-500', 
    icon: Building2, 
    description: 'El paquete está en la sucursal listo para despacho' 
  },
  en_bodega: { 
    label: 'En Sucursal', 
    color: 'bg-purple-500', 
    icon: Building2, 
    description: 'El paquete está en la sucursal listo para despacho' 
  },
  en_transito: { 
    label: 'En Tránsito', 
    color: 'bg-blue-600', 
    icon: Truck, 
    description: 'El paquete está en camino entre sucursales' 
  },
  en_reparto: { 
    label: 'En Reparto', 
    color: 'bg-orange-500', 
    icon: Truck, 
    description: 'El paquete está siendo llevado al destinatario' 
  },
  entregado: { 
    label: 'Entregado', 
    color: 'bg-green-500', 
    icon: CheckCircle, 
    description: 'El paquete fue entregado exitosamente' 
  },
  devuelto: { 
    label: 'Devuelto', 
    color: 'bg-red-500', 
    icon: AlertCircle, 
    description: 'El paquete fue devuelto al remitente' 
  },
  cancelado: { 
    label: 'Cancelado', 
    color: 'bg-gray-500', 
    icon: AlertCircle, 
    description: 'El envío fue cancelado' 
  },
  incidencia: { 
    label: 'Incidencia', 
    color: 'bg-amber-500', 
    icon: AlertCircle, 
    description: 'El envío tiene un problema reportado pendiente de resolver' 
  },
  no_entregado: { 
    label: 'No Entregado', 
    color: 'bg-red-600', 
    icon: AlertCircle, 
    description: 'El envío no pudo ser entregado' 
  },
  primera_visita: { 
    label: '1a Visita', 
    color: 'bg-amber-600', 
    icon: AlertCircle, 
    description: 'Primer intento de entrega fallido - destinatario ausente' 
  },
  segunda_visita: { 
    label: '2a Visita', 
    color: 'bg-red-400', 
    icon: AlertCircle, 
    description: 'Segundo intento de entrega fallido' 
  },
  reprogramado: { 
    label: 'Reprogramado', 
    color: 'bg-indigo-500', 
    icon: CalendarClock, 
    description: 'La entrega fue reprogramada para otra fecha' 
  },
};

const statusOrder: ShipmentStatus[] = [
  'pendiente',
  'recogido',
  'en_sucursal',
  'en_transito',
  'en_reparto',
  'primera_visita',
  'segunda_visita',
  'reprogramado',
  'entregado',
  'devuelto',
  'cancelado',
];

export function ChangeStatusDialog({ 
  open, 
  onOpenChange, 
  envioId,
  currentStatus,
  trackingNumber,
}: ChangeStatusDialogProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState<ShipmentStatus | null>(null);
  const [notes, setNotes] = useState('');

  const changeStatusMutation = useMutation({
    mutationFn: async () => {
      if (!envioId || !newStatus) throw new Error('Datos incompletos');

      // Build update payload
      const updateData: Record<string, any> = { estado: newStatus };
      if (newStatus === 'pendiente') {
        updateData.chofer_id = null;
      }
      if ((newStatus === 'en_sucursal' || newStatus === 'en_bodega') && profile?.sucursal_id) {
        updateData.sucursal_entrega_id = profile.sucursal_id;
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from('envios')
        .update(updateData)
        .eq('id', envioId)
        .select('id');
      
      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('No se pudo actualizar el envío. Verificá que tenés permisos para modificar envíos de esta sucursal.');
      }

      // Only insert manual history if user wrote custom notes
      // (the DB trigger log_envio_estado_change already creates an entry with branch name)
      if (notes && notes.trim()) {
        const { error: historyError } = await supabase
          .from('envio_historial')
          .insert({
            envio_id: envioId,
            estado_anterior: currentStatus,
            estado_nuevo: newStatus,
            notas: notes,
            created_by: user?.id
          });
        
        if (historyError) throw historyError;
      }

      // Si se cancela, anular pagos y compensar caja
      if (newStatus === 'cancelado') {
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
      }
    },
    onSuccess: () => {
      toast.success(`Estado actualizado a "${statusConfig[newStatus!].label}"`);
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      queryClient.invalidateQueries({ queryKey: ['envios-stats'] });
      queryClient.invalidateQueries({ queryKey: ['envio-details', envioId] });
      queryClient.invalidateQueries({ queryKey: ['envio-historial', envioId] });

      // Fire-and-forget: send email notification for relevant status changes
      const relevantStates = ['en_sucursal', 'en_reparto', 'entregado', 'devuelto'];
      if (newStatus && relevantStates.includes(newStatus) && envioId) {
        (async () => {
          try {
            const { data: envio } = await supabase
              .from('envios')
              .select('email_destinatario, tracking_number, nombre_destinatario, direccion_entrega, tenant_id, pago_contra_entrega, precio_total')
              .eq('id', envioId)
              .single();
            if (envio?.email_destinatario && envio?.tenant_id) {
              const { sendShipmentEmail } = await import('@/lib/emailNotifications');
              sendShipmentEmail({
                tenant_id: envio.tenant_id,
                to: envio.email_destinatario,
                template: 'status_change',
                data: {
                  tracking_number: envio.tracking_number,
                  estado_nuevo: newStatus,
                  nombre_destinatario: envio.nombre_destinatario || '',
                  direccion_entrega: envio.direccion_entrega || '',
                  pago_contra_entrega: envio.pago_contra_entrega || false,
                  precio_total: envio.precio_total,
                  tracking_url: `${window.location.origin}/tracking?q=${envio.tracking_number}`,
                },
              });
            }
          } catch (e) {
            console.error('[ChangeStatus] Email notification error:', e);
          }
        })();
      }

      handleClose();
    },
    onError: (error) => {
      toast.error('Error al cambiar el estado');
      console.error(error);
    }
  });

  const handleClose = () => {
    setNewStatus(null);
    setNotes('');
    onOpenChange(false);
  };

  const availableStatuses = statusOrder.filter(s => s !== currentStatus);
  const currentConfig = currentStatus ? statusConfig[currentStatus] : null;

  if (!open || !currentConfig) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Cambiar Estado del Envío
          </DialogTitle>
          <DialogDescription>
            Cambiando estado de <strong className="font-mono">{trackingNumber}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Current Status */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">Estado actual:</span>
          <Badge className={`${currentConfig.color} text-white`}>
            {currentConfig.label}
          </Badge>
        </div>

        {/* Status Selection */}
        <div className="space-y-3">
          <Label>Nuevo estado</Label>
          <RadioGroup 
            value={newStatus || ''} 
            onValueChange={(val) => setNewStatus(val as ShipmentStatus)}
            className="grid grid-cols-2 gap-2"
          >
            {availableStatuses.map((status) => {
              const config = statusConfig[status];
              const Icon = config.icon;
              return (
                <label
                  key={status}
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                    newStatus === status ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
                  }`}
                >
                  <RadioGroupItem value={status} id={status} className="sr-only" />
                  <div className={`${config.color} p-1.5 rounded-full text-white`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <span className="text-sm font-medium">{config.label}</span>
                </label>
              );
            })}
          </RadioGroup>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notas (opcional)</Label>
          <Textarea
            placeholder="Agregar notas sobre el cambio de estado..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Preview */}
        {newStatus && (
          <div className="flex items-center justify-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Badge className={`${currentConfig.color} text-white`}>
              {currentConfig.label}
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge className={`${statusConfig[newStatus].color} text-white`}>
              {statusConfig[newStatus].label}
            </Badge>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => changeStatusMutation.mutate()}
            disabled={!newStatus || changeStatusMutation.isPending}
          >
            {changeStatusMutation.isPending ? 'Guardando...' : 'Confirmar Cambio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
