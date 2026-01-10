import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { toast } from 'sonner';
import {
  Plus,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Edit,
  Users,
  Package,
  Percent,
  Save,
} from 'lucide-react';

interface Sucursal {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string | null;
  email: string | null;
  horario_apertura: string | null;
  horario_cierre: string | null;
  activa: boolean | null;
  created_at: string | null;
}

interface TarifaConcepto {
  id: string;
  nombre: string;
  codigo: string;
  activo: boolean;
}

interface SucursalComision {
  id: string;
  sucursal_id: string;
  concepto_id: string;
  porcentaje_contado: number;
  porcentaje_destino: number;
  porcentaje_cta_cte: number;
}

export default function Branches() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCommissionsDialogOpen, setIsCommissionsDialogOpen] = useState(false);
  const [editingSucursal, setEditingSucursal] = useState<Sucursal | null>(null);
  const [selectedSucursalForCommissions, setSelectedSucursalForCommissions] = useState<Sucursal | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    email: '',
    horario_apertura: '08:00',
    horario_cierre: '18:00',
    activa: true,
  });
  const [commissionData, setCommissionData] = useState<Record<string, {
    contado: string;
    destino: string;
    cta_cte: string;
  }>>({});

  // Fetch sucursales
  const { data: sucursales = [], isLoading } = useQuery({
    queryKey: ['sucursales-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('*')
        .order('nombre');
      if (error) throw error;
      return data as Sucursal[];
    },
  });

  // Fetch conceptos
  const { data: conceptos = [] } = useQuery({
    queryKey: ['tarifa_conceptos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarifa_conceptos')
        .select('*')
        .eq('activo', true)
        .order('orden');
      if (error) throw error;
      return data as TarifaConcepto[];
    },
  });

  // Fetch comisiones para la sucursal seleccionada
  const { data: sucursalComisiones = [] } = useQuery({
    queryKey: ['sucursal_comisiones', selectedSucursalForCommissions?.id],
    queryFn: async () => {
      if (!selectedSucursalForCommissions) return [];
      const { data, error } = await supabase
        .from('sucursal_comisiones')
        .select('*')
        .eq('sucursal_id', selectedSucursalForCommissions.id);
      if (error) throw error;
      return data as SucursalComision[];
    },
    enabled: !!selectedSucursalForCommissions,
  });

  // Initialize commission data when dialog opens
  useEffect(() => {
    if (selectedSucursalForCommissions && conceptos.length > 0) {
      const initialData: Record<string, { contado: string; destino: string; cta_cte: string }> = {};
      conceptos.forEach((concepto) => {
        const existing = sucursalComisiones.find((c) => c.concepto_id === concepto.id);
        initialData[concepto.id] = {
          contado: existing?.porcentaje_contado?.toString() || '0',
          destino: existing?.porcentaje_destino?.toString() || '0',
          cta_cte: existing?.porcentaje_cta_cte?.toString() || '0',
        };
      });
      setCommissionData(initialData);
    }
  }, [selectedSucursalForCommissions, conceptos, sucursalComisiones]);

  // Create/Update sucursal mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const sucursalData = {
        nombre: data.nombre,
        direccion: data.direccion,
        telefono: data.telefono || null,
        email: data.email || null,
        horario_apertura: data.horario_apertura || null,
        horario_cierre: data.horario_cierre || null,
        activa: data.activa,
      };

      if (editingSucursal) {
        const { error } = await supabase
          .from('sucursales')
          .update(sucursalData)
          .eq('id', editingSucursal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sucursales').insert(sucursalData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursales-full'] });
      queryClient.invalidateQueries({ queryKey: ['sucursales'] });
      toast.success(editingSucursal ? 'Sucursal actualizada' : 'Sucursal creada');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Save commissions mutation
  const saveCommissionsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSucursalForCommissions) return;

      const operations = Object.entries(commissionData).map(async ([conceptoId, values]) => {
        const existing = sucursalComisiones.find((c) => c.concepto_id === conceptoId);
        const data = {
          sucursal_id: selectedSucursalForCommissions.id,
          concepto_id: conceptoId,
          porcentaje_contado: parseFloat(values.contado) || 0,
          porcentaje_destino: parseFloat(values.destino) || 0,
          porcentaje_cta_cte: parseFloat(values.cta_cte) || 0,
        };

        if (existing) {
          const { error } = await supabase
            .from('sucursal_comisiones')
            .update(data)
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('sucursal_comisiones').insert(data);
          if (error) throw error;
        }
      });

      await Promise.all(operations);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursal_comisiones'] });
      toast.success('Comisiones guardadas');
      setIsCommissionsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => {
      const { error } = await supabase
        .from('sucursales')
        .update({ activa })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursales-full'] });
      queryClient.invalidateQueries({ queryKey: ['sucursales'] });
      toast.success('Estado actualizado');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      nombre: '',
      direccion: '',
      telefono: '',
      email: '',
      horario_apertura: '08:00',
      horario_cierre: '18:00',
      activa: true,
    });
    setEditingSucursal(null);
  };

  const handleEdit = (sucursal: Sucursal) => {
    setEditingSucursal(sucursal);
    setFormData({
      nombre: sucursal.nombre,
      direccion: sucursal.direccion,
      telefono: sucursal.telefono || '',
      email: sucursal.email || '',
      horario_apertura: sucursal.horario_apertura || '08:00',
      horario_cierre: sucursal.horario_cierre || '18:00',
      activa: sucursal.activa ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenCommissions = (sucursal: Sucursal) => {
    setSelectedSucursalForCommissions(sucursal);
    setIsCommissionsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sucursales</h1>
          <p className="text-muted-foreground">
            Administra las sucursales y sus comisiones
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-sucursales hover:bg-sucursales/90">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Sucursal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingSucursal ? 'Editar Sucursal' : 'Nueva Sucursal'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) =>
                      setFormData({ ...formData, telefono: e.target.value })
                    }
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="horario_apertura">Hora Apertura</Label>
                  <Input
                    id="horario_apertura"
                    type="time"
                    value={formData.horario_apertura}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        horario_apertura: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="horario_cierre">Hora Cierre</Label>
                  <Input
                    id="horario_cierre"
                    type="time"
                    value={formData.horario_cierre}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        horario_cierre: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="activa">Sucursal Activa</Label>
                <Switch
                  id="activa"
                  checked={formData.activa}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, activa: checked })
                  }
                />
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
                  className="bg-sucursales hover:bg-sucursales/90"
                >
                  {saveMutation.isPending
                    ? 'Guardando...'
                    : editingSucursal
                    ? 'Actualizar'
                    : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-sucursales/10">
              <Building2 className="h-6 w-6 text-sucursales" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Sucursales</p>
              <p className="text-2xl font-bold">{sucursales.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <Building2 className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Activas</p>
              <p className="text-2xl font-bold">
                {sucursales.filter((s) => s.activa).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <Building2 className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inactivas</p>
              <p className="text-2xl font-bold">
                {sucursales.filter((s) => !s.activa).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sucursales Grid */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">
          Cargando sucursales...
        </div>
      ) : sucursales.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No hay sucursales registradas
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sucursales.map((sucursal) => (
            <Card
              key={sucursal.id}
              className={`glass card-hover ${!sucursal.activa ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-sucursales/10">
                      <Building2 className="h-5 w-5 text-sucursales" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{sucursal.nombre}</h3>
                      <Badge
                        variant={sucursal.activa ? 'default' : 'secondary'}
                        className={
                          sucursal.activa
                            ? 'bg-success/10 text-success'
                            : 'bg-muted'
                        }
                      >
                        {sucursal.activa ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenCommissions(sucursal)}
                      title="Configurar comisiones"
                    >
                      <Percent className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(sucursal)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{sucursal.direccion}</span>
                  </div>
                  {sucursal.telefono && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{sucursal.telefono}</span>
                    </div>
                  )}
                  {sucursal.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{sucursal.email}</span>
                    </div>
                  )}
                  {(sucursal.horario_apertura || sucursal.horario_cierre) && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {sucursal.horario_apertura} - {sucursal.horario_cierre}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>-- usuarios</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      <span>-- envíos</span>
                    </div>
                  </div>
                  <Switch
                    checked={sucursal.activa ?? true}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({
                        id: sucursal.id,
                        activa: checked,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para configurar comisiones */}
      <Dialog open={isCommissionsDialogOpen} onOpenChange={setIsCommissionsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Comisiones - {selectedSucursalForCommissions?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Define el porcentaje de comisión por cada concepto según el tipo de pago.
            </p>
            
            {conceptos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay conceptos configurados. Ve a Tarifas → Conceptos para crearlos.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-center">% Contado</TableHead>
                    <TableHead className="text-center">% Destino</TableHead>
                    <TableHead className="text-center">% Cta. Cte.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conceptos.map((concepto) => (
                    <TableRow key={concepto.id}>
                      <TableCell className="font-medium">{concepto.nombre}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={commissionData[concepto.id]?.contado || '0'}
                          onChange={(e) =>
                            setCommissionData({
                              ...commissionData,
                              [concepto.id]: {
                                ...commissionData[concepto.id],
                                contado: e.target.value,
                              },
                            })
                          }
                          className="w-20 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={commissionData[concepto.id]?.destino || '0'}
                          onChange={(e) =>
                            setCommissionData({
                              ...commissionData,
                              [concepto.id]: {
                                ...commissionData[concepto.id],
                                destino: e.target.value,
                              },
                            })
                          }
                          className="w-20 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={commissionData[concepto.id]?.cta_cte || '0'}
                          onChange={(e) =>
                            setCommissionData({
                              ...commissionData,
                              [concepto.id]: {
                                ...commissionData[concepto.id],
                                cta_cte: e.target.value,
                              },
                            })
                          }
                          className="w-20 text-center"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCommissionsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveCommissionsMutation.mutate()}
                disabled={saveCommissionsMutation.isPending || conceptos.length === 0}
                className="bg-sucursales hover:bg-sucursales/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveCommissionsMutation.isPending ? 'Guardando...' : 'Guardar Comisiones'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
