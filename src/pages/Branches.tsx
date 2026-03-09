import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { BranchCoverageZonesDialog } from '@/components/branches/BranchCoverageZonesDialog';
import { useTenant } from '@/hooks/useTenant';
import { useFormDraft } from '@/hooks/useFormDraft';
import { DraftIndicator, DraftSavingIndicator } from '@/components/ui/draft-indicator';
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
  Globe,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  Loader2,
} from 'lucide-react';

import { AddressAutocomplete, type AddressDetails } from '@/components/maps/AddressAutocomplete';

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
  lat: number | null;
  lng: number | null;
  // Configuración fiscal y liquidación
  incluye_iva: boolean | null;
  porcentaje_iva: number | null;
  tipo_liquidacion: string | null;
  tenant_id: string | null;
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
  base_comision: string;
  tipo_rol: string;
}

type CommissionValues = {
  contado: string;
  destino: string;
  cta_cte: string;
  base: string;
};

export default function Branches() {
  const { isAdmin } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCommissionsDialogOpen, setIsCommissionsDialogOpen] = useState(false);
  const [editingSucursal, setEditingSucursal] = useState<Sucursal | null>(null);
  const [selectedSucursalForCommissions, setSelectedSucursalForCommissions] = useState<Sucursal | null>(null);
  const [coverageZonesSucursal, setCoverageZonesSucursal] = useState<Sucursal | null>(null);
  
  const defaultFormData = {
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
    lat: null as number | null,
    lng: null as number | null,
    // Configuración fiscal y liquidación
    incluye_iva: false,
    porcentaje_iva: 21,
    tipo_liquidacion: 'diferida',
  };

  // Form draft persistence
  const {
    formData,
    setFormData,
    clearDraft,
    discardDraft,
    isDraftRecovered,
    setIsDraftRecovered,
    lastSaved,
    hasDraft,
  } = useFormDraft('new-sucursal', defaultFormData);

  // Tab activa para el diálogo de comisiones
  const [commissionTab, setCommissionTab] = useState<'emision' | 'recepcion'>('emision');
  // Datos separados para emisión y recepción
  const [emisionCommissionData, setEmisionCommissionData] = useState<Record<string, CommissionValues>>({});
  const [recepcionCommissionData, setRecepcionCommissionData] = useState<Record<string, CommissionValues>>({});

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
    refetchOnWindowFocus: false,
  });

  // Get centros logísticos for dropdown
  const centrosLogisticos = sucursales.filter(s => s.es_centro_logistico);

  // Derive tenant from selected branch (for super admins) or user's tenant
  const effectiveTenantId = selectedSucursalForCommissions?.tenant_id || tenantId;

  // Fetch conceptos
  const { data: conceptos = [] } = useQuery({
    queryKey: ['tarifa_conceptos', effectiveTenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarifa_conceptos')
        .select('*')
        .eq('activo', true)
        .eq('tenant_id', effectiveTenantId!)
        .order('orden');
      if (error) throw error;
      return data as TarifaConcepto[];
    },
    enabled: !!effectiveTenantId,
    refetchOnWindowFocus: false,
  });

  // Fetch comisiones para la sucursal seleccionada (incluye tipo_rol)
  const { data: sucursalComisiones = [] } = useQuery({
    queryKey: ['sucursal_comisiones', selectedSucursalForCommissions?.id],
    queryFn: async () => {
      if (!selectedSucursalForCommissions) return [];
      const { data, error } = await supabase
        .from('sucursal_comisiones')
        .select('*')
        .eq('sucursal_id', selectedSucursalForCommissions.id);
      if (error) throw error;
      return (data || []) as SucursalComision[];
    },
    enabled: !!selectedSucursalForCommissions,
    refetchOnWindowFocus: false,
  });

  // Conceptos a mostrar (excluir recepcion y cobros) - memoizado para evitar re-renders
  const conceptosFiltrados = useMemo(() => 
    conceptos.filter(c => !['recepcion', 'cobros'].includes(c.codigo)),
    [conceptos]
  );

  // Initialize commission data when dialog opens - separado por tipo_rol
  useEffect(() => {
    if (selectedSucursalForCommissions && conceptosFiltrados.length > 0) {
      // Inicializar datos de EMISIÓN
      const emisionData: Record<string, CommissionValues> = {};
      conceptosFiltrados.forEach((concepto) => {
        const existing = sucursalComisiones.find(
          (c) => c.concepto_id === concepto.id && c.tipo_rol === 'emision'
        );
        emisionData[concepto.id] = {
          contado: existing?.porcentaje_contado?.toString() || '0',
          destino: existing?.porcentaje_destino?.toString() || '0',
          cta_cte: existing?.porcentaje_cta_cte?.toString() || '0',
          base: existing?.base_comision || 'total',
        };
      });
      setEmisionCommissionData(emisionData);

      // Inicializar datos de RECEPCIÓN
      const recepcionData: Record<string, CommissionValues> = {};
      conceptosFiltrados.forEach((concepto) => {
        const existing = sucursalComisiones.find(
          (c) => c.concepto_id === concepto.id && c.tipo_rol === 'recepcion'
        );
        recepcionData[concepto.id] = {
          contado: existing?.porcentaje_contado?.toString() || '0',
          destino: existing?.porcentaje_destino?.toString() || '0',
          cta_cte: existing?.porcentaje_cta_cte?.toString() || '0',
          base: existing?.base_comision || 'total',
        };
      });
      setRecepcionCommissionData(recepcionData);
    }
  }, [selectedSucursalForCommissions, conceptosFiltrados, sucursalComisiones]);

  // Create/Update sucursal mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Guard: tenant_id is required for creating branches
      if (!editingSucursal && !tenantId) {
        throw new Error('No se encontró tu empresa. Por favor, recarga la página.');
      }

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
        lat: data.lat,
        lng: data.lng,
        // Configuración fiscal
        incluye_iva: data.incluye_iva,
        porcentaje_iva: data.porcentaje_iva,
        tipo_liquidacion: data.tipo_liquidacion,
      };

      if (editingSucursal) {
        const { error } = await supabase
          .from('sucursales')
          .update(sucursalData)
          .eq('id', editingSucursal.id);
        if (error) throw error;
      } else {
        // Include tenant_id when creating a new branch
        const { error } = await supabase.from('sucursales').insert({
          ...sucursalData,
          tenant_id: tenantId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursales-full'] });
      queryClient.invalidateQueries({ queryKey: ['sucursales'] });
      toast.success(editingSucursal ? 'Sucursal actualizada' : 'Sucursal creada');
      if (!editingSucursal) {
        clearDraft();
      }
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  // Helper function to save a single commission using upsert for concurrency safety
  const saveCommission = async (
    conceptoId: string,
    values: CommissionValues,
    tipoRol: 'emision' | 'recepcion'
  ) => {
    if (!selectedSucursalForCommissions) return;
    
    const data = {
      sucursal_id: selectedSucursalForCommissions.id,
      concepto_id: conceptoId,
      porcentaje_contado: parseFloat(values.contado) || 0,
      porcentaje_destino: parseFloat(values.destino) || 0,
      porcentaje_cta_cte: parseFloat(values.cta_cte) || 0,
      base_comision: values.base || 'total',
      tipo_rol: tipoRol,
    };

    // Usar upsert nativo para manejar concurrencia correctamente
    const { error } = await supabase
      .from('sucursal_comisiones')
      .upsert(data, { 
        onConflict: 'sucursal_id,concepto_id,tipo_rol',
        ignoreDuplicates: false 
      });
    
    if (error) throw error;
  };

  // Save commissions mutation - guarda ambos roles (emisión y recepción)
  const saveCommissionsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSucursalForCommissions) return;

      const operations: Promise<void>[] = [];

      // Guardar comisiones de EMISIÓN
      Object.entries(emisionCommissionData).forEach(([conceptoId, values]) => {
        operations.push(saveCommission(conceptoId, values, 'emision'));
      });

      // Guardar comisiones de RECEPCIÓN
      Object.entries(recepcionCommissionData).forEach(([conceptoId, values]) => {
        operations.push(saveCommission(conceptoId, values, 'recepcion'));
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

  // State for geocoding
  const [geocodingId, setGeocodingId] = useState<string | null>(null);
  const [geocodingAll, setGeocodingAll] = useState(false);

  // Geocode a single branch
  const geocodeBranch = async (sucursal: Sucursal) => {
    try {
      setGeocodingId(sucursal.id);
      
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: {
          address: sucursal.direccion,
          city: sucursal.ciudad,
          country: 'Argentina'
        }
      });
      
      if (error) throw error;
      
      if (data?.lat && data?.lng) {
        const { error: updateError } = await supabase
          .from('sucursales')
          .update({ 
            lat: data.lat, 
            lng: data.lng,
            ciudad: data.city || sucursal.ciudad
          })
          .eq('id', sucursal.id);
        
        if (updateError) throw updateError;
        
        queryClient.invalidateQueries({ queryKey: ['sucursales-full'] });
        queryClient.invalidateQueries({ queryKey: ['sucursales'] });
        toast.success(`${sucursal.nombre} geolocalizada correctamente`);
      } else {
        toast.error('No se encontraron coordenadas para esta dirección');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Error al geolocalizar: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setGeocodingId(null);
    }
  };

  // Geocode all branches without coordinates
  const geocodeAllBranches = async () => {
    const branchesWithoutCoords = sucursales.filter(s => !s.lat || !s.lng);
    
    if (branchesWithoutCoords.length === 0) {
      toast.info('Todas las sucursales ya tienen coordenadas');
      return;
    }
    
    setGeocodingAll(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const sucursal of branchesWithoutCoords) {
      try {
        const { data, error } = await supabase.functions.invoke('geocode-address', {
          body: {
            address: sucursal.direccion,
            city: sucursal.ciudad,
            country: 'Argentina'
          }
        });
        
        if (error) throw error;
        
        if (data?.lat && data?.lng) {
          const { error: updateError } = await supabase
            .from('sucursales')
            .update({ 
              lat: data.lat, 
              lng: data.lng,
              ciudad: data.city || sucursal.ciudad
            })
            .eq('id', sucursal.id);
          
          if (updateError) throw updateError;
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error geocoding ${sucursal.nombre}:`, error);
        errorCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    queryClient.invalidateQueries({ queryKey: ['sucursales-full'] });
    queryClient.invalidateQueries({ queryKey: ['sucursales'] });
    
    if (successCount > 0) {
      toast.success(`${successCount} sucursales geolocalizadas`);
    }
    if (errorCount > 0) {
      toast.warning(`${errorCount} sucursales no pudieron ser geolocalizadas`);
    }
    
    setGeocodingAll(false);
  };

  // Count branches without coordinates
  const branchesWithoutCoords = sucursales.filter(s => !s.lat || !s.lng).length;

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingSucursal(null);
  };

  const handleEdit = (sucursal: Sucursal) => {
    discardDraft(); // Clear draft when editing existing
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
      lat: sucursal.lat || null,
      lng: sucursal.lng || null,
      // Configuración fiscal
      incluye_iva: sucursal.incluye_iva ?? false,
      porcentaje_iva: sucursal.porcentaje_iva ?? 21,
      tipo_liquidacion: sucursal.tipo_liquidacion || 'diferida',
    });
    setIsDialogOpen(true);
  };

  const handleAddressSelect = (details: AddressDetails) => {
    setFormData(prev => ({
      ...prev,
      direccion: details.formattedAddress || details.address,
      ciudad: details.city || prev.ciudad,
      lat: details.lat,
      lng: details.lng,
    }));
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
          {branchesWithoutCoords > 0 && (
            <Button
              variant="outline"
              onClick={geocodeAllBranches}
              disabled={geocodingAll}
            >
              {geocodingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Geolocalizando...
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4 mr-2" />
                  Geolocalizar todas ({branchesWithoutCoords})
                </>
              )}
            </Button>
          )}
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

              {/* Draft indicator */}
              {!editingSucursal && isDraftRecovered && (
                <DraftIndicator
                  lastSaved={lastSaved}
                  onDiscard={discardDraft}
                  onDismiss={() => setIsDraftRecovered(false)}
                  className="mb-2"
                />
              )}

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
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input
                      id="ciudad"
                      value={formData.ciudad}
                      onChange={(e) =>
                        setFormData({ ...formData, ciudad: e.target.value })
                      }
                      placeholder="Se completa automáticamente"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <AddressAutocomplete
                      id="direccion"
                      label="Dirección"
                      value={formData.direccion}
                      onChange={(value) => setFormData({ ...formData, direccion: value })}
                      onSelect={handleAddressSelect}
                      placeholder="Buscar dirección..."
                      required
                    />
                    {formData.lat && formData.lng ? (
                      <div className="flex items-center gap-2 text-xs text-success">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Geolocalizado: {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Seleccione una dirección del autocompletado para geolocalizar</span>
                      </div>
                    )}
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

              {/* Configuración Fiscal y Liquidación */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Configuración Fiscal y Comisiones
                </h3>
                
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="font-medium">Incluye IVA en Comisiones</Label>
                    <p className="text-sm text-muted-foreground">
                      Las comisiones incluirán el porcentaje de IVA configurado
                    </p>
                  </div>
                  <Switch
                    checked={formData.incluye_iva}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, incluye_iva: checked })
                    }
                  />
                </div>

                {formData.incluye_iva && (
                  <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                    <Label htmlFor="porcentaje_iva">Porcentaje IVA (%)</Label>
                    <Input
                      id="porcentaje_iva"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.porcentaje_iva}
                      onChange={(e) =>
                        setFormData({ ...formData, porcentaje_iva: parseFloat(e.target.value) || 21 })
                      }
                      className="w-32"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Tipo de Liquidación</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.tipo_liquidacion === 'inmediata'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                      onClick={() => setFormData({ ...formData, tipo_liquidacion: 'inmediata' })}
                    >
                      <div className="font-medium text-sm">Inmediata</div>
                      <p className="text-xs text-muted-foreground">Al entregar el envío</p>
                    </div>
                    <div
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        formData.tipo_liquidacion === 'diferida'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                      onClick={() => setFormData({ ...formData, tipo_liquidacion: 'diferida' })}
                    >
                      <div className="font-medium text-sm">Diferida</div>
                      <p className="text-xs text-muted-foreground">Al final del período</p>
                    </div>
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

              <div className="flex items-center justify-between">
                {!editingSucursal && <DraftSavingIndicator hasDraft={hasDraft} lastSaved={lastSaved} />}
                <div className="flex gap-2 ml-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (editingSucursal) resetForm();
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
                      onClick={() => setCoverageZonesSucursal(sucursal)}
                      title="Zonas de cobertura"
                    >
                      <Globe className="h-4 w-4" />
                    </Button>
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
                    <div className="flex-1">
                      <span>{sucursal.direccion}</span>
                      {sucursal.lat && sucursal.lng ? (
                        <div className="flex items-center gap-1 text-xs text-success mt-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Geolocalizada</span>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-warning hover:text-warning mt-1"
                          onClick={() => geocodeBranch(sucursal)}
                          disabled={geocodingId === sucursal.id}
                        >
                          {geocodingId === sucursal.id ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Geolocalizando...
                            </>
                          ) : (
                            <>
                              <Navigation className="h-3 w-3 mr-1" />
                              Geolocalizar
                            </>
                          )}
                        </Button>
                      )}
                    </div>
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

      {/* Dialog para configurar comisiones con tabs Emisión/Recepción */}
      <Dialog open={isCommissionsDialogOpen} onOpenChange={setIsCommissionsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Comisiones - {selectedSucursalForCommissions?.nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {conceptosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay conceptos configurados. Ve a Tarifas → Conceptos para crearlos.
              </div>
            ) : (
              <Tabs value={commissionTab} onValueChange={(v) => setCommissionTab(v as 'emision' | 'recepcion')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="emision" className="flex items-center gap-2">
                    <ArrowUpFromLine className="h-4 w-4" />
                    Emisión
                  </TabsTrigger>
                  <TabsTrigger value="recepcion" className="flex items-center gap-2">
                    <ArrowDownToLine className="h-4 w-4" />
                    Recepción
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="emision" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Comisiones cuando esta sucursal <strong>DESPACHA</strong> envíos hacia otras sucursales.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Concepto</TableHead>
                        <TableHead className="text-center">% Contado</TableHead>
                        <TableHead className="text-center">% Destino</TableHead>
                        <TableHead className="text-center">% Cta. Cte.</TableHead>
                        <TableHead className="text-center">Base</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conceptosFiltrados.map((concepto) => (
                        <TableRow key={concepto.id}>
                          <TableCell className="font-medium">{concepto.nombre}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={emisionCommissionData[concepto.id]?.contado || '0'}
                              onChange={(e) =>
                                setEmisionCommissionData({
                                  ...emisionCommissionData,
                                  [concepto.id]: {
                                    ...emisionCommissionData[concepto.id],
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
                              value={emisionCommissionData[concepto.id]?.destino || '0'}
                              onChange={(e) =>
                                setEmisionCommissionData({
                                  ...emisionCommissionData,
                                  [concepto.id]: {
                                    ...emisionCommissionData[concepto.id],
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
                              value={emisionCommissionData[concepto.id]?.cta_cte || '0'}
                              onChange={(e) =>
                                setEmisionCommissionData({
                                  ...emisionCommissionData,
                                  [concepto.id]: {
                                    ...emisionCommissionData[concepto.id],
                                    cta_cte: e.target.value,
                                  },
                                })
                              }
                              className="w-20 text-center"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={emisionCommissionData[concepto.id]?.base || 'total'}
                              onValueChange={(value) =>
                                setEmisionCommissionData({
                                  ...emisionCommissionData,
                                  [concepto.id]: {
                                    ...emisionCommissionData[concepto.id],
                                    base: value,
                                  },
                                })
                              }
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="flete">Flete</SelectItem>
                                <SelectItem value="neto">Neto</SelectItem>
                                <SelectItem value="total">Total</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="recepcion" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Comisiones cuando esta sucursal <strong>RECIBE</strong> envíos de otras sucursales.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Concepto</TableHead>
                        <TableHead className="text-center">% Contado</TableHead>
                        <TableHead className="text-center">% Destino</TableHead>
                        <TableHead className="text-center">% Cta. Cte.</TableHead>
                        <TableHead className="text-center">Base</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conceptosFiltrados.map((concepto) => (
                        <TableRow key={concepto.id}>
                          <TableCell className="font-medium">{concepto.nombre}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={recepcionCommissionData[concepto.id]?.contado || '0'}
                              onChange={(e) =>
                                setRecepcionCommissionData({
                                  ...recepcionCommissionData,
                                  [concepto.id]: {
                                    ...recepcionCommissionData[concepto.id],
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
                              value={recepcionCommissionData[concepto.id]?.destino || '0'}
                              onChange={(e) =>
                                setRecepcionCommissionData({
                                  ...recepcionCommissionData,
                                  [concepto.id]: {
                                    ...recepcionCommissionData[concepto.id],
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
                              value={recepcionCommissionData[concepto.id]?.cta_cte || '0'}
                              onChange={(e) =>
                                setRecepcionCommissionData({
                                  ...recepcionCommissionData,
                                  [concepto.id]: {
                                    ...recepcionCommissionData[concepto.id],
                                    cta_cte: e.target.value,
                                  },
                                })
                              }
                              className="w-20 text-center"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={recepcionCommissionData[concepto.id]?.base || 'total'}
                              onValueChange={(value) =>
                                setRecepcionCommissionData({
                                  ...recepcionCommissionData,
                                  [concepto.id]: {
                                    ...recepcionCommissionData[concepto.id],
                                    base: value,
                                  },
                                })
                              }
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="flete">Flete</SelectItem>
                                <SelectItem value="neto">Neto</SelectItem>
                                <SelectItem value="total">Total</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCommissionsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveCommissionsMutation.mutate()}
                disabled={saveCommissionsMutation.isPending || conceptosFiltrados.length === 0}
                className="bg-sucursales hover:bg-sucursales/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveCommissionsMutation.isPending ? 'Guardando...' : 'Guardar Comisiones'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coverage Zones Dialog */}
      {coverageZonesSucursal && (
        <BranchCoverageZonesDialog
          open={!!coverageZonesSucursal}
          onOpenChange={(open) => !open && setCoverageZonesSucursal(null)}
          sucursalId={coverageZonesSucursal.id}
          sucursalNombre={coverageZonesSucursal.nombre}
          sucursalLat={coverageZonesSucursal.lat}
          sucursalLng={coverageZonesSucursal.lng}
          allSucursales={sucursales.map(s => ({ id: s.id, nombre: s.nombre, codigo: s.codigo }))}
        />
      )}
    </div>
  );
}