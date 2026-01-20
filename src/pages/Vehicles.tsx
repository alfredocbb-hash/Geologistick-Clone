import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Car, 
  Plus, 
  Search, 
  RefreshCw, 
  Edit, 
  Trash2,
  Truck,
  Bike,
  CircleDot,
  User,
  Weight,
  Boxes,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

const VEHICLE_TYPES = [
  { value: 'furgon', label: 'Furgón', icon: Truck },
  { value: 'camioneta', label: 'Camioneta', icon: Truck },
  { value: 'auto', label: 'Auto', icon: Car },
  { value: 'moto', label: 'Moto', icon: Bike },
];

const STATUS_CONFIG = {
  disponible: { label: 'Disponible', color: 'bg-green-500' },
  en_uso: { label: 'En Uso', color: 'bg-blue-500' },
  mantenimiento: { label: 'Mantenimiento', color: 'bg-yellow-500' },
  inactivo: { label: 'Inactivo', color: 'bg-gray-500' },
};

interface VehicleForm {
  patente: string;
  marca: string;
  modelo: string;
  anio: string;
  tipo: string;
  capacidad_kg: string;
  capacidad_bultos: string;
  estado: string;
  notas: string;
  sucursal_id: string;
}

const defaultForm: VehicleForm = {
  patente: '',
  marca: '',
  modelo: '',
  anio: '',
  tipo: 'furgon',
  capacidad_kg: '',
  capacidad_bultos: '',
  estado: 'disponible',
  notas: '',
  sucursal_id: '',
};

