import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DollarSign,
  Edit,
  Weight,
  MapPin,
  Users,
  Layers,
  Trash2,
  Building2,
  Box,
  Ruler,
} from 'lucide-react';
import { RateTypeSelector, getRateTypeLabel, ConceptBranchesDialog } from '@/components/rates';
import type { RateType } from '@/components/rates';

interface Tarifa {
  id: string;
  nombre: string;
  precio_base: number;
  precio_por_kg: number | null;
  precio_por_km: number | null;
  precio_por_m3: number | null;
  zona_origen: string | null;
  zona_destino: string | null;
  comision_chofer_porcentaje: number | null;
  comision_chofer_fija: number | null;
  activa: boolean | null;
  tipo_tarifa: RateType;
  rangos_precios: any[];
  created_at: string | null;
}

interface TarifaConcepto {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  orden: number;
  es_basico: boolean;
}

interface TarifaConceptoPrecio {
  id: string;
  tarifa_id: string;
  concepto_id: string;
  monto: number;
  concepto?: TarifaConcepto;
}

export default function Rates() {
  const { isAdmin, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('tarifas');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConceptDialogOpen, setIsConceptDialogOpen] = useState(false);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [editingTarifa, setEditingTarifa] = useState<Tarifa | null>(null);
  const [editingConcept, setEditingConcept] = useState<TarifaConcepto | null>(null);
  const [selectedTarifaForPricing, setSelectedTarifaForPricing] = useState<Tarifa | null>(null);
  const [selectedConceptForBranches, setSelectedConceptForBranches] = useState<TarifaConcepto | null>(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    tipo_tarifa: 'peso' as RateType,
    precio_base: '',
    precio_por_kg: '',
    precio_por_km: '',
    precio_por_m3: '',
    zona_origen: '',
    zona_destino: '',
    comision_chofer_porcentaje: '',
    comision_chofer_fija: '',
    activa: true,
  });

  const [conceptFormData, setConceptFormData] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    activo: true,
    orden: 0,
    es_basico: true,
  });

  const [conceptPrices, setConceptPrices] = useState<Record<string, string>>({});

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

  // Fetch conceptos
  const { data: conceptos = [] } = useQuery({
    queryKey: ['tarifa_conceptos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarifa_conceptos')
        .select('*')
        .order('orden');
      if (error) throw error;
      return data as TarifaConcepto[];
    },
  });

  // Fetch precios por concepto para la tarifa seleccionada
  const { data: conceptoPrecios = [] } = useQuery({
    queryKey: ['tarifa_concepto_precios', selectedTarifaForPricing?.id],
    queryFn: async () => {
      if (!selectedTarifaForPricing) return [];
      const { data, error } = await supabase
        .from('tarifa_concepto_precios')
        .select('*, concepto:tarifa_conceptos(*)')
        .eq('tarifa_id', selectedTarifaForPricing.id);
      if (error) throw error;
      return data as TarifaConceptoPrecio[];
    },
    enabled: !!selectedTarifaForPricing,
  });

  // Create/Update tarifa mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const tarifaData = {
        nombre: data.nombre,
        tipo_tarifa: data.tipo_tarifa,
        precio_base: parseFloat(data.precio_base),
        precio_por_kg: data.precio_por_kg ? parseFloat(data.precio_por_kg) : null,
        precio_por_km: data.precio_por_km ? parseFloat(data.precio_por_km) : null,
        precio_por_m3: data.precio_por_m3 ? parseFloat(data.precio_por_m3) : null,
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
        const { error } = await supabase.from('tarifas').insert({
          ...tarifaData,
          tenant_id: profile?.tenant_id,
        });
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

  // Create/Update concepto mutation
  const saveConceptMutation = useMutation({
    mutationFn: async (data: typeof conceptFormData) => {
      const conceptData = {
        nombre: data.nombre,
        codigo: data.codigo.toLowerCase().replace(/\s+/g, '_'),
        descripcion: data.descripcion || null,
        activo: data.activo,
        orden: data.orden,
        es_basico: data.es_basico,
      };

      if (editingConcept) {
        const { error } = await supabase
          .from('tarifa_conceptos')
          .update(conceptData)
          .eq('id', editingConcept.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tarifa_conceptos').insert({
          ...conceptData,
          tenant_id: profile?.tenant_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarifa_conceptos'] });
      toast.success(editingConcept ? 'Concepto actualizado' : 'Concepto creado');
      resetConceptForm();
      setIsConceptDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Delete concepto mutation
  const deleteConceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tarifa_conceptos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarifa_conceptos'] });
      toast.success('Concepto eliminado');
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Save concept prices mutation
  const savePricesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTarifaForPricing) return;

      const operations = Object.entries(conceptPrices).map(async ([conceptoId, monto]) => {
        const montoNum = parseFloat(monto) || 0;
        const existing = conceptoPrecios.find(p => p.concepto_id === conceptoId);

        if (existing) {
          const { error } = await supabase
            .from('tarifa_concepto_precios')
            .update({ monto: montoNum })
            .eq('id', existing.id);
          if (error) throw error;
        } else if (montoNum > 0) {
          const { error } = await supabase
            .from('tarifa_concepto_precios')
            .insert({
              tarifa_id: selectedTarifaForPricing.id,
              concepto_id: conceptoId,
              monto: montoNum,
            });
          if (error) throw error;
        }
      });

      await Promise.all(operations);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarifa_concepto_precios'] });
      toast.success('Precios guardados');
      setIsPricingDialogOpen(false);
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
      tipo_tarifa: 'peso',
      precio_base: '',
      precio_por_kg: '',
      precio_por_km: '',
      precio_por_m3: '',
      zona_origen: '',
      zona_destino: '',
      comision_chofer_porcentaje: '',
      comision_chofer_fija: '',
      activa: true,
    });
    setEditingTarifa(null);
  };

  const resetConceptForm = () => {
    setConceptFormData({
      nombre: '',
      codigo: '',
      descripcion: '',
      activo: true,
      orden: conceptos.length,
      es_basico: true,
    });
    setEditingConcept(null);
  };

  const handleEdit = (tarifa: Tarifa) => {
    setEditingTarifa(tarifa);
    setFormData({
      nombre: tarifa.nombre,
      tipo_tarifa: tarifa.tipo_tarifa || 'peso',
      precio_base: tarifa.precio_base.toString(),
      precio_por_kg: tarifa.precio_por_kg?.toString() || '',
      precio_por_km: tarifa.precio_por_km?.toString() || '',
      precio_por_m3: tarifa.precio_por_m3?.toString() || '',
      zona_origen: tarifa.zona_origen || '',
      zona_destino: tarifa.zona_destino || '',
      comision_chofer_porcentaje: tarifa.comision_chofer_porcentaje?.toString() || '',
      comision_chofer_fija: tarifa.comision_chofer_fija?.toString() || '',
      activa: tarifa.activa ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleEditConcept = (concept: TarifaConcepto) => {
    setEditingConcept(concept);
    setConceptFormData({
      nombre: concept.nombre,
      codigo: concept.codigo,
      descripcion: concept.descripcion || '',
      activo: concept.activo,
      orden: concept.orden,
      es_basico: concept.es_basico ?? true,
    });
    setIsConceptDialogOpen(true);
  };

  const handleOpenPricing = (tarifa: Tarifa) => {
    setSelectedTarifaForPricing(tarifa);
    // Initialize prices from existing data
    const prices: Record<string, string> = {};
    conceptoPrecios.forEach(p => {
      prices[p.concepto_id] = p.monto.toString();
    });
    setConceptPrices(prices);
    setIsPricingDialogOpen(true);
  };

  const handleOpenBranches = (concept: TarifaConcepto) => {
    setSelectedConceptForBranches(concept);
    setIsBranchDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleConceptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveConceptMutation.mutate(conceptFormData);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  // Initialize concept prices when dialog opens
  const initializePrices = () => {
    const prices: Record<string, string> = {};
    conceptos.forEach(c => {
      const existingPrice = conceptoPrecios.find(p => p.concepto_id === c.id);
      prices[c.id] = existingPrice ? existingPrice.monto.toString() : '0';
    });
    setConceptPrices(prices);
  };

  // Get icon for rate type
  const getRateTypeIcon = (type: RateType) => {
    switch (type) {
      case 'peso': return Weight;
      case 'distancia': return Ruler;
      case 'zona': return MapPin;
      case 'codigo_postal': return MapPin;
      case 'volumen': return Box;
      default: return DollarSign;
    }
  };

  // Render dynamic fields based on rate type
  const renderRateTypeFields = () => {
    switch (formData.tipo_tarifa) {
      case 'peso':
        return (
          <div className="space-y-2">
            <Label htmlFor="precio_por_kg">Precio por Kg</Label>
            <Input
              id="precio_por_kg"
              type="number"
              step="0.01"
              value={formData.precio_por_kg}
              onChange={(e) => setFormData({ ...formData, precio_por_kg: e.target.value })}
              placeholder="0.00"
            />
          </div>
        );
      case 'distancia':
        return (
          <div className="space-y-2">
            <Label htmlFor="precio_por_km">Precio por Km</Label>
            <Input
              id="precio_por_km"
              type="number"
              step="0.01"
              value={formData.precio_por_km}
              onChange={(e) => setFormData({ ...formData, precio_por_km: e.target.value })}
              placeholder="0.00"
            />
          </div>
        );
      case 'volumen':
        return (
          <div className="space-y-2">
            <Label htmlFor="precio_por_m3">Precio por m³</Label>
            <Input
              id="precio_por_m3"
              type="number"
              step="0.01"
              value={formData.precio_por_m3}
              onChange={(e) => setFormData({ ...formData, precio_por_m3: e.target.value })}
              placeholder="0.00"
            />
          </div>
        );
      case 'zona':
      case 'codigo_postal':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zona_origen">
                {formData.tipo_tarifa === 'codigo_postal' ? 'CP Origen' : 'Zona Origen'}
              </Label>
              <Input
                id="zona_origen"
                value={formData.zona_origen}
                onChange={(e) => setFormData({ ...formData, zona_origen: e.target.value })}
                placeholder={formData.tipo_tarifa === 'codigo_postal' ? 'Ej: 1000' : 'Ej: Capital'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zona_destino">
                {formData.tipo_tarifa === 'codigo_postal' ? 'CP Destino' : 'Zona Destino'}
              </Label>
              <Input
                id="zona_destino"
                value={formData.zona_destino}
                onChange={(e) => setFormData({ ...formData, zona_destino: e.target.value })}
                placeholder={formData.tipo_tarifa === 'codigo_postal' ? 'Ej: 1900' : 'Ej: GBA'}
              />
            </div>
          </div>
        );
      default:
        return null;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tarifas</h1>
          <p className="text-muted-foreground">
            Configura las tarifas de envío y conceptos
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tarifas">
            <DollarSign className="h-4 w-4 mr-2" />
            Tarifas
          </TabsTrigger>
          <TabsTrigger value="conceptos">
            <Layers className="h-4 w-4 mr-2" />
            Conceptos
          </TabsTrigger>
        </TabsList>

        {/* Tarifas Tab */}
        <TabsContent value="tarifas" className="space-y-6">
          <div className="flex justify-end">
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
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTarifa ? 'Editar Tarifa' : 'Nueva Tarifa'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Rate Type Selector */}
                  <RateTypeSelector
                    value={formData.tipo_tarifa}
                    onChange={(value) => setFormData({ ...formData, tipo_tarifa: value })}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre de la Tarifa *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Ej: Envío Local, Express, etc."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="precio_base">Precio Base *</Label>
                    <Input
                      id="precio_base"
                      type="number"
                      step="0.01"
                      value={formData.precio_base}
                      onChange={(e) => setFormData({ ...formData, precio_base: e.target.value })}
                      required
                    />
                  </div>

                  {/* Dynamic fields based on rate type */}
                  {renderRateTypeFields()}

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-3">Comisión Chofer</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="comision_chofer_porcentaje">Porcentaje %</Label>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <Layers className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conceptos Básicos</p>
                  <p className="text-2xl font-bold">
                    {conceptos.filter((c) => c.activo && c.es_basico).length}
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
                  <p className="text-sm text-muted-foreground">Conceptos Adicionales</p>
                  <p className="text-2xl font-bold">
                    {conceptos.filter((c) => c.activo && !c.es_basico).length}
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
              {tarifas.map((tarifa) => {
                const TypeIcon = getRateTypeIcon(tarifa.tipo_tarifa);
                return (
                  <Card
                    key={tarifa.id}
                    className={`glass card-hover ${!tarifa.activa ? 'opacity-60' : ''}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{tarifa.nombre}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              <TypeIcon className="h-3 w-3 mr-1" />
                              {getRateTypeLabel(tarifa.tipo_tarifa)}
                            </Badge>
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
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedTarifaForPricing(tarifa);
                              initializePrices();
                              setIsPricingDialogOpen(true);
                            }}
                            title="Configurar precios por concepto"
                          >
                            <Layers className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(tarifa)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
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
                            <span>{formatCurrency(tarifa.precio_por_kg)} por kg</span>
                          </div>
                        )}
                        {tarifa.precio_por_km && (
                          <div className="flex items-center gap-2">
                            <Ruler className="h-4 w-4 text-muted-foreground" />
                            <span>{formatCurrency(tarifa.precio_por_km)} por km</span>
                          </div>
                        )}
                        {tarifa.precio_por_m3 && (
                          <div className="flex items-center gap-2">
                            <Box className="h-4 w-4 text-muted-foreground" />
                            <span>{formatCurrency(tarifa.precio_por_m3)} por m³</span>
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

                      {(tarifa.comision_chofer_porcentaje || tarifa.comision_chofer_fija) && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-chofer" />
                            <span className="text-muted-foreground">Comisión chofer:</span>
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
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Conceptos Tab */}
        <TabsContent value="conceptos" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-muted-foreground">
                Define los conceptos que componen las tarifas.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Los conceptos <strong>básicos</strong> están disponibles para todas las sucursales.
                Los <strong>adicionales</strong> se habilitan por sucursal.
              </p>
            </div>
            <Dialog
              open={isConceptDialogOpen}
              onOpenChange={(open) => {
                setIsConceptDialogOpen(open);
                if (!open) resetConceptForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-tarifas hover:bg-tarifas/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Concepto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingConcept ? 'Editar Concepto' : 'Nuevo Concepto'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleConceptSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="concept_nombre">Nombre *</Label>
                    <Input
                      id="concept_nombre"
                      value={conceptFormData.nombre}
                      onChange={(e) =>
                        setConceptFormData({ ...conceptFormData, nombre: e.target.value })
                      }
                      placeholder="Ej: Flete, Seguro, Embalaje"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="concept_codigo">Código *</Label>
                    <Input
                      id="concept_codigo"
                      value={conceptFormData.codigo}
                      onChange={(e) =>
                        setConceptFormData({ ...conceptFormData, codigo: e.target.value })
                      }
                      placeholder="Ej: flete, seguro, embalaje"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="concept_descripcion">Descripción</Label>
                    <Input
                      id="concept_descripcion"
                      value={conceptFormData.descripcion}
                      onChange={(e) =>
                        setConceptFormData({ ...conceptFormData, descripcion: e.target.value })
                      }
                      placeholder="Descripción del concepto"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="concept_orden">Orden</Label>
                      <Input
                        id="concept_orden"
                        type="number"
                        value={conceptFormData.orden}
                        onChange={(e) =>
                          setConceptFormData({
                            ...conceptFormData,
                            orden: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between pt-6">
                      <Label htmlFor="concept_activo">Activo</Label>
                      <Switch
                        id="concept_activo"
                        checked={conceptFormData.activo}
                        onCheckedChange={(checked) =>
                          setConceptFormData({ ...conceptFormData, activo: checked })
                        }
                      />
                    </div>
                  </div>

                  {/* Basic/Additional toggle */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="concept_basico">Concepto Básico</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {conceptFormData.es_basico 
                            ? 'Disponible para todas las sucursales' 
                            : 'Requiere habilitación por sucursal'}
                        </p>
                      </div>
                      <Switch
                        id="concept_basico"
                        checked={conceptFormData.es_basico}
                        onCheckedChange={(checked) =>
                          setConceptFormData({ ...conceptFormData, es_basico: checked })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetConceptForm();
                        setIsConceptDialogOpen(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={saveConceptMutation.isPending}
                      className="bg-tarifas hover:bg-tarifas/90"
                    >
                      {saveConceptMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="glass">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conceptos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No hay conceptos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    conceptos.map((concepto) => (
                      <TableRow key={concepto.id}>
                        <TableCell>{concepto.orden}</TableCell>
                        <TableCell className="font-medium">{concepto.nombre}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {concepto.codigo}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={concepto.es_basico ? 'default' : 'outline'}
                            className={concepto.es_basico ? 'bg-primary/10 text-primary' : 'border-warning text-warning'}
                          >
                            {concepto.es_basico ? 'Básico' : 'Adicional'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {concepto.descripcion || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={concepto.activo ? 'default' : 'secondary'}
                            className={concepto.activo ? 'bg-success/10 text-success' : ''}
                          >
                            {concepto.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!concepto.es_basico && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenBranches(concepto)}
                                title="Gestionar sucursales"
                              >
                                <Building2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditConcept(concepto)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('¿Eliminar este concepto?')) {
                                  deleteConceptMutation.mutate(concepto.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para asignar precios por concepto a una tarifa */}
      <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Precios por Concepto - {selectedTarifaForPricing?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Asigna un monto a cada concepto para esta tarifa.
            </p>
            {conceptos.filter(c => c.activo).map((concepto) => (
              <div key={concepto.id} className="flex items-center gap-4">
                <div className="w-32 flex items-center gap-2">
                  <Label>{concepto.nombre}</Label>
                  {!concepto.es_basico && (
                    <Badge variant="outline" className="text-xs border-warning text-warning">
                      +
                    </Badge>
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={conceptPrices[concepto.id] || '0'}
                    onChange={(e) =>
                      setConceptPrices({
                        ...conceptPrices,
                        [concepto.id]: e.target.value,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
            ))}
            <div className="border-t pt-4">
              <div className="flex justify-between font-medium">
                <span>Total por Conceptos:</span>
                <span className="text-tarifas">
                  {formatCurrency(
                    Object.values(conceptPrices).reduce(
                      (sum, val) => sum + (parseFloat(val) || 0),
                      0
                    )
                  )}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsPricingDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => savePricesMutation.mutate()}
                disabled={savePricesMutation.isPending}
                className="bg-tarifas hover:bg-tarifas/90"
              >
                {savePricesMutation.isPending ? 'Guardando...' : 'Guardar Precios'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para gestionar sucursales de un concepto adicional */}
      {selectedConceptForBranches && (
        <ConceptBranchesDialog
          open={isBranchDialogOpen}
          onOpenChange={setIsBranchDialogOpen}
          conceptId={selectedConceptForBranches.id}
          conceptName={selectedConceptForBranches.nombre}
        />
      )}
    </div>
  );
}
