import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Lock, CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface RolePermission {
  id: string;
  role: AppRole;
  permission_key: string;
  permission_name: string;
  description: string | null;
  enabled: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  chofer: 'Chofer',
  bodega: 'Bodega',
  despachador: 'Despachador',
  atencion_cliente: 'Atención Cliente',
  sucursal: 'Sucursal',
  cliente: 'Cliente',
  seller: 'Seller e-Commerce',
};

const ROLE_ORDER: AppRole[] = [
  'super_admin',
  'admin',
  'supervisor',
  'operador',
  'despachador',
  'chofer',
  'bodega',
  'sucursal',
  'atencion_cliente',
  'cliente',
];

// Group permissions by category for better organization
const PERMISSION_CATEGORIES: Record<string, string> = {
  'dashboard': 'Panel Principal',
  'shipments': 'Envíos',
  'tracking': 'Seguimiento',
  'routes': 'Rutas',
  'route_sheets': 'Hojas de Ruta',
  'live_map': 'Mapa en Vivo',
  'drivers': 'Choferes',
  'vehicles': 'Vehículos',
  'my_routes': 'Mis Rutas',
  'route': 'Operación de Ruta',
  'navigation': 'Navegación',
  'delivery': 'Entregas',
  'incidents': 'Incidentes',
  'cash': 'Caja',
  'settlements': 'Liquidaciones',
  'commissions': 'Comisiones',
  'clients': 'Clientes',
  'branches': 'Sucursales',
  'rates': 'Tarifas',
  'users': 'Usuarios',
  'roles': 'Roles',
  'invoicing': 'Facturación',
};

const getPermissionCategory = (key: string): string => {
  const prefix = key.split('.')[0];
  return PERMISSION_CATEGORIES[prefix] || 'Otros';
};

