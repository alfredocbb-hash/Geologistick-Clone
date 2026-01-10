import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Users,
  Phone,
  Mail,
  MapPin,
  Edit,
  Trash2,
  CreditCard,
  Building2,
} from 'lucide-react';

interface Client {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string;
  email: string | null;
  direccion: string;
  ciudad: string | null;
  codigo_postal: string | null;
  notas: string | null;
  sucursal_id: string | null;
  created_at: string | null;
  tiene_cuenta_corriente: boolean | null;
  limite_credito: number | null;
  saldo_cuenta_corriente: number | null;
}

interface Sucursal {
  id: string;
  nombre: string;
}

export default function Clients() {
  const { profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
    codigo_postal: '',
    notas: '',
    sucursal_id: '',
    tiene_cuenta_corriente: false,
    limite_credito: '',
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

  // Fetch clients
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(
          `nombre.ilike.%${searchTerm}%,apellido.ilike.%${searchTerm}%,telefono.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Client[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const clientData = {
        nombre: data.nombre,
        apellido: data.apellido || null,
        telefono: data.telefono,
        email: data.email || null,
        direccion: data.direccion,
        ciudad: data.ciudad || null,
        codigo_postal: data.codigo_postal || null,
        notas: data.notas || null,
        sucursal_id: data.sucursal_id || profile?.sucursal_id || null,
        tiene_cuenta_corriente: data.tiene_cuenta_corriente,
        limite_credito: data.limite_credito ? parseFloat(data.limite_credito) : 0,
      };

      if (editingClient) {
        const { error } = await supabase
          .from('clientes')
          .update(clientData)
          .eq('id', editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clientes').insert(clientData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(editingClient ? 'Cliente actualizado' : 'Cliente creado');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente eliminado');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      nombre: '',
      apellido: '',
      telefono: '',
      email: '',
      direccion: '',
      ciudad: '',
      codigo_postal: '',
      notas: '',
      sucursal_id: '',
      tiene_cuenta_corriente: false,
      limite_credito: '',
    });
    setEditingClient(null);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      nombre: client.nombre,
      apellido: client.apellido || '',
      telefono: client.telefono,
      email: client.email || '',
      direccion: client.direccion,
      ciudad: client.ciudad || '',
      codigo_postal: client.codigo_postal || '',
      notas: client.notas || '',
      sucursal_id: client.sucursal_id || '',
      tiene_cuenta_corriente: client.tiene_cuenta_corriente ?? false,
      limite_credito: client.limite_credito?.toString() || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const getSucursalName = (sucursalId: string | null) => {
    if (!sucursalId) return 'Sin asignar';
    return sucursales.find((s) => s.id === sucursalId)?.nombre || 'Desconocida';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">
            Gestiona la base de datos de clientes
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-clientes hover:bg-clientes/90">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input
                    id="apellido"
                    value={formData.apellido}
                    onChange={(e) =>
                      setFormData({ ...formData, apellido: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono *</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) =>
                      setFormData({ ...formData, telefono: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="direccion">Dirección *</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) =>
                      setFormData({ ...formData, direccion: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input
                    id="ciudad"
                    value={formData.ciudad}
                    onChange={(e) =>
                      setFormData({ ...formData, ciudad: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo_postal">Código Postal</Label>
                  <Input
                    id="codigo_postal"
                    value={formData.codigo_postal}
                    onChange={(e) =>
                      setFormData({ ...formData, codigo_postal: e.target.value })
                    }
                  />
                </div>
                {isAdmin() && (
                  <div className="space-y-2">
                    <Label htmlFor="sucursal">Sucursal</Label>
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
                        {sucursales.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notas">Notas</Label>
                  <Textarea
                    id="notas"
                    value={formData.notas}
                    onChange={(e) =>
                      setFormData({ ...formData, notas: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                
                {/* Cuenta Corriente Section */}
                <Separator className="md:col-span-2" />
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="tiene_cuenta_corriente">Cuenta Corriente</Label>
                      <p className="text-xs text-muted-foreground">
                        Habilitar crédito para este cliente
                      </p>
                    </div>
                    <Switch
                      id="tiene_cuenta_corriente"
                      checked={formData.tiene_cuenta_corriente}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, tiene_cuenta_corriente: checked })
                      }
                    />
                  </div>
                  
                  {formData.tiene_cuenta_corriente && (
                    <div className="space-y-2">
                      <Label htmlFor="limite_credito">Límite de Crédito ($)</Label>
                      <Input
                        id="limite_credito"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.limite_credito}
                        onChange={(e) =>
                          setFormData({ ...formData, limite_credito: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="bg-clientes hover:bg-clientes/90"
                >
                  {saveMutation.isPending
                    ? 'Guardando...'
                    : editingClient
                    ? 'Actualizar'
                    : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-clientes/10">
              <Users className="h-6 w-6 text-clientes" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Clientes</p>
              <p className="text-2xl font-bold">{clients.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-finanzas/10">
              <CreditCard className="h-6 w-6 text-finanzas" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Con Cuenta Cte.</p>
              <p className="text-2xl font-bold">
                {clients.filter((c) => c.tiene_cuenta_corriente).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <Mail className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Con Email</p>
              <p className="text-2xl font-bold">
                {clients.filter((c) => c.email).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-sucursales/10">
              <Building2 className="h-6 w-6 text-sucursales" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sucursales</p>
              <p className="text-2xl font-bold">{sucursales.length}</p>
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
              placeholder="Buscar por nombre, teléfono o email..."
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
              Cargando clientes...
            </div>
          ) : clients.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No se encontraron clientes
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Cuenta Cte.</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="font-medium">
                        {client.nombre} {client.apellido}
                      </div>
                      {client.notas && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {client.notas}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {client.telefono}
                        </div>
                        {client.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-1">
                        <MapPin className="h-3 w-3 mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-sm">{client.direccion}</p>
                          {(client.ciudad || client.codigo_postal) && (
                            <p className="text-xs text-muted-foreground">
                              {[client.ciudad, client.codigo_postal]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getSucursalName(client.sucursal_id)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {client.tiene_cuenta_corriente ? (
                        <div className="space-y-1">
                          <Badge className="bg-finanzas/10 text-finanzas border-finanzas">
                            Habilitada
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            Saldo: ${(client.saldo_cuenta_corriente || 0).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Límite: ${(client.limite_credito || 0).toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(client)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (
                              confirm(
                                '¿Estás seguro de eliminar este cliente?'
                              )
                            ) {
                              deleteMutation.mutate(client.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