export default function Vehicles() {
  const { isAdmin, hasRole, profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [form, setForm] = useState<VehicleForm>(defaultForm);

  const canManage = isAdmin() || hasRole('supervisor');

  const { data: vehicles, isLoading, refetch } = useQuery({
    queryKey: ['vehiculos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehiculos')
        .select(`
          *,
          sucursal:sucursales(nombre)
        `)
        .order('patente');
      
      if (error) throw error;
      
      // Fetch driver profiles separately
      const driverIds = [...new Set(data?.map(v => v.chofer_asignado_id).filter(Boolean))];
      let drivers: Record<string, { nombre: string; apellido: string | null }> = {};
      
      if (driverIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, nombre, apellido')
          .in('user_id', driverIds as string[]);
        
        profileData?.forEach(p => {
          drivers[p.user_id] = { nombre: p.nombre, apellido: p.apellido };
        });
      }
      
      return data?.map(v => ({
        ...v,
        chofer: v.chofer_asignado_id ? drivers[v.chofer_asignado_id] : null
      })) || [];
    },
  });

  const { data: sucursales } = useQuery({
    queryKey: ['sucursales-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre, codigo')
        .eq('activa', true)
        .order('nombre');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ['choferes-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nombre, apellido')
        .eq('activo', true);
      
      if (error) throw error;
      
      // Filter only drivers
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'chofer');
      
      const driverIds = new Set(roles?.map(r => r.user_id));
      return data?.filter(p => driverIds.has(p.user_id)) || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: VehicleForm) => {
      const vehicleData = {
        patente: data.patente.toUpperCase(),
        marca: data.marca || null,
        modelo: data.modelo || null,
        anio: data.anio ? parseInt(data.anio) : null,
        tipo: data.tipo,
        capacidad_kg: data.capacidad_kg ? parseFloat(data.capacidad_kg) : null,
        capacidad_bultos: data.capacidad_bultos ? parseInt(data.capacidad_bultos) : null,
        estado: data.estado,
        notas: data.notas || null,
        sucursal_id: data.sucursal_id || null,
      };

      if (editingVehicle) {
        const { error } = await supabase
          .from('vehiculos')
          .update(vehicleData)
          .eq('id', editingVehicle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vehiculos')
          .insert({
            ...vehicleData,
            tenant_id: profile?.tenant_id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingVehicle ? 'Vehículo actualizado' : 'Vehículo creado');
      queryClient.invalidateQueries({ queryKey: ['vehiculos'] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        toast.error('Ya existe un vehículo con esa patente');
      } else {
        toast.error('Error al guardar el vehículo');
      }
      console.error(error);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vehiculos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vehículo eliminado');
      queryClient.invalidateQueries({ queryKey: ['vehiculos'] });
    },
    onError: (error) => {
      toast.error('Error al eliminar el vehículo');
      console.error(error);
    }
  });

  const handleOpenDialog = (vehicle?: any) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setForm({
        patente: vehicle.patente || '',
        marca: vehicle.marca || '',
        modelo: vehicle.modelo || '',
        anio: vehicle.anio?.toString() || '',
        tipo: vehicle.tipo || 'furgon',
        capacidad_kg: vehicle.capacidad_kg?.toString() || '',
        capacidad_bultos: vehicle.capacidad_bultos?.toString() || '',
        estado: vehicle.estado || 'disponible',
        notas: vehicle.notas || '',
        sucursal_id: vehicle.sucursal_id || '',
      });
    } else {
      setEditingVehicle(null);
      setForm(defaultForm);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingVehicle(null);
    setForm(defaultForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patente.trim()) {
      toast.error('La patente es requerida');
      return;
    }
    saveMutation.mutate(form);
  };

  const filteredVehicles = vehicles?.filter(v => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      v.patente?.toLowerCase().includes(searchLower) ||
      v.marca?.toLowerCase().includes(searchLower) ||
      v.modelo?.toLowerCase().includes(searchLower) ||
      v.sucursal?.nombre?.toLowerCase().includes(searchLower)
    );
  });

  const stats = {
    total: vehicles?.length || 0,
    disponible: vehicles?.filter(v => v.estado === 'disponible').length || 0,
    en_uso: vehicles?.filter(v => v.estado === 'en_uso').length || 0,
    mantenimiento: vehicles?.filter(v => v.estado === 'mantenimiento').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Car className="h-8 w-8 text-primary" />
            Gestión de Vehículos
          </h1>
          <p className="text-muted-foreground mt-1">
            Administra la flota de vehículos
          </p>
        </div>
        {canManage && (
          <Button onClick={() => handleOpenDialog()} className="gradient-primary">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Vehículo
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disponibles</CardTitle>
            <CircleDot className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.disponible}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En Uso</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.en_uso}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mantenimiento</CardTitle>
            <CircleDot className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.mantenimiento}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por patente, marca, modelo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredVehicles && filteredVehicles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Marca / Modelo</TableHead>
                  <TableHead>Capacidad</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Chofer</TableHead>
                  <TableHead>Estado</TableHead>
                  {canManage && <TableHead className="text-center">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => {
                  const typeConfig = VEHICLE_TYPES.find(t => t.value === vehicle.tipo);
                  const TypeIcon = typeConfig?.icon || Truck;
                  const statusCfg = STATUS_CONFIG[vehicle.estado as keyof typeof STATUS_CONFIG];
                  
                  return (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-mono font-bold">
                        {vehicle.patente}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                          {typeConfig?.label || vehicle.tipo}
                        </div>
                      </TableCell>
                      <TableCell>
                        {vehicle.marca || vehicle.modelo 
                          ? `${vehicle.marca || ''} ${vehicle.modelo || ''}`.trim() 
                          : '-'}
                        {vehicle.anio && <span className="text-muted-foreground ml-1">({vehicle.anio})</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {vehicle.capacidad_kg && `${vehicle.capacidad_kg}kg`}
                        {vehicle.capacidad_kg && vehicle.capacidad_bultos && ' / '}
                        {vehicle.capacidad_bultos && `${vehicle.capacidad_bultos} bultos`}
                        {!vehicle.capacidad_kg && !vehicle.capacidad_bultos && '-'}
                      </TableCell>
                      <TableCell>
                        {vehicle.sucursal?.nombre || '-'}
                      </TableCell>
                      <TableCell>
                        {vehicle.chofer 
                          ? `${vehicle.chofer.nombre} ${vehicle.chofer.apellido || ''}`.trim()
                          : <span className="text-muted-foreground">Sin asignar</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusCfg?.color || 'bg-gray-500'} text-white`}>
                          {statusCfg?.label || vehicle.estado}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(vehicle)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm('¿Eliminar este vehículo?')) {
                                  deleteMutation.mutate(vehicle.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Car className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No hay vehículos</h3>
              <p className="text-muted-foreground">Agrega el primer vehículo de la flota</p>
              {canManage && (
                <Button onClick={() => handleOpenDialog()} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Vehículo
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}
              </DialogTitle>
              <DialogDescription>
                {editingVehicle ? 'Modifica los datos del vehículo' : 'Ingresa los datos del nuevo vehículo'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="patente">Patente *</Label>
                  <Input
                    id="patente"
                    value={form.patente}
                    onChange={(e) => setForm({ ...form, patente: e.target.value })}
                    placeholder="ABC123"
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select value={form.tipo} onValueChange={(val) => setForm({ ...form, tipo: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="marca">Marca</Label>
                  <Input
                    id="marca"
                    value={form.marca}
                    onChange={(e) => setForm({ ...form, marca: e.target.value })}
                    placeholder="Ford"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelo">Modelo</Label>
                  <Input
                    id="modelo"
                    value={form.modelo}
                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                    placeholder="Transit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="anio">Año</Label>
                  <Input
                    id="anio"
                    type="number"
                    value={form.anio}
                    onChange={(e) => setForm({ ...form, anio: e.target.value })}
                    placeholder="2023"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacidad_kg">Capacidad (kg)</Label>
                  <Input
                    id="capacidad_kg"
                    type="number"
                    value={form.capacidad_kg}
                    onChange={(e) => setForm({ ...form, capacidad_kg: e.target.value })}
                    placeholder="1500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacidad_bultos">Capacidad (bultos)</Label>
                  <Input
                    id="capacidad_bultos"
                    type="number"
                    value={form.capacidad_bultos}
                    onChange={(e) => setForm({ ...form, capacidad_bultos: e.target.value })}
                    placeholder="50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sucursal">Sucursal</Label>
                  <Select
                    value={form.sucursal_id || "none"}
                    onValueChange={(val) => setForm({ ...form, sucursal_id: val === "none" ? "" : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {sucursales?.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.codigo && `[${s.codigo}] `}{s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">Estado</Label>
                  <Select value={form.estado} onValueChange={(val) => setForm({ ...form, estado: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notas">Notas</Label>
                <Textarea
                  id="notas"
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  placeholder="Observaciones del vehículo..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
