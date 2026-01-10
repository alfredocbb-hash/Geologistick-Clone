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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Package, MapPin, User, Phone } from 'lucide-react';
import { toast } from 'sonner';

interface Shipment {
  id: string;
  tracking_number: string;
  estado: string;
  direccion_retiro: string | null;
  ciudad_retiro: string | null;
  remitente?: {
    nombre: string;
    apellido: string | null;
    telefono: string;
  } | null;
  destinatario?: {
    nombre: string;
    apellido: string | null;
  } | null;
}

interface PickupConfirmationProps {
  shipment: Shipment;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PickupConfirmation({ shipment, onClose, onSuccess }: PickupConfirmationProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [notas, setNotas] = useState('');

  const confirmMutation = useMutation({
    mutationFn: async () => {
      // Update shipment status
      const { error: updateError } = await supabase
        .from('envios')
        .update({
          estado: 'recogido',
          fecha_recogida: new Date().toISOString(),
          chofer_id: user?.id,
        })
        .eq('id', shipment.id);

      if (updateError) throw updateError;

      // Add history entry
      const { error: historyError } = await supabase
        .from('envio_historial')
        .insert({
          envio_id: shipment.id,
          estado_anterior: shipment.estado as any,
          estado_nuevo: 'recogido',
          notas: notas || 'Paquete retirado del remitente',
          ubicacion: shipment.direccion_retiro || null,
          created_by: user?.id,
        });

      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      toast.success('¡Retiro confirmado exitosamente!');
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error('Error al confirmar retiro: ' + error.message);
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Confirmar Retiro
          </DialogTitle>
          <DialogDescription>
            Confirma que has recogido el paquete del remitente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tracking */}
          <div className="text-center">
            <Badge variant="outline" className="font-mono text-lg px-4 py-2">
              {shipment.tracking_number}
            </Badge>
          </div>

          {/* Remitente info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {shipment.remitente 
                  ? `${shipment.remitente.nombre} ${shipment.remitente.apellido || ''}`
                  : 'Sin remitente'}
              </span>
            </div>
            
            {shipment.remitente?.telefono && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{shipment.remitente.telefono}</span>
              </div>
            )}

            {shipment.direccion_retiro && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>
                  {shipment.direccion_retiro}
                  {shipment.ciudad_retiro && `, ${shipment.ciudad_retiro}`}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              placeholder="Observaciones del retiro..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
            className="gap-2"
          >
            {confirmMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirmar Retiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
