import { useState } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  TrendingUp,
  Shield,
  Package,
} from 'lucide-react';
import { 
  RateTypeSelector, 
  getRateTypeLabel, 
  ConceptBranchesDialog,
  TarifaBranchesDialog,
  InsuranceConfigDialog,
  BulkRateUpdateDialog,
  WeightRangesEditor,
  CreateTarifaWizard,
} from '@/components/rates';
import type { RateType, WeightRange } from '@/components/rates';

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
  rangos_precios: {
    peso_base_hasta?: number;
    adicional_por_kg?: number;
    volumen_base_hasta?: number;
    adicional_por_m3?: number;
  } | null;
  rangos_kg: WeightRange[] | null;
  umbral_volumen_cm: number | null;
  multiplicar_flete_por_bultos: boolean | null;
  created_at: string | null;
  tenant_id: string | null;
  created_by: string | null;
  tenant?: {
    id: string;
    nombre: string;
  } | null;
  creador?: {
    id: string;
    nombre: string;
    apellido: string | null;
  } | null;
}

interface TarifaConcepto {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  orden: number;
  es_basico: boolean;
  monto_editable?: boolean;
  tenant_id?: string | null;
  tenant?: { id: string; nombre: string } | null;
}

interface TarifaConceptoPrecio {
  id: string;
  tarifa_id: string;
  concepto_id: string;
  monto: number;
  es_porcentaje?: boolean | null;
  porcentaje?: number | null;
  multiplicar_por_bultos?: boolean | null;
  concepto?: TarifaConcepto;
}