export default function RolePermissions() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<AppRole>('chofer');

  // Fetch all permissions
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role')
        .order('permission_key');
      if (error) throw error;
      return data as RolePermission[];
    },
  });

  // Toggle permission mutation
  const togglePermissionMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('role_permissions')
        .update({ enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      toast.success('Permiso actualizado correctamente');
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar: ' + error.message);
    },
  });

  const getPermissionsByRole = (role: AppRole) => {
    return permissions.filter((p) => p.role === role);
  };

  const getRolesWithPermissions = () => {
    const rolesSet = new Set(permissions.map((p) => p.role));
    return ROLE_ORDER.filter((role) => rolesSet.has(role));
  };

  // Group permissions by category
  const groupPermissionsByCategory = (perms: RolePermission[]) => {
    const groups: Record<string, RolePermission[]> = {};
    perms.forEach(p => {
      const category = getPermissionCategory(p.permission_key);
      if (!groups[category]) groups[category] = [];
      groups[category].push(p);
    });
    return groups;
  };

  if (!isSuperAdmin()) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Solo los Super Admins pueden acceder a esta página
          </p>
        </div>
      </div>
    );
  }

  const rolesWithPermissions = getRolesWithPermissions();
  const rolePermissions = getPermissionsByRole(selectedRole);
  const groupedPermissions = groupPermissionsByCategory(rolePermissions);
  const enabledCount = rolePermissions.filter(p => p.enabled).length;
  const disabledCount = rolePermissions.filter(p => !p.enabled).length;

  return (
    <div className="space-y-4 md:space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Gestión de Permisos</h1>
            <p className="text-sm text-muted-foreground">
              Activa o desactiva funcionalidades para cada rol
            </p>
          </div>
          <Badge variant="outline" className="w-fit bg-amber-500/10 text-amber-500 border-amber-500/30">
            <Shield className="h-3 w-3 mr-1" />
            Super Admin
          </Badge>
        </div>
      </div>

      {/* Stats - Responsive grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card className="glass">
          <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-primary/10">
              <Shield className="h-4 w-4 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Roles</p>
              <p className="text-lg md:text-2xl font-bold">{rolesWithPermissions.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-blue-500/10">
              <Info className="h-4 w-4 md:h-6 md:w-6 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Permisos</p>
              <p className="text-lg md:text-2xl font-bold">{rolePermissions.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-success/10">
              <CheckCircle2 className="h-4 w-4 md:h-6 md:w-6 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Activos</p>
              <p className="text-lg md:text-2xl font-bold text-success">{enabledCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl bg-muted">
              <XCircle className="h-4 w-4 md:h-6 md:w-6 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">Inactivos</p>
              <p className="text-lg md:text-2xl font-bold text-muted-foreground">{disabledCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for each role */}
      <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
        <ScrollArea className="w-full pb-2">
          <TabsList className="inline-flex h-auto gap-1 p-1 w-max">
            {rolesWithPermissions.map((role) => {
              const rolePerms = getPermissionsByRole(role);
              const activeCount = rolePerms.filter(p => p.enabled).length;
              return (
                <TabsTrigger
                  key={role}
                  value={role}
                  className="text-xs whitespace-nowrap px-2 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <span className="hidden sm:inline">{ROLE_LABELS[role]}</span>
                  <span className="sm:hidden">{ROLE_LABELS[role].split(' ')[0]}</span>
                  <Badge 
                    variant="secondary" 
                    className="ml-1.5 h-4 px-1 text-[10px] bg-background/50"
                  >
                    {activeCount}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {rolesWithPermissions.map((role) => (
          <TabsContent key={role} value={role} className="space-y-3 mt-3">
            {Object.entries(groupPermissionsByCategory(getPermissionsByRole(role))).map(([category, perms]) => (
              <Card key={category} className="glass overflow-hidden">
                <CardHeader className="py-2 px-3 md:py-3 md:px-4 bg-muted/30">
                  <CardTitle className="text-xs md:text-sm font-semibold flex items-center gap-2">
                    {category}
                    <Badge variant="outline" className="text-[10px] md:text-xs h-4 md:h-5">
                      {perms.filter(p => p.enabled).length}/{perms.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Mobile: Card layout */}
                  <div className="md:hidden divide-y divide-border">
                    {perms.map((permission) => (
                      <div key={permission.id} className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{permission.permission_name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {permission.description || '-'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Switch
                              checked={permission.enabled}
                              onCheckedChange={(enabled) =>
                                togglePermissionMutation.mutate({
                                  id: permission.id,
                                  enabled,
                                })
                              }
                              disabled={
                                role === 'super_admin' ||
                                togglePermissionMutation.isPending
                              }
                              className="data-[state=checked]:bg-success"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                            {permission.permission_key}
                          </code>
                          <span className={cn(
                            "text-[10px] font-medium",
                            permission.enabled ? "text-success" : "text-muted-foreground"
                          )}>
                            {permission.enabled ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: Table layout */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/20">
                          <th className="text-left text-xs font-medium text-muted-foreground p-3 w-[180px]">Permiso</th>
                          <th className="text-left text-xs font-medium text-muted-foreground p-3">Descripción</th>
                          <th className="text-left text-xs font-medium text-muted-foreground p-3 w-[140px]">Clave</th>
                          <th className="text-center text-xs font-medium text-muted-foreground p-3 w-[100px]">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perms.map((permission) => (
                          <tr key={permission.id} className="border-b last:border-0 hover:bg-muted/10">
                            <td className="p-3 font-medium text-sm">
                              {permission.permission_name}
                            </td>
                            <td className="p-3 text-muted-foreground text-sm">
                              {permission.description || '-'}
                            </td>
                            <td className="p-3">
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                {permission.permission_key}
                              </code>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-2">
                                <Switch
                                  checked={permission.enabled}
                                  onCheckedChange={(enabled) =>
                                    togglePermissionMutation.mutate({
                                      id: permission.id,
                                      enabled,
                                    })
                                  }
                                  disabled={
                                    role === 'super_admin' ||
                                    togglePermissionMutation.isPending
                                  }
                                  className="data-[state=checked]:bg-success"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      {/* Info card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 md:p-4">
          <div className="flex gap-2 md:gap-3">
            <Info className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs md:text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">¿Cómo funciona?</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Cada rol tiene <strong>30 permisos</strong> configurables</li>
                <li>Usa el interruptor para activar/desactivar</li>
                <li>Los cambios se aplican inmediatamente</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
