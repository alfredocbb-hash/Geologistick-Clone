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
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, Package, MapPin, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Shipment {
  id: string;
  tracking_number: string;
  estado: string;
  direccion_entrega: string | null;
  ciudad_entrega?: string | null;
  destinatario?: {
    nombre: string;
    apellido: string | null;
    telefono?: string;
  } | null;
  chofer_id?: string | null;
}

interface UltimaMillaDialogProps {
  open: boolean;
  shipment: Shipment;
  onClose: () => void;
  onSuccess: () => void;
}

export function UltimaMillaDialog({ open, shipment, onClose, onSuccess }: UltimaMillaDialogProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const takeLastMileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuario no autenticado');

      // Update shipment with last-mile driver
      const { error: updateError } = await supabase
        .from('envios')
        .update({
          chofer_ultima_milla_id: user.id,
          fecha_asignacion_ultima_milla: new Date().toISOString(),
        })
        .eq('id', shipment.id);

      if (updateError) throw updateError;

      // Record in history WITHOUT changing the status
      const { error: historyError } = await supabase
        .from('envio_historial')
        .insert({
          envio_id: shipment.id,
          estado_anterior: shipment.estado as any,
          estado_nuevo: shipment.estado as any, // SAME STATUS
          notas: `Paquete tomado para última milla por ${profile?.nombre || 'Chofer'} ${profile?.apellido || ''}`.trim(),
          created_by: user.id,
        });

      if (historyError) throw historyError;
    },
    onSuccess: () => {
      toast.success('Paquete tomado para última milla', {
        description: 'Ahora puedes entregar este paquete',
      });
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-recent-scans'] });
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error('Error al tomar paquete: ' + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-warning" />
            Tomar para Última Milla
          </DialogTitle>
          <DialogDescription>
            Este envío está asignado a otro chofer. ¿Deseas tomarlo para completar la entrega?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Alert */}
          <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning">Envío asignado a otro chofer</p>
              <p className="text-muted-foreground mt-1">
                Al tomar este paquete, quedarás registrado como responsable de la última milla. 
                La comisión se calculará para ti al confirmar la entrega.
              </p>
            </div>
          </div>

          {/* Tracking */}
          <div className="text-center">
            <Badge variant="outline" className="font-mono text-lg px-4 py-2">
              {shipment.tracking_number}
            </Badge>
          </div>

          {/* Shipment info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Estado actual:</span>
              <Badge variant="secondary">
                {shipment.estado === 'en_transito' ? 'En Tránsito' : 
                 shipment.estado === 'en_reparto' ? 'En Reparto' : shipment.estado}
              </Badge>
            </div>
            
            {shipment.destinatario && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {shipment.destinatario.nombre} {shipment.destinatario.apellido || ''}
                </span>
              </div>
            )}
            
            {shipment.direccion_entrega && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm">
                  {shipment.direccion_entrega}
                  {shipment.ciudad_entrega && `, ${shipment.ciudad_entrega}`}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => takeLastMileMutation.mutate()}
            disabled={takeLastMileMutation.isPending}
            className="gap-2 bg-warning hover:bg-warning/90 text-warning-foreground"
          >
            {takeLastMileMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Truck className="h-4 w-4" />
            )}
            Tomar Paquete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
