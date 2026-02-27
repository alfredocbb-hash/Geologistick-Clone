import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SendBranchNotificationDialog({ open, onOpenChange }: Props) {
  const { tenantId } = useTenant();
  const [sucursalId, setSucursalId] = useState('all');
  const [type, setType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const { data: branches } = useQuery({
    queryKey: ['branches-for-notif', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('tenant_id', tenantId!)
        .eq('activa', true)
        .order('nombre');
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Sin tenant');

      // Fetch target users
      let query = supabase
        .from('profiles')
        .select('user_id')
        .eq('tenant_id', tenantId);

      if (sucursalId !== 'all') {
        query = query.eq('sucursal_id', sucursalId);
      }

      const { data: users, error: usersError } = await query;
      if (usersError) throw usersError;
      if (!users || users.length === 0) throw new Error('No se encontraron usuarios en la sucursal seleccionada');

      // Insert one notification per user
      const notifications = users.map((u) => ({
        user_id: u.user_id,
        tenant_id: tenantId,
        title,
        message,
        type,
        read: false,
      }));

      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) throw error;

      return users.length;
    },
    onSuccess: (count) => {
      toast.success(`Notificación enviada a ${count} usuario(s)`);
      resetAndClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetAndClose = () => {
    setSucursalId('all');
    setType('info');
    setTitle('');
    setMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Notificación</DialogTitle>
          <DialogDescription>Envía un mensaje a los usuarios de tus sucursales</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Sucursal</Label>
            <Select value={sucursalId} onValueChange={setSucursalId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {branches?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Información</SelectItem>
                <SelectItem value="warning">Advertencia</SelectItem>
                <SelectItem value="success">Éxito</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la notificación" />
          </div>

          <div className="space-y-2">
            <Label>Mensaje</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escribe el mensaje..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!title.trim() || !message.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
