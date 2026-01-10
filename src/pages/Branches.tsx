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
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Warehouse,
  Truck,
  Home,
  ArrowDownToLine,
  ArrowUpFromLine,
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
  // New fields
  codigo: string | null;
  ciudad: string | null;
  es_centro_logistico: boolean | null;
  puede_despachar: boolean | null;
  puede_recibir: boolean | null;
  realiza_retiros: boolean | null;
  realiza_entregas: boolean | null;
  centro_logistico_id: string | null;
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
    // New fields
    codigo: '',
    ciudad: '',
    es_centro_logistico: false,
    puede_despachar: true,
    puede_recibir: true,
    realiza_retiros: false,
    realiza_entregas: false,
    centro_logistico_id: '',
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

  // Get centros logísticos for dropdown
  const centrosLogisticos = sucursales.filter(s => s.es_centro_logistico);

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
        // New fields
        codigo: data.codigo || null,
        ciudad: data.ciudad || null,
        es_centro_logistico: data.es_centro_logistico,
        puede_despachar: data.puede_despachar,
        puede_recibir: data.puede_recibir,
        realiza_retiros: data.realiza_retiros,
        realiza_entregas: data.realiza_entregas,
        centro_logistico_id: data.centro_logistico_id || null,
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
      codigo: '',
      ciudad: '',
      es_centro_logistico: false,
      puede_despachar: true,
      puede_recibir: true,
      realiza_retiros: false,
      realiza_entregas: false,
      centro_logistico_id: '',
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
      codigo: sucursal.codigo || '',
      ciudad: sucursal.ciudad || '',
      es_centro_logistico: sucursal.es_centro_logistico ?? false,
      puede_despachar: sucursal.puede_despachar ?? true,
      puede_recibir: sucursal.puede_recibir ?? true,
      realiza_retiros: sucursal.realiza_retiros ?? false,
      realiza_entregas: sucursal.realiza_entregas ?? false,
      centro_logistico_id: sucursal.centro_logistico_id || '',
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

  const getCapacidadesBadges = (sucursal: Sucursal) => {
    const badges = [];
    if (sucursal.es_centro_logistico) {
      badges.push({ label: 'Centro Logístico', color: 'bg-accent text-accent-foreground', icon: Warehouse });
    }
    if (sucursal.realiza_retiros) {
      badges.push({ label: 'Retiros', color: 'bg-warning/20 text-warning', icon: ArrowUpFromLine });
    }
    if (sucursal.realiza_entregas) {
      badges.push({ label: 'Entregas', color: 'bg-success/20 text-success', icon: ArrowDownToLine });
    }
    return badges;
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
            Administra las sucursales, capacidades y comisiones
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSucursal ? 'Editar Sucursal' : 'Nueva Sucursal'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Información Básica
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) =>
                        setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                      }
                      placeholder="Ej: SUC01, CENTRAL"
                      required
                    />
                    <p className="text-xs text-muted-foreground">Se usará en el tracking</p>
                  </div>
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
                    <Label htmlFor="ciudad">Ciudad *</Label>
                    <Input
                      id="ciudad"
                      value={formData.ciudad}
                      onChange={(e) =>
                        setFormData({ ...formData, ciudad: e.target.value })
                      }
                      placeholder="Ej: Buenos Aires"
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
              </div>

              <Separator />

              {/* Capacidades */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Capacidades Operativas
                </h3>
                
                {/* Centro Logístico */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-accent" />
                      <Label className="font-medium">Centro Logístico</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Hub central de distribución para otras sucursales
                    </p>
                  </div>
                  <Switch
                    checked={formData.es_centro_logistico}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, es_centro_logistico: checked })
                    }
                  />
                </div>

                {/* Asignar a centro logístico */}
                {!formData.es_centro_logistico && centrosLogisticos.length > 0 && (
                  <div className="space-y-2">
                    <Label>Centro Logístico Asignado</Label>
                    <Select
                      value={formData.centro_logistico_id || "none"}
                      onValueChange={(v) => setFormData({ ...formData, centro_logistico_id: v === "none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar centro logístico" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {centrosLogisticos
                          .filter(c => c.id !== editingSucursal?.id)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.codigo} - {c.nombre}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Los envíos pasarán por este centro antes de llegar a destino
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Puede Despachar</Label>
                      <p className="text-xs text-muted-foreground">Enviar paquetes</p>
                    </div>
                    <Switch
                      checked={formData.puede_despachar}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, puede_despachar: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Puede Recibir</Label>
                      <p className="text-xs text-muted-foreground">Recibir paquetes</p>
                    </div>
                    <Switch
                      checked={formData.puede_recibir}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, puede_recibir: checked })
                      }
                    />
                  </div>
                </div>

                <Separator />

                <h4 className="font-medium flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Servicios de Última Milla
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-warning/30 bg-warning/5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <ArrowUpFromLine className="h-4 w-4 text-warning" />
                        <Label className="text-sm">Realiza Retiros</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">Retirar en domicilio</p>
                    </div>
                    <Switch
                      checked={formData.realiza_retiros}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, realiza_retiros: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-success/30 bg-success/5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <ArrowDownToLine className="h-4 w-4 text-success" />
                        <Label className="text-sm">Realiza Entregas</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">Entregar a domicilio</p>
                    </div>
                    <Switch
                      checked={formData.realiza_entregas}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, realiza_entregas: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="p-3 rounded-xl bg-accent/10">
              <Warehouse className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Centros Logísticos</p>
              <p className="text-2xl font-bold">
                {sucursales.filter((s) => s.es_centro_logistico).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <ArrowDownToLine className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Con Entregas</p>
              <p className="text-2xl font-bold">
                {sucursales.filter((s) => s.realiza_entregas).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <ArrowUpFromLine className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Con Retiros</p>
              <p className="text-2xl font-bold">
                {sucursales.filter((s) => s.realiza_retiros).length}
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
                    <div className={`p-2 rounded-lg ${sucursal.es_centro_logistico ? 'bg-accent/10' : 'bg-sucursales/10'}`}>
                      {sucursal.es_centro_logistico ? (
                        <Warehouse className="h-5 w-5 text-accent" />
                      ) : (
                        <Building2 className="h-5 w-5 text-sucursales" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {sucursal.codigo && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {sucursal.codigo}
                          </Badge>
                        )}
                        <h3 className="font-semibold">{sucursal.nombre}</h3>
                      </div>
                      {sucursal.ciudad && (
                        <p className="text-sm text-muted-foreground">{sucursal.ciudad}</p>
                      )}
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

                {/* Capacidades badges */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {getCapacidadesBadges(sucursal).map((badge, idx) => {
                    const Icon = badge.icon;
                    return (
                      <Badge key={idx} className={`${badge.color} text-xs gap-1`}>
                        <Icon className="h-3 w-3" />
                        {badge.label}
                      </Badge>
                    );
                  })}
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