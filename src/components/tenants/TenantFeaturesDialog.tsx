import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: { id: string; nombre: string } | null;
}

const OPTIONAL_FEATURES: Array<{ key: string; label: string; description: string; icon: any }> = [
  {
    key: 'finanzas',
    label: 'Módulo Finanzas',
    description: 'Carga manual de liquidaciones a terciarizados/proveedores, con vinculación a factura emitida e impacto en caja.',
    icon: Wallet,
  },
];

export function TenantFeaturesDialog({ open, onOpenChange, tenant }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !tenant) return;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from('tenant_features')
        .select('feature_key, enabled')
        .eq('tenant_id', tenant.id);
      const map: Record<string, boolean> = {};
      (data || []).forEach((r: any) => { map[r.feature_key] = r.enabled; });
      setFlags(map);
      setLoading(false);
    })();
  }, [open, tenant]);

  const toggle = async (key: string, next: boolean) => {
    if (!tenant) return;
    setFlags(prev => ({ ...prev, [key]: next }));
    const { error } = await (supabase as any)
      .from('tenant_features')
      .upsert(
        { tenant_id: tenant.id, feature_key: key, enabled: next, enabled_by: user?.id, enabled_at: new Date().toISOString() },
        { onConflict: 'tenant_id,feature_key' }
      );
    if (error) {
      toast.error('No se pudo actualizar: ' + error.message);
      setFlags(prev => ({ ...prev, [key]: !next }));
    } else {
      toast.success(next ? 'Módulo habilitado' : 'Módulo deshabilitado');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Módulos opcionales</DialogTitle>
          <DialogDescription>
            Habilitá módulos opcionales para <span className="font-semibold">{tenant?.nombre}</span>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {OPTIONAL_FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.key} className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                  <div className="flex gap-3">
                    <div className="mt-0.5"><Icon className="h-5 w-5 text-primary" /></div>
                    <div>
                      <Label className="text-sm font-medium">{f.label}</Label>
                      <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
                    </div>
                  </div>
                  <Switch checked={!!flags[f.key]} onCheckedChange={(v) => toggle(f.key, v)} />
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