export default function Rates() {
  const { isAdmin, isSuperAdmin, profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = usePersistedState('ui-tab-rates', 'tarifas');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConceptDialogOpen, setIsConceptDialogOpen] = useState(false);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [isTarifaBranchDialogOpen, setIsTarifaBranchDialogOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [isInsuranceOpen, setIsInsuranceOpen] = useState(false);
  const [editingTarifa, setEditingTarifa] = useState<Tarifa | null>(null);
  const [editingConcept, setEditingConcept] = useState<TarifaConcepto | null>(null);
  const [selectedTarifaForPricing, setSelectedTarifaForPricing] = useState<Tarifa | null>(null);
  const [selectedConceptForBranches, setSelectedConceptForBranches] = useState<TarifaConcepto | null>(null);
  const [selectedTarifaForBranches, setSelectedTarifaForBranches] = useState<Tarifa | null>(null);
  
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
    // Rangos para peso/volumen
    peso_base_hasta: '',
    adicional_por_kg: '',
    volumen_base_hasta: '',
    adicional_por_m3: '',
    // Rangos de peso escalonados
    rangos_kg: [] as WeightRange[],
    umbral_volumen_cm: 50,
    multiplicar_flete_por_bultos: false,
    // Conceptos inline
    conceptos: {} as Record<string, { monto: string; es_porcentaje: boolean; porcentaje: string; multiplicar_por_bultos: boolean }>,
    express_surcharge: '',
  });

  const [conceptFormData, setConceptFormData] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    activo: true,
    orden: 0,
    es_basico: true,
    monto_editable: false,
  });

  const [conceptPrices, setConceptPrices] = useState<Record<string, { monto: string; es_porcentaje: boolean; porcentaje: string; multiplicar_por_bultos: boolean }>>({});

  // Fetch tarifas with tenant and creator info for super admins
  const { data: tarifas = [], isLoading } = useQuery({
    queryKey: ['tarifas'],
    queryFn: async () => {
      // Build query based on super admin status
      let query = supabase
        .from('tarifas')
        .select('*, tenant:tenants(id, nombre)')
        .order('nombre');
        
      const { data, error } = await query;
      if (error) throw error;
      
      // For super admins, fetch creator info separately
      const tarifasWithCreator = await Promise.all(
        (data || []).map(async (t) => {
          let creador = null;
          if (t.created_by) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, nombre, apellido')
              .eq('user_id', t.created_by)
              .maybeSingle();
            creador = profileData;
          }
          return {
            ...t,
            rangos_kg: Array.isArray(t.rangos_kg) ? (t.rangos_kg as unknown as WeightRange[]) : [],
            creador,
          };
        })
      );
      
      return tarifasWithCreator as Tarifa[];
    },
  });

  // Fetch conceptos (filtered by tenant, super admin sees all)
  const userTenantId = (profile as any)?.tenant_id;
  const [conceptoTenantFilter, setConceptoTenantFilter] = useState<string>('all');
  const { data: conceptos = [] } = useQuery({
    queryKey: ['tarifa_conceptos', userTenantId, isSuperAdmin(), conceptoTenantFilter],
    queryFn: async () => {
      let query = supabase
        .from('tarifa_conceptos')
        .select('*, tenant:tenants(id, nombre)')
        .order('orden');
      
      if (!isSuperAdmin() && userTenantId) {
        query = query.or(`tenant_id.eq.${userTenantId},tenant_id.is.null`);
      } else if (isSuperAdmin() && conceptoTenantFilter !== 'all') {
        if (conceptoTenantFilter === 'global') {
          query = query.is('tenant_id', null);
        } else {
          query = query.eq('tenant_id', conceptoTenantFilter);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as TarifaConcepto[];
    },
  });

  // Fetch tenants list for super admin filter
  const { data: allTenants = [] } = useQuery({
    queryKey: ['tenants-list-for-concepts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin(),
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
      // Build rangos_precios based on type
      let rangosPrecios: any = {};
      if (data.tipo_tarifa === 'peso') {
        rangosPrecios = {
          peso_base_hasta: parseFloat(data.peso_base_hasta) || 0,
          adicional_por_kg: parseFloat(data.adicional_por_kg) || 0,
        };
      } else if (data.tipo_tarifa === 'volumen') {
        rangosPrecios = {
          volumen_base_hasta: parseFloat(data.volumen_base_hasta) || 0,
          adicional_por_m3: parseFloat(data.adicional_por_m3) || 0,
        };
      }

      const tarifaData: Record<string, unknown> = {
        nombre: data.nombre,
        tipo_tarifa: data.tipo_tarifa,
        precio_base: parseFloat(data.precio_base),
        precio_por_kg: data.precio_por_kg ? parseFloat(data.precio_por_kg) : null,
        precio_por_km: data.precio_por_km ? parseFloat(data.precio_por_km) : null,
        precio_por_m3: data.precio_por_m3 ? parseFloat(data.precio_por_m3) : null,
        zona_origen: data.zona_origen || null,
        zona_destino: data.zona_destino || null,
        rangos_precios: rangosPrecios,
        rangos_kg: data.rangos_kg.length > 0 ? data.rangos_kg : null,
        umbral_volumen_cm: data.umbral_volumen_cm || 50,
        multiplicar_flete_por_bultos: data.multiplicar_flete_por_bultos,
        comision_chofer_porcentaje: data.comision_chofer_porcentaje
          ? parseFloat(data.comision_chofer_porcentaje)
          : null,
        comision_chofer_fija: data.comision_chofer_fija
          ? parseFloat(data.comision_chofer_fija)
          : null,
        activa: data.activa,
        express_surcharge: parseFloat(data.express_surcharge || '0') || 0,
      };

      let tarifaId = editingTarifa?.id;

      if (editingTarifa) {
        const { error } = await supabase
          .from('tarifas')
          .update(tarifaData as any)
          .eq('id', editingTarifa.id);
        if (error) throw error;
      } else {
        const { data: newTarifa, error } = await supabase.from('tarifas').insert({
          ...tarifaData,
          tenant_id: profile?.tenant_id,
          created_by: user?.id,
        } as any).select('id').single();
        if (error) throw error;
        tarifaId = newTarifa.id;
      }

      // Save concept prices (upsert)
      const conceptOperations = Object.entries(data.conceptos)
        .filter(([_, val]) => (val.es_porcentaje && parseFloat(val.porcentaje) >= 0) || (!val.es_porcentaje && parseFloat(val.monto) >= 0))
        .map(async ([conceptoId, val]) => {
          const montoNum = parseFloat(val.monto) || 0;
          const porcentajeNum = parseFloat(val.porcentaje) || null;

          const { data: existing } = await supabase
            .from('tarifa_concepto_precios')
            .select('id')
            .eq('tarifa_id', tarifaId!)
            .eq('concepto_id', conceptoId)
            .maybeSingle();

          if (existing) {
            return supabase
              .from('tarifa_concepto_precios')
              .update({ 
                monto: montoNum, 
                es_porcentaje: val.es_porcentaje,
                porcentaje: porcentajeNum 
              })
              .eq('id', existing.id);
          } else {
            return supabase
              .from('tarifa_concepto_precios')
              .insert({ 
                tarifa_id: tarifaId!, 
                concepto_id: conceptoId, 
                monto: montoNum,
                es_porcentaje: val.es_porcentaje,
                porcentaje: porcentajeNum 
              });
          }
        });

      await Promise.all(conceptOperations);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarifas'] });
      queryClient.invalidateQueries({ queryKey: ['tarifa_concepto_precios'] });
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
        monto_editable: data.monto_editable,
      };

      if (editingConcept) {
        const { error } = await supabase
          .from('tarifa_conceptos')
          .update(conceptData)
          .eq('id', editingConcept.id);
        if (error) throw error;
      } else {
        // Si es super admin, usar el tenant del filtro activo; si no, usar el del perfil
        const targetTenantId = isSuperAdmin() && conceptoTenantFilter !== 'all' && conceptoTenantFilter !== 'global'
          ? conceptoTenantFilter
          : profile?.tenant_id;
        const { error } = await supabase.from('tarifa_conceptos').insert({
          ...conceptData,
          tenant_id: targetTenantId || null,
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

      const operations = Object.entries(conceptPrices)
        .filter(([_, val]) => (val.es_porcentaje && parseFloat(val.porcentaje) >= 0) || (!val.es_porcentaje && parseFloat(val.monto) >= 0))
        .map(async ([conceptoId, val]) => {
          const montoNum = parseFloat(val.monto) || 0;
          const porcentajeNum = parseFloat(val.porcentaje) || null;
          
          const { data: existing } = await supabase
            .from('tarifa_concepto_precios')
            .select('id')
            .eq('tarifa_id', selectedTarifaForPricing.id)
            .eq('concepto_id', conceptoId)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from('tarifa_concepto_precios')
              .update({ 
                monto: montoNum,
                es_porcentaje: val.es_porcentaje,
                porcentaje: porcentajeNum,
                multiplicar_por_bultos: val.multiplicar_por_bultos
              })
              .eq('id', existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('tarifa_concepto_precios')
              .insert({
                tarifa_id: selectedTarifaForPricing.id,
                concepto_id: conceptoId,
                monto: montoNum,
                es_porcentaje: val.es_porcentaje,
                porcentaje: porcentajeNum,
                multiplicar_por_bultos: val.multiplicar_por_bultos
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

  // State for force delete dialog
  const [pendingDeleteTarifa, setPendingDeleteTarifa] = useState<{ id: string; nombre: string; sellers: number; sucursales: number } | null>(null);

  // Delete tarifa mutation with dependency validation
  const deleteTarifaMutation = useMutation({
    mutationFn: async ({ id, force }: { id: string; force?: boolean }) => {
      // 1. Check dependencies
      const [sellersResult, sucursalesResult] = await Promise.all([
        supabase
          .from('ecommerce_sellers')
          .select('id, nombre')
          .or(`tarifa_id.eq.${id},tarifa_express_id.eq.${id}`),
        supabase
          .from('sucursal_tarifas')
          .select('id')
          .eq('tarifa_id', id),
      ]);

      const sellersCount = sellersResult.data?.length || 0;
      const sucursalesCount = sucursalesResult.data?.length || 0;

      if ((sellersCount > 0 || sucursalesCount > 0) && !force) {
        // Get tarifa name for the dialog
        const tarifa = tarifas.find(t => t.id === id);
        throw { 
          type: 'DEPENDENCY_ERROR',
          id,
          nombre: tarifa?.nombre || 'Tarifa',
          sellers: sellersCount,
          sucursales: sucursalesCount,
        };
      }

      // 2. If force=true, unlink first
      if (force) {
        await Promise.all([
          supabase
            .from('ecommerce_sellers')
            .update({ tarifa_id: null })
            .eq('tarifa_id', id),
          supabase
            .from('ecommerce_sellers')
            .update({ tarifa_express_id: null })
            .eq('tarifa_express_id', id),
          supabase
            .from('sucursal_tarifas')
            .delete()
            .eq('tarifa_id', id),
        ]);
      }

      // 3. Delete tarifa
      const { error } = await supabase.from('tarifas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarifas'] });
      toast.success('Tarifa eliminada');
      setPendingDeleteTarifa(null);
    },
    onError: (error: any) => {
      if (error?.type === 'DEPENDENCY_ERROR') {
        setPendingDeleteTarifa({
          id: error.id,
          nombre: error.nombre,
          sellers: error.sellers,
          sucursales: error.sucursales,
        });
      } else {
        toast.error('Error al eliminar: ' + (error?.message || error));
      }
    },
  });

  // Open tarifa branches dialog
  const handleOpenTarifaBranches = (tarifa: Tarifa) => {
    setSelectedTarifaForBranches(tarifa);
    setIsTarifaBranchDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      tipo_tarifa: 'peso',
      precio_base: '5000',
      precio_por_kg: '',
      precio_por_km: '',
      precio_por_m3: '',
      zona_origen: '',
      zona_destino: '',
      comision_chofer_porcentaje: '10',
      comision_chofer_fija: '',
      activa: true,
      peso_base_hasta: '5',
      adicional_por_kg: '',
      volumen_base_hasta: '',
      adicional_por_m3: '',
      rangos_kg: [],
      umbral_volumen_cm: 50,
      multiplicar_flete_por_bultos: false,
      conceptos: {},
      express_surcharge: '',
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
      monto_editable: false,
    });
    setEditingConcept(null);
  };

  const handleEdit = async (tarifa: Tarifa) => {
    setEditingTarifa(tarifa);
    
    // Load existing concept prices
    const { data: existingPrices } = await supabase
      .from('tarifa_concepto_precios')
      .select('concepto_id, monto, es_porcentaje, porcentaje, multiplicar_por_bultos')
      .eq('tarifa_id', tarifa.id);

    const conceptosMap: Record<string, { monto: string; es_porcentaje: boolean; porcentaje: string; multiplicar_por_bultos: boolean }> = {};
    existingPrices?.forEach(p => {
      conceptosMap[p.concepto_id] = {
        monto: p.monto?.toString() || '0',
        es_porcentaje: p.es_porcentaje || false,
        porcentaje: p.porcentaje?.toString() || '',
        multiplicar_por_bultos: p.multiplicar_por_bultos || false,
      };
    });

    const rangos = tarifa.rangos_precios || {};
    const rangosKg = (tarifa.rangos_kg as WeightRange[]) || [];

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
      peso_base_hasta: rangos.peso_base_hasta?.toString() || '',
      adicional_por_kg: rangos.adicional_por_kg?.toString() || '',
      volumen_base_hasta: rangos.volumen_base_hasta?.toString() || '',
      adicional_por_m3: rangos.adicional_por_m3?.toString() || '',
      rangos_kg: rangosKg,
      umbral_volumen_cm: tarifa.umbral_volumen_cm || 50,
      multiplicar_flete_por_bultos: tarifa.multiplicar_flete_por_bultos ?? false,
      conceptos: conceptosMap,
      express_surcharge: (tarifa as any).express_surcharge?.toString() || '',
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
      monto_editable: (concept as any).monto_editable ?? false,
    });
    setIsConceptDialogOpen(true);
  };

  const handleOpenPricing = async (tarifa: Tarifa) => {
    setSelectedTarifaForPricing(tarifa);
    
    // Fetch prices for this specific tariff
    const { data: pricesData } = await supabase
      .from('tarifa_concepto_precios')
      .select('concepto_id, monto, es_porcentaje, porcentaje, multiplicar_por_bultos')
      .eq('tarifa_id', tarifa.id);
    
    // Initialize prices from existing data
    const prices: Record<string, { monto: string; es_porcentaje: boolean; porcentaje: string; multiplicar_por_bultos: boolean }> = {};
    conceptos.forEach(c => {
      const existingPrice = pricesData?.find(p => p.concepto_id === c.id);
      prices[c.id] = existingPrice 
        ? { 
            monto: existingPrice.monto?.toString() || '0',
            es_porcentaje: existingPrice.es_porcentaje || false,
            porcentaje: existingPrice.porcentaje?.toString() || '',
            multiplicar_por_bultos: existingPrice.multiplicar_por_bultos || false,
          }
        : { monto: '0', es_porcentaje: !!c.codigo?.toLowerCase().includes('seguro'), porcentaje: '', multiplicar_por_bultos: false };
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

  // Initialize concept prices when dialog opens - no longer needed, using handleOpenPricing

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

  // renderRateTypeFields and renderConceptPrices moved to CreateTarifaWizard

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
          <div className="flex justify-between gap-2 flex-wrap">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsBulkUpdateOpen(true)}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Ajuste Masivo
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsInsuranceOpen(true)}
              >
                <Shield className="h-4 w-4 mr-2" />
                Configurar Seguro
              </Button>
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
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTarifa ? 'Editar Tarifa' : 'Nueva Tarifa'}
                  </DialogTitle>
                </DialogHeader>
                <CreateTarifaWizard
                  formData={formData}
                  setFormData={setFormData}
                  onSubmit={handleSubmit}
                  onCancel={() => {
                    resetForm();
                    setIsDialogOpen(false);
                  }}
                  editingTarifa={editingTarifa}
                  conceptos={conceptos}
                  isPending={saveMutation.isPending}
                />
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
                            {tarifa.multiplicar_flete_por_bultos && (
                              <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-400">
                                <Package className="h-3 w-3" />
                                ×Bultos
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenPricing(tarifa)}
                            title="Configurar precios por concepto"
                          >
                            <Layers className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenTarifaBranches(tarifa)}
                            title="Gestionar sucursales"
                          >
                            <Building2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(tarifa)}
                            title="Editar tarifa"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin() && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`¿Eliminar la tarifa "${tarifa.nombre}"? Esta acción no se puede deshacer.`)) {
                                  deleteTarifaMutation.mutate({ id: tarifa.id });
                                }
                              }}
                              title="Eliminar tarifa"
                              disabled={deleteTarifaMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

                      {/* Super Admin: Show tenant and creator info */}
                      {isSuperAdmin() && tarifa.tenant && (
                        <div className="mt-3 pt-3 border-t border-dashed">
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3 w-3" />
                              <span>Empresa: <strong>{tarifa.tenant.nombre}</strong></span>
                            </div>
                            {tarifa.creador && (
                              <div className="flex items-center gap-2">
                                <Users className="h-3 w-3" />
                                <span>Creado por: {tarifa.creador.nombre} {tarifa.creador.apellido || ''}</span>
                              </div>
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
            <div className="flex items-center gap-4">
              <div>
                <p className="text-muted-foreground">
                  Define los conceptos que componen las tarifas.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Los conceptos <strong>básicos</strong> están disponibles para todas las sucursales.
                  Los <strong>adicionales</strong> se habilitan por sucursal.
                </p>
              </div>
              {isSuperAdmin() && (
                <Select value={conceptoTenantFilter} onValueChange={setConceptoTenantFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrar por empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las empresas</SelectItem>
                    <SelectItem value="global">Globales (sin tenant)</SelectItem>
                    {allTenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
                  <div className="border-t pt-4 space-y-4">
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
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="concept_monto_editable">Importe editable</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          El operador ingresa un monto libre al crear el envío
                        </p>
                      </div>
                      <Switch
                        id="concept_monto_editable"
                        checked={conceptFormData.monto_editable}
                        onCheckedChange={(checked) =>
                          setConceptFormData({ ...conceptFormData, monto_editable: checked })
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
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant={concepto.es_basico ? 'default' : 'outline'}
                              className={concepto.es_basico ? 'bg-primary/10 text-primary' : 'border-warning text-warning'}
                            >
                              {concepto.es_basico ? 'Básico' : 'Adicional'}
                            </Badge>
                            {(concepto as any).monto_editable && (
                              <Badge variant="outline" className="text-xs">
                                $ Libre
                              </Badge>
                            )}
                            {isSuperAdmin() && (concepto as any).tenant && (
                              <Badge variant="secondary" className="text-xs">
                                {(concepto as any).tenant.nombre}
                              </Badge>
                            )}
                          </div>
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
            {conceptos.filter(c => c.activo).map((concepto) => {
              const isSeguro = !!concepto.codigo?.toLowerCase().includes('seguro');
              const currentValue = conceptPrices[concepto.id] || { monto: '0', es_porcentaje: isSeguro, porcentaje: '', multiplicar_por_bultos: false };
              
              return (
                <div key={concepto.id} className="space-y-2 border-b pb-3 last:border-b-0">
                  <div className="flex items-center gap-4">
                    <div className="w-32 flex items-center gap-2">
                      <Label>{concepto.nombre}</Label>
                      {!concepto.es_basico && (
                        <Badge variant="outline" className="text-xs border-warning text-warning">
                          +
                        </Badge>
                      )}
                    </div>
                    <div className="flex-1">
                      {isSeguro ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={currentValue.es_porcentaje}
                            onCheckedChange={(checked) =>
                              setConceptPrices({
                                ...conceptPrices,
                                [concepto.id]: { ...currentValue, es_porcentaje: checked },
                              })
                            }
                          />
                          <span className="text-xs">{currentValue.es_porcentaje ? '%' : '$'}</span>
                          {currentValue.es_porcentaje ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={currentValue.porcentaje}
                              onChange={(e) =>
                                setConceptPrices({
                                  ...conceptPrices,
                                  [concepto.id]: { ...currentValue, porcentaje: e.target.value },
                                })
                              }
                              placeholder="2.5"
                              className="w-24"
                            />
                          ) : (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={currentValue.monto}
                              onChange={(e) =>
                                setConceptPrices({
                                  ...conceptPrices,
                                  [concepto.id]: { ...currentValue, monto: e.target.value },
                                })
                              }
                              placeholder="0.00"
                            />
                          )}
                        </div>
                      ) : (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentValue.monto}
                          onChange={(e) =>
                            setConceptPrices({
                              ...conceptPrices,
                              [concepto.id]: { ...currentValue, monto: e.target.value },
                            })
                          }
                          placeholder="0.00"
                        />
                      )}
                    </div>
                  </div>
                  {/* Toggle multiplicar por bultos */}
                  <div className="flex items-center gap-2 ml-32 pl-1">
                    <Switch
                      id={`bultos-${concepto.id}`}
                      checked={currentValue.multiplicar_por_bultos}
                      onCheckedChange={(checked) =>
                        setConceptPrices({
                          ...conceptPrices,
                          [concepto.id]: { ...currentValue, multiplicar_por_bultos: checked },
                        })
                      }
                    />
                    <Label htmlFor={`bultos-${concepto.id}`} className="text-xs text-muted-foreground cursor-pointer">
                      × Cantidad de bultos
                    </Label>
                  </div>
                </div>
              );
            })}
            <div className="border-t pt-4">
              <div className="flex justify-between font-medium">
                <span>Total por Conceptos:</span>
                <span className="text-tarifas">
                  {formatCurrency(
                    Object.values(conceptPrices).reduce(
                      (sum, val) => sum + (parseFloat(val.monto) || 0),
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

      {/* Dialog para ajuste masivo de tarifas */}
      <BulkRateUpdateDialog
        open={isBulkUpdateOpen}
        onOpenChange={setIsBulkUpdateOpen}
      />

      {/* Dialog para configuración de seguro */}
      <InsuranceConfigDialog
        open={isInsuranceOpen}
        onOpenChange={setIsInsuranceOpen}
      />

      {/* Dialog para gestionar sucursales de una tarifa */}
      {selectedTarifaForBranches && (
        <TarifaBranchesDialog
          open={isTarifaBranchDialogOpen}
          onOpenChange={setIsTarifaBranchDialogOpen}
          tarifaId={selectedTarifaForBranches.id}
          tarifaNombre={selectedTarifaForBranches.nombre}
        />
      )}

      {/* Force Delete Confirmation Dialog */}
      <AlertDialog open={!!pendingDeleteTarifa} onOpenChange={(open) => !open && setPendingDeleteTarifa(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tarifa en uso</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                La tarifa <strong>"{pendingDeleteTarifa?.nombre}"</strong> está siendo utilizada por:
              </p>
              <ul className="list-disc list-inside text-sm">
                {(pendingDeleteTarifa?.sellers || 0) > 0 && (
                  <li>{pendingDeleteTarifa?.sellers} seller(s) de e-commerce</li>
                )}
                {(pendingDeleteTarifa?.sucursales || 0) > 0 && (
                  <li>{pendingDeleteTarifa?.sucursales} sucursal(es)</li>
                )}
              </ul>
              <p className="pt-2">
                ¿Desea desvincularla de todos y eliminarla de todas formas?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteTarifa) {
                  deleteTarifaMutation.mutate({ id: pendingDeleteTarifa.id, force: true });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desvincular y eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
