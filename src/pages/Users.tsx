import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useFormDraft } from '@/hooks/useFormDraft';
import { DraftIndicator, DraftSavingIndicator } from '@/components/ui/draft-indicator';
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
  Key,
  Percent,
  DollarSign,
  Package,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ResetPasswordDialog } from '@/components/users/ResetPasswordDialog';
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
  tenant_id: string | null;
  activo: boolean | null;
  created_at: string | null;
  // Delivery commission fields
  comision_tipo: string | null;
  comision_porcentaje: number | null;
  comision_fija: number | null;
  comision_notas: string | null;
  // Pickup commission fields
  comision_retiro_tipo: string | null;
  comision_retiro_porcentaje: number | null;
  comision_retiro_fija: number | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

interface Sucursal {
  id: string;
  nombre: string;
  tenant_id: string | null;
}

interface Tenant {
  id: string;
  nombre: string;
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

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-amber-500/10 text-amber-500',
  admin: 'bg-red-500/10 text-red-500',
  supervisor: 'bg-orange-500/10 text-orange-500',
  operador: 'bg-blue-500/10 text-blue-500',
  seller: 'bg-purple-500/10 text-purple-500',
  chofer: 'bg-chofer/10 text-chofer',
  bodega: 'bg-purple-500/10 text-purple-500',
  despachador: 'bg-cyan-500/10 text-cyan-500',
  atencion_cliente: 'bg-pink-500/10 text-pink-500',
  sucursal: 'bg-sucursales/10 text-sucursales',
  cliente: 'bg-clientes/10 text-clientes',
};

