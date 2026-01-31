import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Key,
  Trash2,
  Mail,
  Phone,
  Building2,
  Users as UsersIcon,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Profile {
  id: string;
  user_id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  avatar_url?: string | null;
  sucursal_id: string | null;
  tenant_id: string | null;
  activo: boolean | null;
  created_at?: string | null;
  tenant?: { id: string; nombre: string } | null;
  comision_tipo?: string | null;
  comision_porcentaje?: number | null;
  comision_fija?: number | null;
  comision_notas?: string | null;
  comision_retiro_tipo?: string | null;
  comision_retiro_porcentaje?: number | null;
  comision_retiro_fija?: number | null;
}

interface Sucursal {
  id: string;
  nombre: string;
}

interface UserGroupedViewProps {
  profiles: Profile[];
  getUserRoles: (userId: string) => AppRole[];
  getSucursalName: (sucursalId: string | null) => string;
  onEdit: (profile: any) => void;
  onResetPassword: (profile: any) => void;
  onDelete: (profile: any) => void;
  canDelete: boolean;
  currentUserId: string | undefined;
  roleLabels: Record<AppRole, string>;
  roleColors: Record<AppRole, string>;
}

interface GroupedUsers {
  tenantId: string | null;
  tenantName: string;
  users: Profile[];
}

export function UserGroupedView({
  profiles,
  getUserRoles,
  getSucursalName,
  onEdit,
  onResetPassword,
  onDelete,
  canDelete,
  currentUserId,
  roleLabels,
  roleColors,
}: UserGroupedViewProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['all']));

  const groupedUsers = useMemo(() => {
    const groups: Map<string, GroupedUsers> = new Map();

    profiles.forEach((profile) => {
      const tenantId = profile.tenant_id || 'sin-empresa';
      const tenantName = profile.tenant?.nombre || 'Sin Empresa Asignada';

      if (!groups.has(tenantId)) {
        groups.set(tenantId, {
          tenantId: profile.tenant_id,
          tenantName,
          users: [],
        });
      }
      groups.get(tenantId)!.users.push(profile);
    });

    // Sort by tenant name, putting "Sin Empresa Asignada" at the end
    return Array.from(groups.values()).sort((a, b) => {
      if (a.tenantId === null) return 1;
      if (b.tenantId === null) return -1;
      return a.tenantName.localeCompare(b.tenantName);
    });
  }, [profiles]);

  const toggleGroup = (tenantId: string) => {
    const newOpenGroups = new Set(openGroups);
    if (newOpenGroups.has(tenantId)) {
      newOpenGroups.delete(tenantId);
    } else {
      newOpenGroups.add(tenantId);
    }
    setOpenGroups(newOpenGroups);
  };

  const getInitials = (nombre: string, apellido: string | null) => {
    return `${nombre[0]}${apellido?.[0] || ''}`.toUpperCase();
  };

  const canDeleteUser = (profile: Profile) => {
    if (!canDelete) return false;
    // Cannot delete yourself
    if (profile.user_id === currentUserId) return false;
    return true;
  };

  if (groupedUsers.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No se encontraron usuarios
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groupedUsers.map((group) => {
        const groupKey = group.tenantId || 'sin-empresa';
        const isOpen = openGroups.has(groupKey) || openGroups.has('all');

        return (
          <Collapsible
            key={groupKey}
            open={isOpen}
            onOpenChange={() => toggleGroup(groupKey)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 p-4 h-auto hover:bg-muted/50"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold">{group.tenantName}</span>
                <Badge variant="secondary" className="ml-2">
                  <UsersIcon className="h-3 w-3 mr-1" />
                  {group.users.length} usuario{group.users.length !== 1 ? 's' : ''}
                </Badge>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border rounded-lg ml-6 mb-4 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Sucursal</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.users.map((profile) => {
                      const roles = getUserRoles(profile.user_id);
                      return (
                        <TableRow key={profile.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(profile.nombre, profile.apellido)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {profile.nombre} {profile.apellido}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {profile.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3" />
                                {profile.email}
                              </div>
                              {profile.telefono && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {profile.telefono}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {roles.length === 0 ? (
                                <Badge variant="outline">Sin roles</Badge>
                              ) : (
                                roles.map((role) => (
                                  <Badge
                                    key={role}
                                    className={roleColors[role]}
                                  >
                                    {roleLabels[role]}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              <span className="text-sm">
                                {getSucursalName(profile.sucursal_id)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={profile.activo ? 'default' : 'secondary'}
                              className={
                                profile.activo
                                  ? 'bg-success/10 text-success'
                                  : 'bg-muted'
                              }
                            >
                              {profile.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onResetPassword(profile)}
                                title="Reiniciar contraseña"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEdit(profile)}
                                title="Editar usuario"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {canDeleteUser(profile) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onDelete(profile)}
                                  title="Eliminar usuario"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
