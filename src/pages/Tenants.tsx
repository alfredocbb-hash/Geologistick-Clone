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
import { Building2, Plus, Search, Users, Package, Calendar, MoreHorizontal, CheckCircle, XCircle, Eye, Pencil, Trash2, Palette } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CreateTenantDialog } from '@/components/tenants/CreateTenantDialog';
import { EditTenantDialog } from '@/components/tenants/EditTenantDialog';
import { TenantDetailsDialog } from '@/components/tenants/TenantDetailsDialog';
import { DeleteTenantDialog } from '@/components/tenants/DeleteTenantDialog';
import { TenantBrandingDialog } from '@/components/tenants/TenantBrandingDialog';
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
      const tenantsWithStats: TenantWithStats[] = await Promise.all(
        (tenantsData || []).map(async (tenant) => {
          const [usersResult, branchesResult] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
            supabase.from('sucursales').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('activa', true)
          ]);

          return {
            ...tenant,
            usuarios_count: usersResult.count || 0,
            sucursales_count: branchesResult.count || 0
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

  const stats = {
    total: tenants?.length || 0,
    active: tenants?.filter(t => t.activo).length || 0,
    trial: tenants?.filter(t => t.plan === 'trial').length || 0,
    expired: tenants?.filter(t => t.trial_ends_at && isPast(new Date(t.trial_ends_at)) && t.plan === 'trial').length || 0
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground">Gestión de todas las empresas del sistema</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Empresa
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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
                <TableHead>Creada</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Cargando empresas...
                  </TableCell>
                </TableRow>
              ) : filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{tenant.usuarios_count}/{tenant.max_usuarios}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{tenant.sucursales_count}/{tenant.max_sucursales}</span>
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
        </>
      )}
    </div>
  );
}
