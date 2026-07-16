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
import { Undo2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReturnToSenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envioId: string | null;
  currentStatus: string;
  tracking: string;
  destinatario?: string | null;
}

export default function ReturnToSenderDialog({
  open,
  onOpenChange,
  envioId,
  currentStatus,
  tracking,
  destinatario,
}: ReturnToSenderDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!envioId) throw new Error('Envío no válido');
      if (motivo.trim().length < 5) throw new Error('El motivo debe tener al menos 5 caracteres');

      const { data: updated, error: updateError } = await supabase
        .from('envios')
        .update({ estado: 'devuelto' as any })
        .eq('id', envioId)
        .select('id');

      if (updateError) throw updateError;
      if (!updated || updated.length === 0) {
        throw new Error('Sin permisos para modificar este envío');
      }

      const { error: histError } = await supabase.from('envio_historial').insert({
        envio_id: envioId,
        estado_anterior: currentStatus as any,
        estado_nuevo: 'devuelto' as any,
        notas: `Devolución al remitente. Motivo: ${motivo.trim()}`,
        created_by: user?.id,
      });
      if (histError) throw histError;
    },
    onSuccess: () => {
      toast.success('Envío marcado como devuelto al remitente');
      queryClient.invalidateQueries({ queryKey: ['canceladas-devoluciones'] });
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      queryClient.invalidateQueries({ queryKey: ['envio-historial', envioId] });
      setMotivo('');
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al registrar devolución');
    },
  });

  const handleClose = () => {
    if (mutation.isPending) return;
    setMotivo('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-destructive" />
            Devolver al remitente
          </DialogTitle>
          <DialogDescription>
            Tracking <strong className="font-mono">{tracking}</strong>
            {destinatario ? ` — ${destinatario}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo-devolucion">Motivo de devolución *</Label>
          <Textarea
            id="motivo-devolucion"
            placeholder="Ej: Cliente rechazó el paquete, dirección inexistente, etc."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            El motivo se registra en el historial y aparece en el tracking público.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || motivo.trim().length < 5}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
