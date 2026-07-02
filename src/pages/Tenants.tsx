import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Search, Users, Package, Calendar, MoreHorizontal, CheckCircle, XCircle, Eye, Pencil, Trash2, Palette, AlertTriangle, ToggleLeft } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CreateTenantDialog } from '@/components/tenants/CreateTenantDialog';
import { EditTenantDialog } from '@/components/tenants/EditTenantDialog';
import { TenantDetailsDialog } from '@/components/tenants/TenantDetailsDialog';
import { DeleteTenantDialog } from '@/components/tenants/DeleteTenantDialog';
import { TenantBrandingDialog } from '@/components/tenants/TenantBrandingDialog';
import { TenantFeaturesDialog } from '@/components/tenants/TenantFeaturesDialog';
import { toast } from 'sonner';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface TenantWithStats {
  id: string;
  nombre: string;
  slug: string;
  plan: string;
  activo: boolean;
  trial_ends_at: string | null;
  max_usuarios: number;
  max_sucursales: number;
  max_envios_mes: number;
  created_at: string;
  usuarios_count: number;
  sucursales_count: number;
  envios_mes_count: number;
}

export default function Tenants() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [brandingDialogOpen, setBrandingDialogOpen] = useState(false);
  const [featuresDialogOpen, setFeaturesDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStats | null>(null);

  const { data: tenants, isLoading, refetch } = useQuery({
    queryKey: ['tenants-admin'],
    queryFn: async () => {
      // First get all tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;

      // Then get counts for each tenant
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const tenantsWithStats: TenantWithStats[] = await Promise.all(
        (tenantsData || []).map(async (tenant) => {
          const [usersResult, branchesResult, shipmentsResult] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
            supabase.from('sucursales').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('activa', true),
            supabase.from('envios').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).gte('created_at', monthStart)
          ]);

          return {
            ...tenant,
            usuarios_count: usersResult.count || 0,
            sucursales_count: branchesResult.count || 0,
            envios_mes_count: shipmentsResult.count || 0
          };
        })
      );

      return tenantsWithStats;
    },
    enabled: !authLoading && isSuperAdmin()
  });

  if (authLoading) {
    return <div className="flex items-center justify-center h-96">Cargando...</div>;
  }

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredTenants = tenants?.filter(tenant => {
    const matchesSearch = tenant.nombre.toLowerCase().includes(search.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === 'all' || tenant.plan === planFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && tenant.activo) ||
      (statusFilter === 'inactive' && !tenant.activo);
    return matchesSearch && matchesPlan && matchesStatus;
  }) || [];

  const getUsageColor = (current: number, max: number) => {
    const pct = max > 0 ? (current / max) * 100 : 0;
    if (pct >= 100) return 'text-destructive font-semibold';
    if (pct >= 80) return 'text-yellow-600 dark:text-yellow-500 font-medium';
    return '';
  };

  const isExceeded = (current: number, max: number) => current > max;

  const stats = {
    total: tenants?.length || 0,
    active: tenants?.filter(t => t.activo).length || 0,
    trial: tenants?.filter(t => t.plan === 'trial').length || 0,
    expired: tenants?.filter(t => t.trial_ends_at && isPast(new Date(t.trial_ends_at)) && t.plan === 'trial').length || 0,
    exceeded: tenants?.filter(t => 
      t.usuarios_count > t.max_usuarios || 
      t.sucursales_count > t.max_sucursales || 
      t.envios_mes_count > t.max_envios_mes
    ).length || 0
  };

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      trial: 'outline',
      starter: 'secondary',
      professional: 'default',
      enterprise: 'default'
    };
    return <Badge variant={variants[plan] || 'outline'}>{plan}</Badge>;
  };

  const getTrialStatus = (tenant: TenantWithStats) => {
    if (tenant.plan !== 'trial' || !tenant.trial_ends_at) return null;
    const trialEnd = new Date(tenant.trial_ends_at);
    const daysLeft = differenceInDays(trialEnd, new Date());
    
    if (isPast(trialEnd)) {
      return <Badge variant="destructive">Expirado</Badge>;
    }
    if (daysLeft <= 3) {
      return <Badge variant="destructive">{daysLeft} días</Badge>;
    }
    return <Badge variant="outline">{daysLeft} días</Badge>;
  };

  const handleToggleActive = async (tenant: TenantWithStats) => {
    const { error } = await supabase
      .from('tenants')
      .update({ activo: !tenant.activo })
      .eq('id', tenant.id);

    if (error) {
      toast.error('Error al actualizar el estado');
    } else {
      toast.success(tenant.activo ? 'Empresa desactivada' : 'Empresa activada');
      refetch();
    }
  };

  const handleEdit = (tenant: TenantWithStats) => {
    setSelectedTenant(tenant);
    setEditDialogOpen(true);
  };

  const handleViewDetails = (tenant: TenantWithStats) => {
    setSelectedTenant(tenant);
    setDetailsDialogOpen(true);
  };

  const handleDelete = (tenant: TenantWithStats) => {
    setSelectedTenant(tenant);
    setDeleteDialogOpen(true);
  };

  const handleBranding = (tenant: TenantWithStats) => {
    setSelectedTenant(tenant);
    setBrandingDialogOpen(true);
  };

  const [seedingDemo, setSeedingDemo] = useState(false);
  const handleSeedDemo = async () => {
    const ok = window.confirm(
      "Esto creará (o RESETEARÁ) la empresa 'Empresa Demo' con usuarios, clientes y ~100 envíos de prueba.\n\nSi ya existe, se eliminarán todos sus datos y usuarios.\n\n¿Continuar?"
    );
    if (!ok) return;
    setSeedingDemo(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-tenant');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        `Empresa Demo lista — ${data?.stats?.envios || 0} envíos, ${data?.stats?.clientes || 0} clientes. Password: ${data?.credenciales?.password}`,
        { duration: 15000 }
      );
      refetch();
    } catch (e: any) {
      toast.error('Error: ' + (e?.message || 'desconocido'));
    } finally {
      setSeedingDemo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground">Gestión de todas las empresas del sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeedDemo} disabled={seedingDemo}>
            {seedingDemo ? 'Creando...' : 'Crear/Resetear Empresa Demo'}
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Empresa
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">En Trial</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trial}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expirados</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.expired}</div>
          </CardContent>
        </Card>
        <Card className={stats.exceeded > 0 ? 'border-destructive' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Excedidas</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.exceeded > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.exceeded > 0 ? 'text-destructive' : ''}`}>{stats.exceeded}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los planes</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="inactive">Inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Trial</TableHead>
                <TableHead>Usuarios</TableHead>
                <TableHead>Sucursales</TableHead>
                <TableHead>Envíos/Mes</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                    Cargando empresas...
                  </TableCell>
                </TableRow>
              ) : filteredTenants.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No se encontraron empresas
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{tenant.nombre}</div>
                        <div className="text-sm text-muted-foreground">{tenant.slug}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(tenant.plan)}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.activo ? 'default' : 'secondary'}>
                        {tenant.activo ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getTrialStatus(tenant)}</TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${getUsageColor(tenant.usuarios_count, tenant.max_usuarios)}`}>
                        <Users className="h-4 w-4" />
                        <span>{tenant.usuarios_count}/{tenant.max_usuarios}</span>
                        {isExceeded(tenant.usuarios_count, tenant.max_usuarios) && <AlertTriangle className="h-3.5 w-3.5" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${getUsageColor(tenant.sucursales_count, tenant.max_sucursales)}`}>
                        <Building2 className="h-4 w-4" />
                        <span>{tenant.sucursales_count}/{tenant.max_sucursales}</span>
                        {isExceeded(tenant.sucursales_count, tenant.max_sucursales) && <AlertTriangle className="h-3.5 w-3.5" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${getUsageColor(tenant.envios_mes_count, tenant.max_envios_mes)}`}>
                        <Package className="h-4 w-4" />
                        <span>{tenant.envios_mes_count}/{tenant.max_envios_mes.toLocaleString()}</span>
                        {isExceeded(tenant.envios_mes_count, tenant.max_envios_mes) && <AlertTriangle className="h-3.5 w-3.5" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(tenant.created_at), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(tenant)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(tenant)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBranding(tenant)}>
                            <Palette className="h-4 w-4 mr-2" />
                            Personalizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedTenant(tenant); setFeaturesDialogOpen(true); }}>
                            <ToggleLeft className="h-4 w-4 mr-2" />
                            Módulos opcionales
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(tenant)}>
                            {tenant.activo ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Desactivar
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Activar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(tenant)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateTenantDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          refetch();
          setCreateDialogOpen(false);
        }}
      />

      {selectedTenant && (
        <>
          <EditTenantDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            tenant={selectedTenant}
            onSuccess={() => {
              refetch();
              setEditDialogOpen(false);
            }}
          />
          <TenantDetailsDialog
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
            tenant={selectedTenant}
          />
          <DeleteTenantDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            tenant={selectedTenant}
            onSuccess={() => {
              refetch();
              setDeleteDialogOpen(false);
            }}
          />
          <TenantBrandingDialog
            open={brandingDialogOpen}
            onOpenChange={setBrandingDialogOpen}
            tenant={selectedTenant}
            onSuccess={() => {
              refetch();
              setBrandingDialogOpen(false);
            }}
          />
          <TenantFeaturesDialog
            open={featuresDialogOpen}
            onOpenChange={setFeaturesDialogOpen}
            tenant={selectedTenant}
          />
        </>
      )}
    </div>
  );
}
