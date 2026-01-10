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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  DollarSign,
  Edit,
  Weight,
  MapPin,
  Users,
  Percent,
} from 'lucide-react';

interface Tarifa {
  id: string;
  nombre: string;
  precio_base: number;
  precio_por_kg: number | null;
  precio_por_km: number | null;
  zona_origen: string | null;
  zona_destino: string | null;
  comision_chofer_porcentaje: number | null;
  comision_chofer_fija: number | null;
  activa: boolean | null;
  created_at: string | null;
}

export default function Rates() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarifa, setEditingTarifa] = useState<Tarifa | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    precio_base: '',
    precio_por_kg: '',
    precio_por_km: '',
    zona_origen: '',
    zona_destino: '',
    comision_chofer_porcentaje: '',
    comision_chofer_fija: '',
    activa: true,
  });

  // Fetch tarifas
  const { data: tarifas = [], isLoading } = useQuery({
    queryKey: ['tarifas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarifas')
        .select('*')
        .order('nombre');
      if (error) throw error;
      return data as Tarifa[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const tarifaData = {
        nombre: data.nombre,
        precio_base: parseFloat(data.precio_base),
        precio_por_kg: data.precio_por_kg
          ? parseFloat(data.precio_por_kg)
          : null,
        precio_por_km: data.precio_por_km
          ? parseFloat(data.precio_por_km)
          : null,
        zona_origen: data.zona_origen || null,
        zona_destino: data.zona_destino || null,
        comision_chofer_porcentaje: data.comision_chofer_porcentaje
          ? parseFloat(data.comision_chofer_porcentaje)
          : null,
        comision_chofer_fija: data.comision_chofer_fija
          ? parseFloat(data.comision_chofer_fija)
          : null,
        activa: data.activa,
      };

      if (editingTarifa) {
        const { error } = await supabase
          .from('tarifas')
          .update(tarifaData)
          .eq('id', editingTarifa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tarifas').insert(tarifaData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarifas'] });
      toast.success(editingTarifa ? 'Tarifa actualizada' : 'Tarifa creada');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => {
      const { error } = await supabase
        .from('tarifas')
        .update({ activa })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarifas'] });
      toast.success('Estado actualizado');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      nombre: '',
      precio_base: '',
      precio_por_kg: '',
      precio_por_km: '',
      zona_origen: '',
      zona_destino: '',
      comision_chofer_porcentaje: '',
      comision_chofer_fija: '',
      activa: true,
    });
    setEditingTarifa(null);
  };

  const handleEdit = (tarifa: Tarifa) => {
    setEditingTarifa(tarifa);
    setFormData({
      nombre: tarifa.nombre,
      precio_base: tarifa.precio_base.toString(),
      precio_por_kg: tarifa.precio_por_kg?.toString() || '',
      precio_por_km: tarifa.precio_por_km?.toString() || '',
      zona_origen: tarifa.zona_origen || '',
      zona_destino: tarifa.zona_destino || '',
      comision_chofer_porcentaje:
        tarifa.comision_chofer_porcentaje?.toString() || '',
      comision_chofer_fija: tarifa.comision_chofer_fija?.toString() || '',
      activa: tarifa.activa ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
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
          <h1 className="text-3xl font-bold text-foreground">Tarifas</h1>
          <p className="text-muted-foreground">
            Configura las tarifas de envío
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
            <Button className="bg-tarifas hover:bg-tarifas/90">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Tarifa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTarifa ? 'Editar Tarifa' : 'Nueva Tarifa'}
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
                  placeholder="Ej: Envío Local, Express, etc."
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="precio_base">Precio Base *</Label>
                  <Input
                    id="precio_base"
                    type="number"
                    step="0.01"
                    value={formData.precio_base}
                    onChange={(e) =>
                      setFormData({ ...formData, precio_base: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precio_por_kg">$/Kg</Label>
                  <Input
                    id="precio_por_kg"
                    type="number"
                    step="0.01"
                    value={formData.precio_por_kg}
                    onChange={(e) =>
                      setFormData({ ...formData, precio_por_kg: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precio_por_km">$/Km</Label>
                  <Input
                    id="precio_por_km"
                    type="number"
                    step="0.01"
                    value={formData.precio_por_km}
                    onChange={(e) =>
                      setFormData({ ...formData, precio_por_km: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zona_origen">Zona Origen</Label>
                  <Input
                    id="zona_origen"
                    value={formData.zona_origen}
                    onChange={(e) =>
                      setFormData({ ...formData, zona_origen: e.target.value })
                    }
                    placeholder="Ej: Capital"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zona_destino">Zona Destino</Label>
                  <Input
                    id="zona_destino"
                    value={formData.zona_destino}
                    onChange={(e) =>
                      setFormData({ ...formData, zona_destino: e.target.value })
                    }
                    placeholder="Ej: GBA"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Comisión Chofer</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="comision_chofer_porcentaje">
                      Porcentaje %
                    </Label>
                    <Input
                      id="comision_chofer_porcentaje"
                      type="number"
                      step="0.01"
                      value={formData.comision_chofer_porcentaje}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          comision_chofer_porcentaje: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comision_chofer_fija">Monto Fijo</Label>
                    <Input
                      id="comision_chofer_fija"
                      type="number"
                      step="0.01"
                      value={formData.comision_chofer_fija}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          comision_chofer_fija: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="activa">Tarifa Activa</Label>
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
                  className="bg-tarifas hover:bg-tarifas/90"
                >
                  {saveMutation.isPending
                    ? 'Guardando...'
                    : editingTarifa
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
            <div className="p-3 rounded-xl bg-tarifas/10">
              <DollarSign className="h-6 w-6 text-tarifas" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Tarifas</p>
              <p className="text-2xl font-bold">{tarifas.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <DollarSign className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Activas</p>
              <p className="text-2xl font-bold">
                {tarifas.filter((t) => t.activa).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Precio Promedio</p>
              <p className="text-2xl font-bold">
                {tarifas.length > 0
                  ? formatCurrency(
                      tarifas.reduce((sum, t) => sum + t.precio_base, 0) /
                        tarifas.length
                    )
                  : '$0'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tarifas Grid */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">
          Cargando tarifas...
        </div>
      ) : tarifas.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No hay tarifas registradas
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tarifas.map((tarifa) => (
            <Card
              key={tarifa.id}
              className={`glass card-hover ${
                !tarifa.activa ? 'opacity-60' : ''
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{tarifa.nombre}</h3>
                    <Badge
                      variant={tarifa.activa ? 'default' : 'secondary'}
                      className={
                        tarifa.activa
                          ? 'bg-success/10 text-success'
                          : 'bg-muted'
                      }
                    >
                      {tarifa.activa ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(tarifa)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mb-4">
                  <p className="text-3xl font-bold text-tarifas">
                    {formatCurrency(tarifa.precio_base)}
                  </p>
                  <p className="text-xs text-muted-foreground">Precio base</p>
                </div>

                <div className="space-y-2 text-sm">
                  {tarifa.precio_por_kg && (
                    <div className="flex items-center gap-2">
                      <Weight className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {formatCurrency(tarifa.precio_por_kg)} por kg
                      </span>
                    </div>
                  )}
                  {tarifa.precio_por_km && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {formatCurrency(tarifa.precio_por_km)} por km
                      </span>
                    </div>
                  )}
                  {(tarifa.zona_origen || tarifa.zona_destino) && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {tarifa.zona_origen || 'Cualquier'} →{' '}
                        {tarifa.zona_destino || 'Cualquier'}
                      </span>
                    </div>
                  )}
                </div>

                {(tarifa.comision_chofer_porcentaje ||
                  tarifa.comision_chofer_fija) && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-chofer" />
                      <span className="text-muted-foreground">
                        Comisión chofer:
                      </span>
                      {tarifa.comision_chofer_porcentaje && (
                        <span className="font-medium">
                          {tarifa.comision_chofer_porcentaje}%
                        </span>
                      )}
                      {tarifa.comision_chofer_porcentaje &&
                        tarifa.comision_chofer_fija && <span>+</span>}
                      {tarifa.comision_chofer_fija && (
                        <span className="font-medium">
                          {formatCurrency(tarifa.comision_chofer_fija)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t flex items-center justify-end">
                  <Switch
                    checked={tarifa.activa ?? true}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({
                        id: tarifa.id,
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
    </div>
  );
}
