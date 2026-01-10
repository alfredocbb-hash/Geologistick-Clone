import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Shield, Lock, CheckCircle2, XCircle, Info } from 'lucide-react';
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Permisos</h1>
          <p className="text-muted-foreground">
            Activa o desactiva funcionalidades para cada rol del sistema
          </p>
        </div>
        <Badge variant="outline" className="w-fit bg-amber-500/10 text-amber-500 border-amber-500/30">
          <Shield className="h-3 w-3 mr-1" />
          Super Admin
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Roles</p>
              <p className="text-2xl font-bold">{rolesWithPermissions.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Info className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Permisos {ROLE_LABELS[selectedRole]}</p>
              <p className="text-2xl font-bold">{rolePermissions.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Activos</p>
              <p className="text-2xl font-bold text-success">{enabledCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-muted">
              <XCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inactivos</p>
              <p className="text-2xl font-bold text-muted-foreground">{disabledCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for each role */}
      <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex h-auto gap-1 p-1 mb-4">
            {rolesWithPermissions.map((role) => {
              const rolePerms = getPermissionsByRole(role);
              const activeCount = rolePerms.filter(p => p.enabled).length;
              return (
                <TabsTrigger
                  key={role}
                  value={role}
                  className="text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {ROLE_LABELS[role]}
                  <Badge 
                    variant="secondary" 
                    className="ml-2 h-5 px-1.5 text-xs bg-background/50"
                  >
                    {activeCount}/{rolePerms.length}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </ScrollArea>

        {rolesWithPermissions.map((role) => (
          <TabsContent key={role} value={role} className="space-y-4">
            {Object.entries(groupPermissionsByCategory(getPermissionsByRole(role))).map(([category, perms]) => (
              <Card key={category} className="glass overflow-hidden">
                <CardHeader className="py-3 px-4 bg-muted/30">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {category}
                    <Badge variant="outline" className="text-xs">
                      {perms.filter(p => p.enabled).length}/{perms.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[200px]">Permiso</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="w-[150px]">Clave</TableHead>
                        <TableHead className="w-[100px] text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perms.map((permission) => (
                        <TableRow key={permission.id} className="group">
                          <TableCell className="font-medium">
                            {permission.permission_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {permission.description || '-'}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {permission.permission_key}
                            </code>
                          </TableCell>
                          <TableCell className="text-center">
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
                              <span className={cn(
                                "text-xs font-medium w-12",
                                permission.enabled ? "text-success" : "text-muted-foreground"
                              )}>
                                {permission.enabled ? 'Activo' : 'Inactivo'}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      {/* Info card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">¿Cómo funciona?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Cada rol tiene <strong>30 permisos</strong> que controlan qué puede ver y hacer en el sistema</li>
                <li>Activa o desactiva permisos usando el interruptor para personalizar cada rol</li>
                <li>Los cambios se aplican inmediatamente al menú lateral y páginas del sistema</li>
                <li>Los permisos del <strong>Super Admin</strong> no pueden ser modificados</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function for conditional classes
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
