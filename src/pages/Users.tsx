import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Search,
  Users as UsersIcon,
  Shield,
  Building2,
  Edit,
  UserPlus,
  Truck,
  Mail,
  Phone,
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
  avatar_url: string | null;
  sucursal_id: string | null;
  activo: boolean | null;
  created_at: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

interface Sucursal {
  id: string;
  nombre: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
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

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-red-500/10 text-red-500',
  supervisor: 'bg-orange-500/10 text-orange-500',
  operador: 'bg-blue-500/10 text-blue-500',
  chofer: 'bg-chofer/10 text-chofer',
  bodega: 'bg-purple-500/10 text-purple-500',
  despachador: 'bg-cyan-500/10 text-cyan-500',
  atencion_cliente: 'bg-pink-500/10 text-pink-500',
  sucursal: 'bg-sucursales/10 text-sucursales',
  cliente: 'bg-clientes/10 text-clientes',
};

export default function Users() {
  const { isAdmin, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editingRoles, setEditingRoles] = useState<AppRole[]>([]);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    sucursal_id: '',
    activo: true,
    newRole: '' as AppRole | '',
  });

  // Fetch sucursales
  const { data: sucursales = [] } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data as Sucursal[];
    },
  });

  // Fetch profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(
          `nombre.ilike.%${searchTerm}%,apellido.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch all roles
  const { data: allRoles = [] } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('*');
      if (error) throw error;
      return data as UserRole[];
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: {
      profileId: string;
      updates: Partial<Profile>;
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update(data.updates)
        .eq('id', data.profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Perfil actualizado');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      toast.success('Rol agregado');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      toast.success('Rol eliminado');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const getUserRoles = (userId: string): AppRole[] => {
    return allRoles.filter((r) => r.user_id === userId).map((r) => r.role);
  };

  const getSucursalName = (sucursalId: string | null) => {
    if (!sucursalId) return 'Sin asignar';
    return sucursales.find((s) => s.id === sucursalId)?.nombre || 'Desconocida';
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setEditingRoles(getUserRoles(profile.user_id));
    setFormData({
      nombre: profile.nombre,
      apellido: profile.apellido || '',
      telefono: profile.telefono || '',
      sucursal_id: profile.sucursal_id || '',
      activo: profile.activo ?? true,
      newRole: '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingProfile) return;

    updateProfileMutation.mutate({
      profileId: editingProfile.id,
      updates: {
        nombre: formData.nombre,
        apellido: formData.apellido || null,
        telefono: formData.telefono || null,
        sucursal_id: formData.sucursal_id || null,
        activo: formData.activo,
      },
    });
    setIsDialogOpen(false);
  };

  const handleAddRole = () => {
    if (!editingProfile || !formData.newRole) return;
    addRoleMutation.mutate({
      userId: editingProfile.user_id,
      role: formData.newRole,
    });
    setEditingRoles([...editingRoles, formData.newRole]);
    setFormData({ ...formData, newRole: '' });
  };

  const handleRemoveRole = (role: AppRole) => {
    if (!editingProfile) return;
    // Prevent removing admin role from self
    if (
      role === 'admin' &&
      editingProfile.user_id === currentUser?.id
    ) {
      toast.error('No puedes quitarte el rol de admin a ti mismo');
      return;
    }
    removeRoleMutation.mutate({ userId: editingProfile.user_id, role });
    setEditingRoles(editingRoles.filter((r) => r !== role));
  };

  const getInitials = (nombre: string, apellido: string | null) => {
    return `${nombre[0]}${apellido?.[0] || ''}`.toUpperCase();
  };

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">
          No tienes permisos para ver esta página
        </p>
      </div>
    );
  }

  const availableRoles = Object.keys(ROLE_LABELS) as AppRole[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuarios</h1>
          <p className="text-muted-foreground">
            Administra usuarios y roles del sistema
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <UsersIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Usuarios</p>
              <p className="text-2xl font-bold">{profiles.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/10">
              <Shield className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Admins</p>
              <p className="text-2xl font-bold">
                {allRoles.filter((r) => r.role === 'admin').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-chofer/10">
              <Truck className="h-6 w-6 text-chofer" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Choferes</p>
              <p className="text-2xl font-bold">
                {allRoles.filter((r) => r.role === 'chofer').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <UsersIcon className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Activos</p>
              <p className="text-2xl font-bold">
                {profiles.filter((p) => p.activo).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Cargando usuarios...
            </div>
          ) : profiles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No se encontraron usuarios
            </div>
          ) : (
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
                {profiles.map((profile) => {
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
                                className={ROLE_COLORS[role]}
                              >
                                {ROLE_LABELS[role]}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(profile)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          {editingProfile && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apellido</Label>
                  <Input
                    value={formData.apellido}
                    onChange={(e) =>
                      setFormData({ ...formData, apellido: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={formData.telefono}
                  onChange={(e) =>
                    setFormData({ ...formData, telefono: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Sucursal</Label>
                <Select
                  value={formData.sucursal_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, sucursal_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asignar</SelectItem>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editingRoles.map((role) => (
                    <Badge
                      key={role}
                      className={`${ROLE_COLORS[role]} cursor-pointer`}
                      onClick={() => handleRemoveRole(role)}
                    >
                      {ROLE_LABELS[role]} ×
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select
                    value={formData.newRole}
                    onValueChange={(value) =>
                      setFormData({ ...formData, newRole: value as AppRole })
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Agregar rol..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles
                        .filter((r) => !editingRoles.includes(r))
                        .map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddRole}
                    disabled={!formData.newRole}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Usuario Activo</Label>
                <Switch
                  checked={formData.activo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, activo: checked })
                  }
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>Guardar Cambios</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
