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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Shipment {
  id: string;
  tracking_number: string;
  estado: string;
  fecha_entrega: string | null;
}

interface RescheduleDialogProps {
  shipment: Shipment;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RescheduleDialog({ shipment, onClose, onSuccess }: RescheduleDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [newDate, setNewDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [reason, setReason] = useState('');

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!newDate) throw new Error('Selecciona una nueva fecha');

      // Get current reprogramado_count
      const { data: currentEnvio } = await supabase
        .from('envios')
        .select('reprogramado_count')
        .eq('id', shipment.id)
        .single();

      const currentCount = currentEnvio?.reprogramado_count || 0;

      // Update shipment with new delivery date, increment reprogramado_count, clear chofer_id
      const { error: updateError } = await supabase
        .from('envios')
        .update({ 
          fecha_entrega: newDate.toISOString(),
          estado: 'pendiente', // Reset to pending for re-delivery
          chofer_id: null, // Remove driver assignment so it can be reassigned
          reprogramado_count: currentCount + 1,
          ultima_reprogramacion: new Date().toISOString(),
        })
        .eq('id', shipment.id);

      if (updateError) throw updateError;

      // Add history entry
      const { error: historyError } = await supabase
        .from('envio_historial')
        .insert({
          envio_id: shipment.id,
          estado_anterior: shipment.estado as any,
          estado_nuevo: 'pendiente',
          notas: `Entrega reprogramada para ${format(newDate, 'dd/MM/yyyy', { locale: es })}. Motivo: ${reason || 'No especificado'}. Intento #${currentCount + 1}`,
          created_by: user?.id,
        });

      if (historyError) throw historyError;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['my-active-route-paradas'] });
      await queryClient.cancelQueries({ queryKey: ['my-active-route-envios-hoja'] });
      
      const previousParadas = queryClient.getQueryData(['my-active-route-paradas']);
      const previousEnviosHoja = queryClient.getQueryData(['my-active-route-envios-hoja']);
      
      queryClient.setQueryData(['my-active-route-paradas'], (old: any) => {
        if (!old) return old;
        return old.map((p: any) => 
          p.envio?.id === shipment.id 
            ? { ...p, envio: { ...p.envio, estado: 'pendiente' } }
            : p
        );
      });
      
      queryClient.setQueryData(['my-active-route-envios-hoja'], (old: any) => {
        if (!old) return old;
        return old.map((e: any) => 
          e.envio?.id === shipment.id 
            ? { ...e, envio: { ...e.envio, estado: 'pendiente' } }
            : e
        );
      });
      
      return { previousParadas, previousEnviosHoja };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-envios-hoja'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-hoja'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-planificada'] });
      toast.success('Entrega reprogramada correctamente');
      onSuccess();
      onClose();
    },
    onError: (error, _, context) => {
      if (context?.previousParadas) {
        queryClient.setQueryData(['my-active-route-paradas'], context.previousParadas);
      }
      if (context?.previousEnviosHoja) {
        queryClient.setQueryData(['my-active-route-envios-hoja'], context.previousEnviosHoja);
      }
      toast.error('Error al reprogramar: ' + error.message);
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Reprogramar Entrega
          </DialogTitle>
          <DialogDescription>
            Selecciona una nueva fecha para la entrega
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tracking */}
          <div className="text-center">
            <Badge variant="outline" className="font-mono text-lg px-4 py-2">
              {shipment.tracking_number}
            </Badge>
          </div>

          {/* Current date info */}
          {shipment.fecha_entrega && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <Clock className="h-4 w-4" />
              <span>
                Fecha actual: {format(new Date(shipment.fecha_entrega), 'dd/MM/yyyy', { locale: es })}
              </span>
            </div>
          )}

          {/* New Date Picker */}
          <div className="space-y-2">
            <Label>Nueva fecha de entrega *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !newDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newDate ? format(newDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDate}
                  onSelect={setNewDate}
                  disabled={(date) => date < new Date()}
                  locale={es}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo de reprogramación</Label>
            <Textarea
              id="reason"
              placeholder="Ej: Cliente solicita entrega en otro horario..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => rescheduleMutation.mutate()}
            disabled={rescheduleMutation.isPending || !newDate}
            className="gap-2"
          >
            {rescheduleMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarIcon className="h-4 w-4" />
            )}
            Reprogramar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
