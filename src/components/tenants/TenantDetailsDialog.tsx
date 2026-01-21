import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Building2, Users, Package, Calendar, CheckCircle, XCircle, Loader2, Key } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { TenantApiKeysDialog } from './TenantApiKeysDialog';

interface TenantDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    id: string;
    nombre: string;
    slug: string;
    plan: string;
    activo: boolean;
    max_usuarios: number;
    max_sucursales: number;
    max_envios_mes: number;
    trial_ends_at: string | null;
    created_at: string;
  };
}

export function TenantDetailsDialog({ open, onOpenChange, tenant }: TenantDetailsDialogProps) {
  const [showApiKeysDialog, setShowApiKeysDialog] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['tenant-stats', tenant.id],
    queryFn: async () => {
      const [usersResult, branchesResult, shipmentsResult, adminsResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        supabase.from('sucursales').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('activa', true),
        supabase
          .from('envios')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase
          .from('profiles')
          .select('id, nombre, apellido, email')
          .eq('tenant_id', tenant.id)
          .limit(10)
      ]);

      return {
        usuarios: usersResult.count || 0,
        sucursales: branchesResult.count || 0,
        envios_mes: shipmentsResult.count || 0,
        admins: adminsResult.data || []
      };
    },
    enabled: open
  });

  const getTrialInfo = () => {
    if (tenant.plan !== 'trial' || !tenant.trial_ends_at) return null;
    const trialEnd = new Date(tenant.trial_ends_at);
    const daysLeft = differenceInDays(trialEnd, new Date());
    
    if (isPast(trialEnd)) {
      return { status: 'expired', label: 'Expirado', days: 0 };
    }
    return { status: daysLeft <= 3 ? 'warning' : 'active', label: `${daysLeft} días restantes`, days: daysLeft };
  };

  const trialInfo = getTrialInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Building2 className="h-6 w-6" />
            {tenant.nombre}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Row */}
            <div className="flex items-center gap-4">
              <Badge variant={tenant.activo ? 'default' : 'secondary'} className="text-sm">
                {tenant.activo ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Activa
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Inactiva
                  </>
                )}
              </Badge>
              <Badge variant="outline" className="text-sm capitalize">{tenant.plan}</Badge>
              {trialInfo && (
                <Badge 
                  variant={trialInfo.status === 'expired' ? 'destructive' : trialInfo.status === 'warning' ? 'destructive' : 'outline'}
                  className="text-sm"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  {trialInfo.label}
                </Badge>
              )}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Información General</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Slug:</span>
                    <span className="font-mono">{tenant.slug}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Creada:</span>
                    <span>{format(new Date(tenant.created_at), 'dd/MM/yyyy', { locale: es })}</span>
                  </div>
                  {tenant.trial_ends_at && tenant.plan === 'trial' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fin Trial:</span>
                      <span>{format(new Date(tenant.trial_ends_at), 'dd/MM/yyyy', { locale: es })}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Límites del Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Usuarios:</span>
                    <span>{tenant.max_usuarios}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sucursales:</span>
                    <span>{tenant.max_sucursales}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Envíos/Mes:</span>
                    <span>{tenant.max_envios_mes.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Usage Stats */}
            <div>
              <h3 className="font-semibold mb-4">Uso Actual</h3>
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats?.usuarios || 0}</p>
                        <p className="text-sm text-muted-foreground">de {tenant.max_usuarios} usuarios</p>
                      </div>
                    </div>
                    <div className="mt-2 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(((stats?.usuarios || 0) / tenant.max_usuarios) * 100, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats?.sucursales || 0}</p>
                        <p className="text-sm text-muted-foreground">de {tenant.max_sucursales} sucursales</p>
                      </div>
                    </div>
                    <div className="mt-2 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(((stats?.sucursales || 0) / tenant.max_sucursales) * 100, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats?.envios_mes || 0}</p>
                        <p className="text-sm text-muted-foreground">de {tenant.max_envios_mes.toLocaleString()} envíos/mes</p>
                      </div>
                    </div>
                    <div className="mt-2 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(((stats?.envios_mes || 0) / tenant.max_envios_mes) * 100, 100)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* API Keys Section */}
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Integraciones</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKeysDialog(true)}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Gestionar API Keys
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Configura API Keys para permitir que sistemas externos consulten el tracking de envíos.
              </p>
            </div>

            {/* Admin Users */}
            {stats?.admins && stats.admins.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-4">Usuarios de la Empresa</h3>
                  <div className="space-y-2">
                    {stats.admins.map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{admin.nombre} {admin.apellido}</p>
                          <p className="text-sm text-muted-foreground">{admin.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>

      {/* API Keys Dialog */}
      <TenantApiKeysDialog
        open={showApiKeysDialog}
        onOpenChange={setShowApiKeysDialog}
        tenant={{ id: tenant.id, nombre: tenant.nombre }}
      />
    </Dialog>
  );
}