export default function Users() {
  const { isAdmin, isSuperAdmin, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<Profile | null>(null);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editingRoles, setEditingRoles] = useState<AppRole[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    tenant_id: '',
    sucursal_id: '',
    activo: true,
    newRole: '' as AppRole | '',
    // Delivery commission fields
    comision_tipo: 'tarifa' as string,
    comision_porcentaje: 0,
    comision_fija: 0,
    comision_notas: '',
    // Pickup commission fields
    comision_retiro_tipo: 'ninguna' as string,
    comision_retiro_porcentaje: 0,
    comision_retiro_fija: 0,
  });
  const defaultCreateForm = {
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    telefono: '',
    sucursal_id: '',
    selectedRoles: [] as AppRole[],
  };

  // Form draft persistence for create user form
  const {
    formData: createFormData,
    setFormData: setCreateFormData,
    clearDraft: clearCreateDraft,
    discardDraft: discardCreateDraft,
    isDraftRecovered: isCreateDraftRecovered,
    setIsDraftRecovered: setIsCreateDraftRecovered,
    lastSaved: createLastSaved,
    hasDraft: hasCreateDraft,
  } = useFormDraft('new-user', defaultCreateForm);

  // Fetch all tenants (only for super_admin)
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data as Tenant[];
    },
    enabled: isSuperAdmin(),
  });

  // Fetch sucursales
  const { data: sucursales = [] } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre, tenant_id')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data as Sucursal[];
    },
  });

  // Filter sucursales based on selected tenant (for super admin editing)
  const filteredSucursales = formData.tenant_id
    ? sucursales.filter(s => s.tenant_id === formData.tenant_id)
    : sucursales;

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

  // Update profile mutation with optimistic updates
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
    onMutate: async (newData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['profiles'] });
      
      // Snapshot the previous value
      const previousProfiles = queryClient.getQueryData(['profiles', searchTerm]);
      
      // Optimistically update the cache
      queryClient.setQueryData(['profiles', searchTerm], (old: Profile[] | undefined) =>
        old?.map(p =>
          p.id === newData.profileId
            ? { ...p, ...newData.updates }
            : p
        )
      );
      
      return { previousProfiles };
    },
    onError: (error: Error, _newData, context) => {
      // Rollback on error
      if (context?.previousProfiles) {
        queryClient.setQueryData(['profiles', searchTerm], context.previousProfiles);
      }
      toast.error('Error: ' + error.message);
    },
    onSuccess: () => {
      toast.success('Perfil actualizado');
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });

  // Add role mutation (idempotent - ignores if already exists)
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .upsert(
          { user_id: userId, role },
          { onConflict: 'user_id,role', ignoreDuplicates: true }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      toast.success('Rol agregado');
    },
    onError: (error: any) => {
      // Handle unique constraint violation gracefully
      if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
        toast.info('El usuario ya tiene este rol asignado');
        return;
      }
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
      tenant_id: profile.tenant_id || '',
      sucursal_id: profile.sucursal_id || '',
      activo: profile.activo ?? true,
      newRole: '',
      comision_tipo: profile.comision_tipo || 'tarifa',
      comision_porcentaje: profile.comision_porcentaje || 0,
      comision_fija: profile.comision_fija || 0,
      comision_notas: profile.comision_notas || '',
      comision_retiro_tipo: profile.comision_retiro_tipo || 'ninguna',
      comision_retiro_porcentaje: profile.comision_retiro_porcentaje || 0,
      comision_retiro_fija: profile.comision_retiro_fija || 0,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingProfile) return;

    const isChofer = editingRoles.includes('chofer');

    // Close dialog immediately for better UX (optimistic update will show changes)
    setIsDialogOpen(false);
    
    updateProfileMutation.mutate({
      profileId: editingProfile.id,
      updates: {
        nombre: formData.nombre,
        apellido: formData.apellido || null,
        telefono: formData.telefono || null,
        sucursal_id: formData.sucursal_id === 'none' ? null : (formData.sucursal_id || null),
        activo: formData.activo,
        // Only super admin can change tenant_id
        ...(isSuperAdmin() && formData.tenant_id && {
          tenant_id: formData.tenant_id,
        }),
        // Only save commission fields if user is a driver
        ...(isChofer && {
          comision_tipo: formData.comision_tipo,
          comision_porcentaje: formData.comision_porcentaje,
          comision_fija: formData.comision_fija,
          comision_notas: formData.comision_notas || null,
          // Pickup commission fields
          comision_retiro_tipo: formData.comision_retiro_tipo,
          comision_retiro_porcentaje: formData.comision_retiro_porcentaje,
          comision_retiro_fija: formData.comision_retiro_fija,
        }),
      },
    });
  };

  const handleAddRole = () => {
    if (!editingProfile || !formData.newRole) return;
    
    // Check if role already exists in local state
    if (editingRoles.includes(formData.newRole)) {
      toast.info('El usuario ya tiene este rol asignado');
      setFormData({ ...formData, newRole: '' });
      return;
    }
    
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
      (role === 'admin' || role === 'super_admin') &&
      editingProfile.user_id === currentUser?.id
    ) {
      toast.error('No puedes quitarte el rol de admin a ti mismo');
      return;
    }
    // Prevent non-super_admin from removing super_admin role
    if (role === 'super_admin' && !isSuperAdmin()) {
      toast.error('Solo un Super Admin puede quitar este rol');
      return;
    }
    removeRoleMutation.mutate({ userId: editingProfile.user_id, role });
    setEditingRoles(editingRoles.filter((r) => r !== role));
  };

  const getInitials = (nombre: string, apellido: string | null) => {
    return `${nombre[0]}${apellido?.[0] || ''}`.toUpperCase();
  };

  const handleCreateUser = async () => {
    if (!createFormData.email || !createFormData.password || !createFormData.nombre) {
      toast.error('Email, contraseña y nombre son requeridos');
      return;
    }
    if (createFormData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            email: createFormData.email,
            password: createFormData.password,
            nombre: createFormData.nombre,
            apellido: createFormData.apellido || null,
            telefono: createFormData.telefono || null,
            sucursal_id: createFormData.sucursal_id === 'none' ? null : (createFormData.sucursal_id || null),
            roles: createFormData.selectedRoles,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear usuario');
      }

      toast.success('Usuario creado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      clearCreateDraft();
      setIsCreateDialogOpen(false);
      setCreateFormData(defaultCreateForm);
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(error instanceof Error ? error.message : 'Error al crear usuario');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleCreateRole = (role: AppRole) => {
    if (createFormData.selectedRoles.includes(role)) {
      setCreateFormData({
        ...createFormData,
        selectedRoles: createFormData.selectedRoles.filter(r => r !== role),
      });
    } else {
      setCreateFormData({
        ...createFormData,
        selectedRoles: [...createFormData.selectedRoles, role],
      });
    }
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

  // Filter out super_admin from available roles if user is not super_admin
  const availableRoles = (Object.keys(ROLE_LABELS) as AppRole[]).filter(
    role => role !== 'super_admin' || isSuperAdmin()
  );

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
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </Button>
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
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setResetPasswordUser(profile);
                              setIsResetPasswordOpen(true);
                            }}
                            title="Reiniciar contraseña"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(profile)}
                            title="Editar usuario"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
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

              {/* Tenant selector - Only for Super Admin */}
              {isSuperAdmin() && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Empresa
                  </Label>
                  <Select
                    value={formData.tenant_id}
                    onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        tenant_id: value,
                        // Reset sucursal when tenant changes
                        sucursal_id: '' 
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {filteredSucursales.map((s) => (
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

              {/* Commission Configuration - Only visible for drivers */}
              {editingRoles.includes('chofer') && (
                <div className="space-y-4 p-4 bg-chofer/5 rounded-lg border border-chofer/20">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-chofer" />
                    <Label className="text-chofer font-medium">Configuración de Comisiones</Label>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Tipo de Comisión</Label>
                      <Select
                        value={formData.comision_tipo}
                        onValueChange={(value) =>
                          setFormData({ ...formData, comision_tipo: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tarifa">Según Tarifa del Envío</SelectItem>
                          <SelectItem value="porcentaje">Porcentaje Fijo</SelectItem>
                          <SelectItem value="fija">Comisión Fija por Entrega</SelectItem>
                          <SelectItem value="mixta">Mixta (Porcentaje + Fijo)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(formData.comision_tipo === 'porcentaje' || formData.comision_tipo === 'mixta') && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          Porcentaje (%)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={formData.comision_porcentaje}
                          onChange={(e) =>
                            setFormData({ ...formData, comision_porcentaje: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="Ej: 10"
                        />
                      </div>
                    )}

                    {(formData.comision_tipo === 'fija' || formData.comision_tipo === 'mixta') && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Monto Fijo por Entrega ($)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.comision_fija}
                          onChange={(e) =>
                            setFormData({ ...formData, comision_fija: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="Ej: 150"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Notas (acuerdos especiales)</Label>
                      <Textarea
                        value={formData.comision_notas}
                        onChange={(e) =>
                          setFormData({ ...formData, comision_notas: e.target.value })
                        }
                        placeholder="Ej: Comisión adicional por zona alejada..."
                        rows={2}
                      />
                    </div>
                  </div>
                  
                  {/* Pickup Commission Section */}
                  <div className="border-t border-chofer/20 pt-4 mt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-chofer" />
                      <Label className="text-chofer font-medium">Comisión por Retiro</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Se paga solo si el paquete es finalmente entregado
                    </p>
                    
                    <div className="space-y-2">
                      <Label>Tipo de Comisión por Retiro</Label>
                      <Select
                        value={formData.comision_retiro_tipo}
                        onValueChange={(value) =>
                          setFormData({ ...formData, comision_retiro_tipo: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ninguna">Sin comisión por retiro</SelectItem>
                          <SelectItem value="porcentaje">Porcentaje del Envío</SelectItem>
                          <SelectItem value="fija">Monto Fijo por Retiro</SelectItem>
                          <SelectItem value="mixta">Mixta (Porcentaje + Fijo)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(formData.comision_retiro_tipo === 'porcentaje' || formData.comision_retiro_tipo === 'mixta') && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          Porcentaje por Retiro (%)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={formData.comision_retiro_porcentaje}
                          onChange={(e) =>
                            setFormData({ ...formData, comision_retiro_porcentaje: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="Ej: 5"
                        />
                      </div>
                    )}

                    {(formData.comision_retiro_tipo === 'fija' || formData.comision_retiro_tipo === 'mixta') && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Monto Fijo por Retiro ($)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.comision_retiro_fija}
                          onChange={(e) =>
                            setFormData({ ...formData, comision_retiro_fija: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="Ej: 100"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

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

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>

          {/* Draft indicator */}
          {isCreateDraftRecovered && (
            <DraftIndicator
              lastSaved={createLastSaved}
              onDiscard={discardCreateDraft}
              onDismiss={() => setIsCreateDraftRecovered(false)}
              className="mb-2"
            />
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={createFormData.email}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña *</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={createFormData.password}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, password: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  placeholder="Juan"
                  value={createFormData.nombre}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, nombre: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido</Label>
                <Input
                  placeholder="Pérez"
                  value={createFormData.apellido}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, apellido: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                placeholder="+54 11 1234-5678"
                value={createFormData.telefono}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, telefono: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select
                value={createFormData.sucursal_id}
                onValueChange={(value) =>
                  setCreateFormData({ ...createFormData, sucursal_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
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
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((role) => (
                  <Badge
                    key={role}
                    className={`cursor-pointer transition-all ${
                      createFormData.selectedRoles.includes(role)
                        ? ROLE_COLORS[role]
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    onClick={() => toggleCreateRole(role)}
                  >
                    {ROLE_LABELS[role]} {createFormData.selectedRoles.includes(role) && '✓'}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Haz clic en los roles para seleccionar/deseleccionar
              </p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <DraftSavingIndicator hasDraft={hasCreateDraft} lastSaved={createLastSaved} />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancelar
                </Button>
                <Button onClick={handleCreateUser} disabled={isCreating}>
                  {isCreating ? 'Creando...' : 'Crear Usuario'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={isResetPasswordOpen}
        onOpenChange={setIsResetPasswordOpen}
        user={resetPasswordUser}
      />
    </div>
  );
}
