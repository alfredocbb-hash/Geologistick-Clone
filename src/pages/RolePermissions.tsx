import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Shield, Lock, CheckCircle2, XCircle } from 'lucide-react';
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

export default function RolePermissions() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<AppRole>('admin');

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
      toast.success('Permiso actualizado');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const getPermissionsByRole = (role: AppRole) => {
    return permissions.filter((p) => p.role === role);
  };

  const getRolesWithPermissions = () => {
    const rolesSet = new Set(permissions.map((p) => p.role));
    return ROLE_ORDER.filter((role) => rolesSet.has(role));
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Roles</h1>
          <p className="text-muted-foreground">
            Visualiza y administra los permisos de cada rol
          </p>
        </div>
        <Badge variant="outline" className="w-fit bg-amber-500/10 text-amber-500 border-amber-500/30">
          <Shield className="h-3 w-3 mr-1" />
          Super Admin
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="p-3 rounded-xl bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Permisos Activos</p>
              <p className="text-2xl font-bold">
                {permissions.filter((p) => p.enabled).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Permisos Inactivos</p>
              <p className="text-2xl font-bold">
                {permissions.filter((p) => !p.enabled).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for each role */}
      <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          {rolesWithPermissions.map((role) => (
            <TabsTrigger
              key={role}
              value={role}
              className="text-xs sm:text-sm"
            >
              {ROLE_LABELS[role]}
            </TabsTrigger>
          ))}
        </TabsList>

        {rolesWithPermissions.map((role) => (
          <TabsContent key={role} value={role}>
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Permisos de {ROLE_LABELS[role]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Cargando permisos...
                  </div>
                ) : getPermissionsByRole(role).length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No hay permisos configurados para este rol
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Permiso</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Clave</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPermissionsByRole(role).map((permission) => (
                        <TableRow key={permission.id}>
                          <TableCell className="font-medium">
                            {permission.permission_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {permission.description || '-'}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {permission.permission_key}
                            </code>
                          </TableCell>
                          <TableCell className="text-center">
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
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Info card */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Información</p>
              <p>
                Los permisos del Super Admin no pueden ser modificados. Los cambios 
                en permisos afectan qué funciones puede ver y usar cada rol en el 
                menú lateral y en las diferentes páginas del sistema.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
