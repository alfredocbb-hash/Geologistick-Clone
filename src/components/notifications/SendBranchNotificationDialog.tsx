import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/lib/auth';
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

type Audience = 'all_users' | 'admins_only' | 'specific_tenant';

export default function SendBranchNotificationDialog({ open, onOpenChange }: Props) {
  const { tenantId } = useTenant();
  const { isSuperAdmin } = useAuth();
  const superAdmin = isSuperAdmin();

  const [audience, setAudience] = useState<Audience>(superAdmin ? 'all_users' : 'specific_tenant');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [sucursalId, setSucursalId] = useState('all');
  const [type, setType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const effectiveTenantId = superAdmin && audience === 'specific_tenant' ? selectedTenantId : tenantId;

  const { data: tenants } = useQuery({
    queryKey: ['tenants-for-notif'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenants')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      return data || [];
    },
    enabled: superAdmin && open,
  });

  const { data: branches } = useQuery({
    queryKey: ['branches-for-notif', effectiveTenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('tenant_id', effectiveTenantId!)
        .eq('activa', true)
        .order('nombre');
      return data || [];
    },
    enabled: !!effectiveTenantId && open && (audience === 'specific_tenant' || !superAdmin),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      let userIds: string[] = [];

      if (superAdmin && audience === 'all_users') {
        const { data, error } = await supabase.from('profiles').select('user_id');
        if (error) throw error;
        userIds = (data || []).map(u => u.user_id);
      } else if (superAdmin && audience === 'admins_only') {
        const { data, error } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'super_admin']);
        if (error) throw error;
        userIds = [...new Set((data || []).map(u => u.user_id))];
      } else {
        // specific tenant (admin or super admin with tenant selected)
        const tid = effectiveTenantId;
        if (!tid) throw new Error('Selecciona una empresa');

        let query = supabase.from('profiles').select('user_id').eq('tenant_id', tid);
        if (sucursalId !== 'all') {
          query = query.eq('sucursal_id', sucursalId);
        }
        const { data, error } = await query;
        if (error) throw error;
        userIds = (data || []).map(u => u.user_id);
      }

      if (userIds.length === 0) throw new Error('No se encontraron usuarios para notificar');

      const notifications = userIds.map(uid => ({
        user_id: uid,
        tenant_id: effectiveTenantId || null,
        title,
        message,
        type,
        read: false,
      }));

      // Insert in batches of 500
      for (let i = 0; i < notifications.length; i += 500) {
        const batch = notifications.slice(i, i + 500);
        const { error } = await supabase.from('notifications').insert(batch);
        if (error) throw error;
      }

      return userIds.length;
    },
    onSuccess: (count) => {
      toast.success(`Notificación enviada a ${count} usuario(s)`);
      resetAndClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetAndClose = () => {
    setAudience(superAdmin ? 'all_users' : 'specific_tenant');
    setSelectedTenantId('');
    setSucursalId('all');
    setType('info');
    setTitle('');
    setMessage('');
    onOpenChange(false);
  };

  const showBranchSelector = !superAdmin || audience === 'specific_tenant';
  const showTenantSelector = superAdmin && audience === 'specific_tenant';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Notificación</DialogTitle>
          <DialogDescription>
            {superAdmin
              ? 'Envía un mensaje a usuarios del sistema'
              : 'Envía un mensaje a los usuarios de tus sucursales'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {superAdmin && (
            <div className="space-y-2">
              <Label>Destinatarios</Label>
              <Select value={audience} onValueChange={(v) => { setAudience(v as Audience); setSucursalId('all'); setSelectedTenantId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_users">Todos los usuarios del sistema</SelectItem>
                  <SelectItem value="admins_only">Solo administradores</SelectItem>
                  <SelectItem value="specific_tenant">Empresa específica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showTenantSelector && (
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={selectedTenantId} onValueChange={(v) => { setSelectedTenantId(v); setSucursalId('all'); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                <SelectContent>
                  {tenants?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showBranchSelector && (
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select value={sucursalId} onValueChange={setSucursalId} disabled={showTenantSelector && !selectedTenantId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sucursales</SelectItem>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            disabled={!title.trim() || !message.trim() || sendMutation.isPending || (showTenantSelector && !selectedTenantId)}
          >
            {sendMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
