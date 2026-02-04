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
import { Loader2, Building2, Store, Package, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface Shipment {
  id: string;
  tracking_number: string;
  estado: string;
  destinatario?: {
    nombre: string;
    apellido: string | null;
  } | null;
  sucursal_destino?: {
    nombre: string;
    ciudad: string | null;
  } | null;
}

interface ReceiveShipmentDialogProps {
  shipment: Shipment;
  type: 'center' | 'branch';
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReceiveShipmentDialog({ 
  shipment, 
  type, 
  onClose, 
  onSuccess 
}: ReceiveShipmentDialogProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [notas, setNotas] = useState('');

  const isCenter = type === 'center';
  const newStatus = isCenter ? 'en_sucursal' : 'en_transito';
  const statusLabel = isCenter ? 'en centro logístico' : 'en sucursal';

  const receiveMutation = useMutation({
    mutationFn: async () => {
      // Update shipment status
      const updateData: Record<string, any> = {
        estado: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (!isCenter && profile?.sucursal_id) {
        updateData.sucursal_entrega_id = profile.sucursal_id;
      }

      const { error: updateError } = await supabase
        .from('envios')
        .update(updateData)
        .eq('id', shipment.id);

      if (updateError) throw updateError;

      // Add history entry
      const { error: historyError } = await supabase
        .from('envio_historial')
        .insert({
          envio_id: shipment.id,
          estado_anterior: shipment.estado as any,
          estado_nuevo: newStatus,
          notas: notas || `Paquete recibido ${statusLabel}`,
          created_by: user?.id,
        });

      if (historyError) throw historyError;

      // Create transfer record if moving to branch
      if (!isCenter && profile?.sucursal_id) {
        const { error: transferError } = await supabase
          .from('transferencias')
          .insert({
            envio_id: shipment.id,
            sucursal_origen_id: profile.sucursal_id, // Will be updated with proper origin
            sucursal_destino_id: profile.sucursal_id,
            tipo: 'recepcion',
            estado: 'recibido',
            fecha_recepcion: new Date().toISOString(),
            recibido_por: user?.id,
          });

        if (transferError) console.error('Transfer error:', transferError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      toast.success(`¡Paquete recibido ${statusLabel}!`);
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error('Error al recibir paquete: ' + error.message);
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCenter ? (
              <Building2 className="h-5 w-5 text-indigo-500" />
            ) : (
              <Store className="h-5 w-5 text-teal-500" />
            )}
            Recibir en {isCenter ? 'Centro Logístico' : 'Sucursal'}
          </DialogTitle>
          <DialogDescription>
            Confirma la recepción del paquete
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tracking */}
          <div className="text-center">
            <Badge variant="outline" className="font-mono text-lg px-4 py-2">
              {shipment.tracking_number}
            </Badge>
          </div>

          {/* Status change indicator */}
          <div className="flex items-center justify-center gap-2 text-sm">
            <Badge variant="secondary">{shipment.estado}</Badge>
            <ArrowRight className="h-4 w-4" />
            <Badge className={isCenter ? 'bg-indigo-500' : 'bg-teal-500'}>
              {newStatus.replace('_', ' ')}
            </Badge>
          </div>

          {/* Destination info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                Destinatario: {shipment.destinatario 
                  ? `${shipment.destinatario.nombre} ${shipment.destinatario.apellido || ''}`
                  : 'Sin destinatario'}
              </span>
            </div>
            
            {shipment.sucursal_destino && (
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span>
                  Destino: {shipment.sucursal_destino.nombre}
                  {shipment.sucursal_destino.ciudad && ` (${shipment.sucursal_destino.ciudad})`}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              placeholder="Observaciones de la recepción..."
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
            onClick={() => receiveMutation.mutate()}
            disabled={receiveMutation.isPending}
            className={`gap-2 ${isCenter ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-teal-500 hover:bg-teal-600'}`}
          >
            {receiveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCenter ? (
              <Building2 className="h-4 w-4" />
            ) : (
              <Store className="h-4 w-4" />
            )}
            Confirmar Recepción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
