import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useFormDraft } from '@/hooks/useFormDraft';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput, formatArgentinaPhone } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import ContactAutocomplete from '@/components/shipments/ContactAutocomplete';
import { AddressAutocomplete, type AddressDetails } from '@/components/maps';
import { Checkbox } from '@/components/ui/checkbox';
import { DraftIndicator, DraftSavingIndicator } from '@/components/ui/draft-indicator';
import { 
  PackagePlus, ArrowLeft, User, MapPin, Package, DollarSign, Loader2, 
  CreditCard, Truck, Calendar, Clock, Home, AlertCircle, Wallet, Phone,
  Building2, ArrowRight, Navigation, Plus
} from 'lucide-react';
import { PaymentMethodDialog } from '@/components/shipments/PaymentMethodDialog';
import { useCoverageValidation } from '@/hooks/useCoverageValidation';

interface TarifaConcepto {
  id: string;
  nombre: string;
  codigo: string;
  es_basico?: boolean | null;
  activo?: boolean | null;
  monto_editable?: boolean | null;
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

interface EcommerceSeller {
  id: string;
  saldo_cuenta_corriente: number | null;
  limite_credito: number | null;
  tiene_cuenta_corriente: boolean | null;
}

interface Client {
  id: string;
  nombre: string;
  apellido?: string | null;
  telefono: string;
  email?: string | null;
  direccion: string;
  ciudad?: string | null;
  codigo_postal?: string | null;
  dni_cuit?: string | null;
  tiene_cuenta_corriente?: boolean | null;
  saldo_cuenta_corriente?: number | null;
  limite_credito?: number | null;
  lat?: number | null;
  lng?: number | null;
  ecommerce_seller?: EcommerceSeller[] | null;
}

interface Sucursal {
  id: string;
  nombre: string;
  codigo: string | null;
  ciudad: string | null;
  direccion: string;
  puede_despachar: boolean | null;
  puede_recibir: boolean | null;
  realiza_retiros: boolean | null;
  realiza_entregas: boolean | null;
  lat: number | null;
  lng: number | null;
}

type TipoServicioDetalle = 'sucursal_sucursal' | 'sucursal_puerta' | 'puerta_sucursal' | 'puerta_puerta' | 'retiro_almacenaje';

const TIPO_SERVICIO_OPTIONS: { value: TipoServicioDetalle; label: string; icon: string; description: string; requiresCtaCte?: boolean }[] = [
  { 
    value: 'sucursal_sucursal', 
    label: 'Sucursal a Sucursal', 
    icon: '🏢→🏢',
    description: 'El cliente despacha y retira en sucursales'
  },
  { 
    value: 'sucursal_puerta', 
    label: 'Sucursal a Puerta', 
    icon: '🏢→🏠',
    description: 'Despacha en sucursal, entregamos a domicilio'
  },
  { 
    value: 'puerta_sucursal', 
    label: 'Puerta a Sucursal', 
    icon: '🏠→🏢',
    description: 'Retiramos a domicilio, retira en sucursal'
  },
  { 
    value: 'puerta_puerta', 
    label: 'Puerta a Puerta', 
    icon: '🏠→🏠',
    description: 'Retiramos y entregamos a domicilio'
  },
  { 
    value: 'retiro_almacenaje', 
    label: 'Retiro para Almacenaje', 
    icon: '🏠→📦',
    description: 'Retiro de cliente con Cta. Cte. para guardar en bodega',
    requiresCtaCte: true
  },
];

const DIAS_SEMANA = [
  { key: 'lunes', label: 'Lun' },
  { key: 'martes', label: 'Mar' },
  { key: 'miercoles', label: 'Mié' },
  { key: 'jueves', label: 'Jue' },
  { key: 'viernes', label: 'Vie' },
  { key: 'sabado', label: 'Sáb' },
];

const HORARIOS_RETIRO = [
  { value: 'manana', label: 'Mañana (8:00 - 12:00)' },
  { value: 'tarde', label: 'Tarde (12:00 - 18:00)' },
  { value: 'noche', label: 'Noche (18:00 - 21:00)' },
];

const HORARIOS_ENTREGA = [
  { value: 'cualquier_hora', label: 'Cualquier horario' },
  { value: 'manana', label: 'Mañana (8:00 - 12:00)' },
  { value: 'tarde', label: 'Tarde (12:00 - 18:00)' },
  { value: 'noche', label: 'Noche (18:00 - 21:00)' },
];

// ─── Funciones auxiliares para auto-selección de tarifa por destino ───
function normalizarTexto(str: string): string {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function encontrarTarifaPorDestino(
  ciudad: string | null,
  cp: string | null,
  peso: number,
  tarifas: any[]
): any | null {
  if (!ciudad && !cp) return null;
  const ciudadNorm = ciudad ? normalizarTexto(ciudad) : '';
  const cpTrim = cp?.trim() || '';

  // 1. Cualquier tarifa con zona_destino configurado (independiente del tipo_tarifa)
  // El tipo_tarifa define CÓMO se calcula el precio, no DÓNDE aplica la tarifa
  const coincidentesZona = tarifas.filter(t => {
    if (!t.zona_destino) return false;
    const destinos = t.zona_destino.split(',').map((d: string) => normalizarTexto(d.trim()));
    if (ciudadNorm && destinos.some((d: string) => d.includes(ciudadNorm) || ciudadNorm.includes(d))) return true;
    if (cpTrim && destinos.some((d: string) => d === cpTrim)) return true;
    return false;
  });

  if (coincidentesZona.length === 1) return coincidentesZona[0];

  // Desempate por peso si hay múltiples zonas coincidentes
  if (coincidentesZona.length > 1 && peso > 0) {
    const porPeso = coincidentesZona.find(t => {
      const rangos = Array.isArray(t.rangos_kg) ? t.rangos_kg : [];
      return rangos.some((r: any) => peso >= r.desde && peso <= r.hasta);
    });
    if (porPeso) return porPeso;
    return coincidentesZona[0];
  }

  if (coincidentesZona.length > 0) return coincidentesZona[0];

  return null;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function NewShipment() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Feature flag: auto-selección de tarifa por zona (solo para tenants con la flag activa, ej: BlackBox)
  const { tenant } = useTenant();
  const autoSeleccionPorZona = !!(tenant?.configuracion as any)?.auto_seleccion_tarifa_por_zona;
  const [tarifaFueAutoDetectada, setTarifaFueAutoDetectada] = useState(false);

  // Tipo de servicio detallado (4 opciones) — persisted to survive tab switches
  const [tipoServicioDetalle, setTipoServicioDetalle] = usePersistedState<TipoServicioDetalle>('ns-tipo-servicio', 'sucursal_sucursal');
  
  // Días preferidos de entrega — persisted
  const [diasPreferidos, setDiasPreferidos] = usePersistedState<string[]>('ns-dias-preferidos', []);

  // Guard contra navegación duplicada y doble-submit
  const navigationAttemptedRef = useRef(false);

  // Form data with draft persistence
  const initialFormData = {
    // Remitente
    remitente_nombre: '',
    remitente_apellido: '',
    remitente_telefono: '',
    remitente_email: '',
    remitente_direccion: '',
    remitente_ciudad: '',
    remitente_codigo_postal: '',
    remitente_dni: '',
    // Destinatario
    destinatario_nombre: '',
    destinatario_apellido: '',
    destinatario_telefono: '',
    destinatario_email: '',
    destinatario_direccion: '',
    destinatario_ciudad: '',
    destinatario_codigo_postal: '',
    destinatario_dni: '',
    destinatario_whatsapp: '', // auto-filled from destinatario_telefono
    // Envío
    sucursal_destino_id: '',
    tarifa_id: '',
    tipo_pago: 'contado',
    descripcion: '',
    peso_kg: '',
    dimensiones: '',
    valor_declarado: '',
    pago_contra_entrega: false,
    notas: '',
    cliente_cta_cte_id: '',
    cantidad_bultos: '1',
    // Retiro en domicilio
    fecha_retiro: '',
    horario_retiro: '',
    notas_retiro: '',
    // Entrega a domicilio
    horario_preferido_entrega: 'cualquier_hora',
  };

  const {
    formData,
    setFormData,
    hasDraft,
    lastSaved,
    clearDraft,
    discardDraft,
    isDraftRecovered,
    setIsDraftRecovered,
  } = useFormDraft('new-shipment', initialFormData);

  // Coordinates state for distance calculation
  const [origenCoords, setOrigenCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [createdEnvio, setCreatedEnvio] = useState<{ id: string; tracking_number: string; precio_total: number; remitente_id: string } | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Client match alert state
  const [pendingClientMatch, setPendingClientMatch] = useState<{
    client: Client;
    target: 'remitente' | 'destinatario';
  } | null>(null);
  
  // Flag to prevent redundant alerts when client was loaded from ContactAutocomplete
  const [clientLoadedManually, setClientLoadedManually] = useState<{ remitente: boolean; destinatario: boolean }>({ remitente: false, destinatario: false });
  
  // Sucursal destino combobox state
  const [sucursalDestinoOpen, setSucursalDestinoOpen] = useState(false);
  
  // State for selected additional concepts
  const [conceptosSeleccionados, setConceptosSeleccionados] = useState<Set<string>>(new Set());
  // State for editable concept amounts (monto_editable)
  const [montosEditables, setMontosEditables] = useState<Record<string, string>>({});
  // Derived states
  const esRetiroAlmacenaje = tipoServicioDetalle === 'retiro_almacenaje';
  const tieneRetiro = tipoServicioDetalle === 'puerta_sucursal' || tipoServicioDetalle === 'puerta_puerta' || esRetiroAlmacenaje;
  const tieneEntrega = tipoServicioDetalle === 'sucursal_puerta' || tipoServicioDetalle === 'puerta_puerta';
  
  // La sucursal de origen es fija - la del usuario
  const sucursalOrigenId = profile?.sucursal_id;

  // Coverage validation
  const { validateDestination, hasCoverageRestrictions } = useCoverageValidation(sucursalOrigenId);

  // Query para obtener datos de la sucursal del usuario
  const { data: sucursalUsuario, isLoading: loadingSucursalUsuario } = useQuery({
    queryKey: ['sucursal-usuario', sucursalOrigenId],
    queryFn: async () => {
      if (!sucursalOrigenId) return null;
      const { data, error } = await supabase
        .from('sucursales')
        .select('*')
        .eq('id', sucursalOrigenId)
        .single();
      if (error) throw error;
      return data as Sucursal;
    },
    enabled: !!sucursalOrigenId,
    refetchOnWindowFocus: false,
  });

  // Set origin coordinates from user's sucursal
  useEffect(() => {
    if (sucursalUsuario && sucursalUsuario.lat && sucursalUsuario.lng && !tieneRetiro) {
      setOrigenCoords({ lat: sucursalUsuario.lat, lng: sucursalUsuario.lng });
    }
  }, [sucursalUsuario, tieneRetiro]);

  // Queries
  const { data: sucursales = [] } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre, codigo, ciudad, direccion, puede_despachar, puede_recibir, realiza_retiros, realiza_entregas, lat, lng')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data as Sucursal[];
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  // Sucursales destino (para retiro en sucursal)
  // Para puerta_sucursal podemos incluir la sucursal origen como destino
  const sucursalesDestino = useMemo(() => {
    return sucursales.filter(s => s.puede_recibir !== false);
  }, [sucursales]);

  const { data: tarifas, isLoading: loadingTarifas, refetch: refetchTarifas } = useQuery({
    queryKey: ['tarifas', profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarifas')
        .select('*')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!profile,
    refetchOnWindowFocus: false,
  });

  const { data: conceptos = [] } = useQuery({
    queryKey: ['tarifa_conceptos'],
    queryFn: async () => {
      let query = supabase
        .from('tarifa_conceptos')
        .select('id, nombre, codigo, es_basico, activo, monto_editable')
        .eq('activo', true)
        .order('orden');
      // Filtrar por tenant del usuario + conceptos globales
      if (profile?.tenant_id) {
        query = query.or(`tenant_id.eq.${profile.tenant_id},tenant_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as TarifaConcepto[];
    },
    enabled: !!user && !!profile?.tenant_id,
    refetchOnWindowFocus: false,
  });

  // Query para obtener conceptos habilitados para la sucursal del usuario
  const { data: sucursalConceptos = [] } = useQuery({
    queryKey: ['sucursal-conceptos', sucursalOrigenId],
    queryFn: async () => {
      if (!sucursalOrigenId) return [];
      const { data, error } = await supabase
        .from('sucursal_conceptos')
        .select('concepto_id, habilitado')
        .eq('sucursal_id', sucursalOrigenId)
        .eq('habilitado', true);
      if (error) throw error;
      return data;
    },
    enabled: !!sucursalOrigenId,
    refetchOnWindowFocus: false,
  });

  // Query para tarifas habilitadas por sucursal origen
  const { data: sucursalTarifas = [], isLoading: loadingSucursalTarifas } = useQuery({
    queryKey: ['sucursal-tarifas', sucursalOrigenId],
    queryFn: async () => {
      if (!sucursalOrigenId) return [];
      const { data, error } = await supabase
        .from('sucursal_tarifas')
        .select('tarifa_id')
        .eq('sucursal_id', sucursalOrigenId)
        .eq('habilitada', true);
      if (error) throw error;
      return data;
    },
    enabled: !!sucursalOrigenId,
    refetchOnWindowFocus: false,
  });


  // Query para configuración de seguro
  const { data: configSeguro } = useQuery({
    queryKey: ['configuracion_seguro', profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracion_seguro')
        .select('*')
        .eq('tenant_id', profile?.tenant_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
    refetchOnWindowFocus: false,
  });

  // Query para verificar si hay caja abierta en la sucursal del usuario
  const { data: cajaAbierta, isLoading: loadingCaja } = useQuery({
    queryKey: ['caja-abierta', sucursalOrigenId],
    queryFn: async () => {
      if (!sucursalOrigenId) return null;
      
      const { data, error } = await supabase
        .from('sesiones_caja')
        .select('id, sucursal_id')
        .eq('sucursal_id', sucursalOrigenId)
        .eq('estado', 'abierta')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!sucursalOrigenId,
    refetchOnWindowFocus: false,
  });

  const { data: conceptoPrecios = [] } = useQuery({
    queryKey: ['tarifa_concepto_precios', formData.tarifa_id],
    queryFn: async () => {
      if (!formData.tarifa_id) return [];
      const { data, error } = await supabase
        .from('tarifa_concepto_precios')
        .select('*, concepto:tarifa_conceptos(id, nombre, codigo, es_basico, activo, monto_editable)')
        .eq('tarifa_id', formData.tarifa_id);
      if (error) throw error;
      return data as (TarifaConceptoPrecio & { es_porcentaje?: boolean; porcentaje?: number })[];
    },
    enabled: !!formData.tarifa_id,
    refetchOnWindowFocus: false,
  });

  // Clasificar conceptos en básicos y adicionales
  const { conceptosBasicos, conceptosAdicionales } = useMemo(() => {
    // Primero aplicar el filtro por tipo de servicio y excluir conceptos inactivos
    const filtradosPorServicio = conceptoPrecios.filter((cp) => {
      // Excluir conceptos inactivos
      if (cp.concepto?.activo === false) return false;
      
      const codigo = cp.concepto?.codigo?.toLowerCase();
      if (codigo?.includes('retiro') && !tieneRetiro) return false;
      if (codigo?.includes('entrega') && !tieneEntrega) return false;
      return true;
    });

    // Separar en básicos y adicionales
    const basicos = filtradosPorServicio.filter(cp => cp.concepto?.es_basico !== false);
    
    // Los adicionales deben estar habilitados para la sucursal
    const habilitadosIds = new Set(sucursalConceptos.map(sc => sc.concepto_id));
    const adicionales = filtradosPorServicio.filter(cp => {
      const esAdicional = cp.concepto?.es_basico === false;
      const habilitadoParaSucursal = habilitadosIds.has(cp.concepto_id);
      return esAdicional && habilitadoParaSucursal;
    });

    return { conceptosBasicos: basicos, conceptosAdicionales: adicionales };
  }, [conceptoPrecios, sucursalConceptos, tieneRetiro, tieneEntrega]);

  // Filtrar conceptos según el tipo de servicio (para mantener compatibilidad)
  const conceptosPreciosFiltrados = useMemo(() => {
    // Combinar básicos + adicionales seleccionados
    const adicionalSeleccionados = conceptosAdicionales.filter(cp => 
      conceptosSeleccionados.has(cp.concepto_id)
    );
    return [...conceptosBasicos, ...adicionalSeleccionados];
  }, [conceptosBasicos, conceptosAdicionales, conceptosSeleccionados]);

  // Fetch ALL clients for autocomplete and deduplication
  const { data: allClients = [] } = useQuery({
    queryKey: ['all_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          *,
          ecommerce_seller:ecommerce_sellers!ecommerce_sellers_cliente_id_fkey(
            id, saldo_cuenta_corriente, limite_credito, tiene_cuenta_corriente
          )
        `)
        .order('nombre');
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user && !!profile?.tenant_id,
  });

  // Check existing client on DNI blur (nombre+apellido+DNI)
  const checkExistingClient = async (dniValue: string, target: 'remitente' | 'destinatario') => {
    // Skip if client was loaded manually from ContactAutocomplete
    if (clientLoadedManually[target]) return;
    
    const dni = dniValue?.trim();
    if (!dni || dni.length < 6) return;
    
    const nombre = target === 'remitente' ? formData.remitente_nombre?.trim() : formData.destinatario_nombre?.trim();
    if (!nombre) return;
    
    let query = supabase
      .from('clientes')
      .select('*')
      .ilike('nombre', nombre)
      .ilike('dni_cuit', dni);
    
    const apellido = target === 'remitente' ? formData.remitente_apellido?.trim() : formData.destinatario_apellido?.trim();
    if (apellido) {
      query = query.ilike('apellido', apellido);
    }
    
    const { data: found } = await query.limit(1).maybeSingle();
    if (found) {
      // Si los datos ya coinciden con el formulario, es el mismo cliente cargado — no alertar
      const currentName = target === 'remitente' ? formData.remitente_nombre?.trim() : formData.destinatario_nombre?.trim();
      const currentDir = target === 'remitente' ? formData.remitente_direccion?.trim() : formData.destinatario_direccion?.trim();
      
      if (
        found.nombre?.toLowerCase() === currentName?.toLowerCase() &&
        found.direccion?.toLowerCase() === currentDir?.toLowerCase()
      ) {
        return;
      }
      
      setPendingClientMatch({ client: found as Client, target });
    }
  };

  const applyClientMatch = () => {
    if (!pendingClientMatch) return;
    const { client, target } = pendingClientMatch;
    if (target === 'remitente') {
      setFormData(prev => ({
        ...prev,
        remitente_nombre: client.nombre,
        remitente_apellido: client.apellido || '',
        remitente_telefono: client.telefono,
        remitente_email: client.email || '',
        remitente_direccion: client.direccion,
        remitente_ciudad: client.ciudad || '',
        remitente_codigo_postal: client.codigo_postal || '',
        remitente_dni: client.dni_cuit || '',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        destinatario_nombre: client.nombre,
        destinatario_apellido: client.apellido || '',
        destinatario_telefono: client.telefono,
        destinatario_email: client.email || '',
        destinatario_direccion: client.direccion,
        destinatario_ciudad: client.ciudad || '',
        destinatario_codigo_postal: client.codigo_postal || '',
        destinatario_dni: client.dni_cuit || '',
      }));
    }
    setPendingClientMatch(null);
  };


  const clientesCtaCte = useMemo(() => {
    return allClients.filter(c => c.tiene_cuenta_corriente);
  }, [allClients]);

  // Helper: dado un cliente-id de cta cte, obtener su seller vinculado (si existe)
  const getSellerForCliente = (clienteId: string): EcommerceSeller | null => {
    const cliente = allClients.find(c => c.id === clienteId);
    if (!cliente?.ecommerce_seller?.length) return null;
    return cliente.ecommerce_seller[0];
  };

  // Detectar si el remitente tiene cuenta corriente
  const remitenteConCtaCte = useMemo(() => {
    if (!formData.remitente_dni && !formData.remitente_nombre) return null;
    
    return allClients.find(c => {
      if (formData.remitente_dni && c.dni_cuit) {
        const dniMatch = c.dni_cuit.toLowerCase().trim() === formData.remitente_dni.toLowerCase().trim();
        if (dniMatch && c.tiene_cuenta_corriente) return true;
      }
      if (formData.remitente_nombre) {
        const fullName = `${c.nombre} ${c.apellido || ''}`.toLowerCase().trim();
        const nameMatch = fullName === formData.remitente_nombre.toLowerCase().trim() ||
                         c.nombre.toLowerCase().trim() === formData.remitente_nombre.toLowerCase().trim();
        if (nameMatch && c.tiene_cuenta_corriente) return true;
      }
      return false;
    });
  }, [formData.remitente_dni, formData.remitente_nombre, allClients]);

  // Filtrar tarifas disponibles por sucursal origen (si hay asignaciones, solo mostrar las habilitadas)
  const tarifasDisponibles = useMemo(() => {
    if (!tarifas) return [];
    // Esperar a que carguen las asignaciones de sucursal antes de decidir
    if (loadingSucursalTarifas) return [];

    // Si no hay asignaciones en sucursal_tarifas, mostrar todas las tarifas activas
    if (sucursalTarifas.length === 0) {
      return tarifas;
    }

    // Filtrar solo las tarifas habilitadas para la sucursal origen
    const tarifaIdsHabilitados = new Set(sucursalTarifas.map(st => st.tarifa_id));
    return tarifas.filter(t => tarifaIdsHabilitados.has(t.id));
  }, [tarifas, sucursalTarifas, loadingSucursalTarifas]);

  // Limpiar tarifa seleccionada si ya no está en las disponibles (ej: cambio de sucursal, race condition)
  useEffect(() => {
    if (formData.tarifa_id && tarifasDisponibles.length > 0) {
      if (!tarifasDisponibles.some(t => t.id === formData.tarifa_id)) {
        setFormData(prev => ({ ...prev, tarifa_id: '' }));
        setTarifaFueAutoDetectada(false);
      }
    }
  }, [tarifasDisponibles, formData.tarifa_id]);

  // Auto-seleccionar tarifa si solo hay una disponible (solo cuando NO hay auto-selección por zona activa)
  useEffect(() => {
    if (autoSeleccionPorZona) return; // La auto-selección por zona maneja este caso
    if (tarifasDisponibles.length === 1 && !formData.tarifa_id) {
      setFormData(prev => ({ ...prev, tarifa_id: tarifasDisponibles[0].id }));
    }
  }, [tarifasDisponibles, formData.tarifa_id, autoSeleccionPorZona]);

  // Auto-selección de tarifa por destino + peso (solo cuando la feature flag está activa)
  useEffect(() => {
    if (!autoSeleccionPorZona || !tarifasDisponibles.length) return;

    const peso = parseFloat(formData.peso_kg) || 0;
    const match = encontrarTarifaPorDestino(
      formData.destinatario_ciudad,
      formData.destinatario_codigo_postal,
      peso,
      tarifasDisponibles
    );

    if (match) {
      setFormData(prev => {
        if (prev.tarifa_id === match.id) return prev;
        return { ...prev, tarifa_id: match.id };
      });
      setTarifaFueAutoDetectada(true);
    } else {
      setTarifaFueAutoDetectada(false);
    }
  }, [
    formData.destinatario_ciudad,
    formData.destinatario_codigo_postal,
    formData.peso_kg,
    tarifasDisponibles,
    autoSeleccionPorZona,
  ]);

  const selectedTarifa = tarifasDisponibles?.find(t => t.id === formData.tarifa_id);

  // Memoizar total de conceptos básicos (evitar recálculo en cada render)
  const totalConceptosBasicos = useMemo(() => {
    // Usar valor mínimo de seguro si no se especifica valor declarado
    const valorDeclarado = parseFloat(formData.valor_declarado) || 
      (configSeguro?.valor_minimo_declarado || 0);
    const cantidadBultos = parseInt(formData.cantidad_bultos) || 1;
    
    return conceptosBasicos.reduce((sum, cp) => {
      // Skip flete concept - already included in fleteCalculado
      const codigo = cp.concepto?.codigo?.toLowerCase();
      const nombre = cp.concepto?.nombre?.toLowerCase();
      if (codigo === 'flete' || nombre === 'flete') return sum;
      
      let montoConcepto = 0;
      if (cp.es_porcentaje && cp.porcentaje) {
        montoConcepto = valorDeclarado * Number(cp.porcentaje) / 100;
      } else {
        montoConcepto = Number(cp.monto);
      }
      if (cp.multiplicar_por_bultos) {
        montoConcepto *= cantidadBultos;
      }
      return sum + montoConcepto;
    }, 0);
  }, [conceptosBasicos, formData.valor_declarado, formData.cantidad_bultos, configSeguro]);

  // Memoizar total de conceptos adicionales seleccionados
  const totalConceptosAdicionales = useMemo(() => {
    // Usar valor mínimo de seguro si no se especifica valor declarado
    const valorDeclarado = parseFloat(formData.valor_declarado) || 
      (configSeguro?.valor_minimo_declarado || 0);
    const cantidadBultos = parseInt(formData.cantidad_bultos) || 1;
    
    return conceptosAdicionales
      .filter(cp => conceptosSeleccionados.has(cp.concepto_id))
      .reduce((sum, cp) => {
        let montoConcepto = 0;
        // If concept is monto_editable, use the operator-entered value
        if (cp.concepto?.monto_editable && montosEditables[cp.concepto_id]) {
          montoConcepto = parseFloat(montosEditables[cp.concepto_id]) || 0;
        } else if (cp.es_porcentaje && cp.porcentaje) {
          montoConcepto = valorDeclarado * Number(cp.porcentaje) / 100;
        } else {
          montoConcepto = Number(cp.monto);
        }
        if (cp.multiplicar_por_bultos) {
          montoConcepto *= cantidadBultos;
        }
        return sum + montoConcepto;
      }, 0);
  }, [conceptosAdicionales, conceptosSeleccionados, formData.valor_declarado, formData.cantidad_bultos, configSeguro, montosEditables]);

  // Calcular flete base con descripción detallada
  const { fleteCalculado, fleteDescripcion, metodoAplicado, multiplicadoPorBultos } = useMemo(() => {
    if (!selectedTarifa) return { fleteCalculado: 0, fleteDescripcion: '', metodoAplicado: '', multiplicadoPorBultos: false };
    
    const peso = parseFloat(formData.peso_kg) || 0;
    const precioBase = Number(selectedTarifa.precio_base) || 0;
    const rangos = (selectedTarifa as any).rangos_precios || {};
    const rangosKg: { desde: number; hasta: number; precio: number }[] = 
      Array.isArray((selectedTarifa as any).rangos_kg) ? (selectedTarifa as any).rangos_kg : [];
    const umbralVolumen = (selectedTarifa as any).umbral_volumen_cm || 50;
    const precioM3 = Number(selectedTarifa.precio_por_m3) || 0;
    const cantidadBultos = parseInt(formData.cantidad_bultos) || 1;
    const multiplicarPorBultos = (selectedTarifa as any).multiplicar_flete_por_bultos === true;
    
    let flete = 0;
    let descripcion = '';
    let metodo = '';
    
    // Verificar primero si aplica cobro por volumen (tiene prioridad si las dimensiones exceden umbral)
    if (selectedTarifa.tipo_tarifa === 'peso' && formData.dimensiones && precioM3 > 0) {
      const dims = formData.dimensiones.split('x').map(d => parseFloat(d.trim())).filter(d => !isNaN(d));
      if (dims.length === 3 && dims.some(d => d > umbralVolumen)) {
        const volumen = dims.reduce((a, b) => a * b, 1) / 1000000;
        flete = precioBase + (volumen * precioM3);
        descripcion = `Cobro por m³ (dimensión > ${umbralVolumen}cm)`;
        metodo = 'volumen_excedido';
      }
    }
    
    // Cálculo según tipo de tarifa (si no se aplicó volumen)
    if (metodo === '') {
      if (selectedTarifa.tipo_tarifa === 'peso') {
        // PRIORIDAD 1: Rangos escalonados (rangos_kg)
        if (rangosKg.length > 0 && peso > 0) {
          const rangoAplicable = rangosKg.find(r => peso >= r.desde && peso <= r.hasta);
          if (rangoAplicable) {
            flete = rangoAplicable.precio;
            descripcion = `Rango ${rangoAplicable.desde}-${rangoAplicable.hasta} kg`;
            metodo = 'rangos_kg';
          } else {
            // Peso excede todos los rangos
            const ultimoRango = rangosKg[rangosKg.length - 1];
            if (ultimoRango && peso > ultimoRango.hasta) {
              flete = ultimoRango.precio;
              descripcion = `Peso ${peso}kg excede máximo (${ultimoRango.hasta}kg)`;
              metodo = 'rangos_kg_excedido';
            }
          }
        }
        
        // PRIORIDAD 2: Método simple (base + adicional por kg)
        if (metodo === '') {
          const pesoBaseHasta = rangos.peso_base_hasta || 0;
          const adicionalPorKg = rangos.adicional_por_kg || 0;
          
          if (peso > pesoBaseHasta && adicionalPorKg > 0) {
            const kgExtra = peso - pesoBaseHasta;
            flete = precioBase + (kgExtra * adicionalPorKg);
            descripcion = `Base + ${kgExtra.toFixed(1)}kg extra`;
            metodo = 'peso_simple';
          } else {
            // Peso dentro del rango base
            flete = precioBase;
            descripcion = 'Precio base';
            metodo = 'base';
          }
        }
      } else if (selectedTarifa.tipo_tarifa === 'distancia') {
        const distancia = distanciaKm || 0;
        flete = distancia * (Number(selectedTarifa.precio_por_km) || 0);
        descripcion = `${distancia.toFixed(1)} km`;
        metodo = 'distancia';
      } else if (selectedTarifa.tipo_tarifa === 'volumen') {
        const volumen = parseFloat(formData.dimensiones) || 0;
        const volBaseHasta = rangos.volumen_base_hasta || 0;
        const adicionalPorM3 = rangos.adicional_por_m3 || 0;
        
        if (volumen > volBaseHasta) {
          flete = precioBase + ((volumen - volBaseHasta) * adicionalPorM3);
          descripcion = `${volumen.toFixed(2)} m³`;
          metodo = 'volumen';
        } else {
          flete = precioBase;
          descripcion = 'Precio base';
          metodo = 'base';
        }
      } else {
        flete = precioBase;
        descripcion = 'Precio base';
        metodo = 'base';
      }
    }
    
    // Sumar monto del concepto "Flete" si existe (para unificar en una sola línea)
    const conceptoFlete = conceptosBasicos.find(cp => {
      const codigo = cp.concepto?.codigo?.toLowerCase();
      const nombre = cp.concepto?.nombre?.toLowerCase();
      return codigo === 'flete' || nombre === 'flete';
    });
    if (conceptoFlete) {
      const montoConceptoFlete = Number(conceptoFlete.monto) || 0;
      if (montoConceptoFlete > 0) {
        flete += montoConceptoFlete;
      }
    }
    
    // Aplicar multiplicación por bultos o porcentaje por bulto extra
    let fleteTotal = flete;
    let descripcionFinal = descripcion;
    const debeMultiplicar = multiplicarPorBultos && cantidadBultos > 1;
    
    if (debeMultiplicar) {
      fleteTotal = flete * cantidadBultos;
      descripcionFinal = `${descripcion} × ${cantidadBultos} bultos`;
    } else if (!multiplicarPorBultos && cantidadBultos > 1) {
      const pctBulto = Number((selectedTarifa as any).porcentaje_flete_bulto) || 0;
      if (pctBulto > 0) {
        const recargo = flete * (pctBulto / 100) * (cantidadBultos - 1);
        fleteTotal = flete + recargo;
        descripcionFinal = `${descripcion} + ${pctBulto}% × ${cantidadBultos - 1} bulto(s)`;
      }
    }
    
    return { 
      fleteCalculado: fleteTotal, 
      fleteDescripcion: descripcionFinal, 
      metodoAplicado: metodo,
      multiplicadoPorBultos: debeMultiplicar
    };
  }, [selectedTarifa, formData.peso_kg, formData.dimensiones, formData.cantidad_bultos, distanciaKm, conceptosBasicos]);

  // Memoizar precio total calculado
  const precioCalculado = useMemo(() => {
    return fleteCalculado + totalConceptosBasicos + totalConceptosAdicionales;
  }, [fleteCalculado, totalConceptosBasicos, totalConceptosAdicionales]);

  // Toggle concepto adicional selection
  const toggleConceptoAdicional = (conceptoId: string) => {
    setConceptosSeleccionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conceptoId)) {
        newSet.delete(conceptoId);
      } else {
        newSet.add(conceptoId);
      }
      return newSet;
    });
  };

  // Find or create client helper - busca SIEMPRE en la base de datos para evitar duplicados
  const findOrCreateClient = async (data: {
    nombre: string;
    apellido?: string;
    telefono: string;
    email?: string;
    direccion: string;
    ciudad?: string;
    codigo_postal?: string;
    dni_cuit?: string;
    sucursal_id?: string | null;
  }) => {
    // 1. Buscar PRIMERO en la base de datos por DNI/CUIT (más confiable que la caché)
    if (data.dni_cuit && data.dni_cuit.trim()) {
      const { data: clientByDni, error: dniError } = await supabase
        .from('clientes')
        .select('*')
        .ilike('dni_cuit', data.dni_cuit.trim())
        .limit(1)
        .maybeSingle();
      
      if (dniError) {
        console.error('Error buscando cliente por DNI:', dniError);
      }
      
      if (clientByDni) {
        // Actualizar datos del cliente existente
        const { error: updateError } = await supabase
          .from('clientes')
          .update({
            nombre: data.nombre,
            apellido: data.apellido || clientByDni.apellido,
            email: data.email || clientByDni.email,
            direccion: data.direccion || clientByDni.direccion,
            ciudad: data.ciudad || clientByDni.ciudad,
            codigo_postal: data.codigo_postal || clientByDni.codigo_postal,
            telefono: data.telefono || clientByDni.telefono,
            updated_at: new Date().toISOString(),
          })
          .eq('id', clientByDni.id);

        if (updateError) throw updateError;
        return clientByDni.id;
      }
    }
    
    // 2. Buscar por nombre+dirección (case-insensitive) para evitar duplicados por el índice único
    if (data.nombre && data.direccion) {
      const { data: clientByNameAddr, error: nameAddrError } = await supabase
        .from('clientes')
        .select('*')
        .ilike('nombre', data.nombre.trim())
        .ilike('direccion', data.direccion.trim())
        .limit(1)
        .maybeSingle();
      
      if (nameAddrError) {
        console.error('Error buscando cliente por nombre+dirección:', nameAddrError);
      }
      
      if (clientByNameAddr) {
        const { error: updateError } = await supabase
          .from('clientes')
          .update({
            apellido: data.apellido || clientByNameAddr.apellido,
            telefono: data.telefono || clientByNameAddr.telefono,
            email: data.email || clientByNameAddr.email,
            ciudad: data.ciudad || clientByNameAddr.ciudad,
            codigo_postal: data.codigo_postal || clientByNameAddr.codigo_postal,
            dni_cuit: data.dni_cuit || clientByNameAddr.dni_cuit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', clientByNameAddr.id);

        if (updateError) throw updateError;
        return clientByNameAddr.id;
      }
    }

    // 4. Solo si no existe, crear nuevo cliente
    const tenantId = profile?.tenant_id ?? null;
    if (!tenantId) {
      throw new Error('No se pudo determinar el tenant del usuario. Cerrá sesión e ingresá nuevamente.');
    }

    // Si no viene sucursal, asignamos la del usuario para asegurar visibilidad y evitar bloqueos por RLS
    const sucursalIdToUse = data.sucursal_id ?? profile?.sucursal_id ?? null;

    try {
      const { data: newClient, error: createError } = await supabase
        .from('clientes')
        .insert({
          nombre: data.nombre,
          apellido: data.apellido,
          telefono: data.telefono,
          email: data.email,
          direccion: data.direccion,
          ciudad: data.ciudad,
          codigo_postal: data.codigo_postal,
          dni_cuit: data.dni_cuit,
          sucursal_id: sucursalIdToUse,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (createError) {
        // Si es error de duplicado (23505), intentar recuperar el cliente existente
        if (createError.code === '23505') {
          console.warn('Cliente duplicado detectado, recuperando existente...', createError.message);
          
          // Buscar por nombre+dirección como fallback
          const { data: existingClient } = await supabase
            .from('clientes')
            .select('id')
            .ilike('nombre', data.nombre.trim())
            .ilike('direccion', data.direccion.trim())
            .limit(1)
            .maybeSingle();
          
          if (existingClient) {
            return existingClient.id;
          }
          
          // Si tampoco encuentra, buscar por DNI
          if (data.dni_cuit) {
            const { data: existByDni } = await supabase
              .from('clientes')
              .select('id')
              .ilike('dni_cuit', data.dni_cuit.trim())
              .limit(1)
              .maybeSingle();
            if (existByDni) return existByDni.id;
          }
          
          throw new Error(`No se pudo crear ni encontrar el cliente. Verifique los datos e intente nuevamente.`);
        }
        throw createError;
      }
      return newClient.id;
    } catch (err: any) {
      // Re-throw errors ya manejados
      if (err.message?.includes('No se pudo crear ni encontrar')) throw err;
      if (err.code === '23505') {
        // Último intento de recuperación
        const { data: fallbackClient } = await supabase
          .from('clientes')
          .select('id')
          .ilike('nombre', data.nombre.trim())
          .ilike('direccion', data.direccion.trim())
          .limit(1)
          .maybeSingle();
        if (fallbackClient) return fallbackClient.id;
      }
      throw err;
    }
  };

  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      if (!sucursalOrigenId) {
        throw new Error('No tienes una sucursal asignada. Contacta al administrador.');
      }

      if (!profile?.tenant_id) {
        throw new Error('No se pudo determinar tu empresa (tenant). Cerrá sesión e ingresá nuevamente.');
      }

      // Coverage zone validation
      if (hasCoverageRestrictions) {
        let coverageError: string | null = null;

        if (esRetiroAlmacenaje) {
          // No coverage check for storage pickups (destination is same branch)
        } else if (tieneEntrega) {
          // Delivery to door: check destination city/province/CP
          coverageError = validateDestination({
            ciudad: formData.destinatario_ciudad,
            provincia: null, // Province not collected in form, check by city/CP
            codigo_postal: formData.destinatario_codigo_postal,
          });
        } else if (formData.sucursal_destino_id) {
          // Delivery to branch: check destination branch city
          const sucursalDestino = sucursales.find(s => s.id === formData.sucursal_destino_id);
          if (sucursalDestino) {
            coverageError = validateDestination({
              ciudad: sucursalDestino.ciudad,
              provincia: null,
              codigo_postal: null,
            });
          }
        }

        if (coverageError) {
          throw new Error(coverageError);
        }
      }

      // Determinar la dirección del remitente
      const remitenteDireccion = tieneRetiro ? formData.remitente_direccion : (sucursalUsuario?.direccion || '');
      const remitenteCiudad = tieneRetiro ? formData.remitente_ciudad : (sucursalUsuario?.ciudad || '');
      const remitenteCp = tieneRetiro ? formData.remitente_codigo_postal : '';

      // 1. Find or create remitente
      const remitenteId = await findOrCreateClient({
        nombre: formData.remitente_nombre,
        apellido: formData.remitente_apellido,
        telefono: formData.remitente_telefono,
        email: formData.remitente_email,
        direccion: remitenteDireccion,
        ciudad: remitenteCiudad,
        codigo_postal: remitenteCp,
        dni_cuit: formData.remitente_dni,
        sucursal_id: sucursalOrigenId,
      });

      // Determinar la dirección del destinatario
      let destinatarioDireccion = '';
      let destinatarioCiudad = '';
      let destinatarioCp = '';
      let sucursalDestinoId: string | null = null;

      if (esRetiroAlmacenaje) {
        // Retiro para almacenaje: el destino es la sucursal de origen
        sucursalDestinoId = sucursalOrigenId;
        destinatarioDireccion = sucursalUsuario?.direccion || '';
        destinatarioCiudad = sucursalUsuario?.ciudad || '';
      } else if (tieneEntrega) {
        // Entrega a domicilio
        destinatarioDireccion = formData.destinatario_direccion;
        destinatarioCiudad = formData.destinatario_ciudad;
        destinatarioCp = formData.destinatario_codigo_postal;
      } else {
        // Retiro en sucursal
        sucursalDestinoId = formData.sucursal_destino_id || null;
        const sucursalDestino = sucursales.find(s => s.id === sucursalDestinoId);
        destinatarioDireccion = sucursalDestino?.direccion || '';
        destinatarioCiudad = sucursalDestino?.ciudad || '';
      }

      // 2. Find or create destinatario
      // cliente_cta_cte_id es quien PAGA, NO el destinatario físico.
      // Solo se usa como destinatario en retiro_almacenaje.
      let destinatarioId: string | null = null;
      
      if (esRetiroAlmacenaje) {
        // Para retiro almacenaje, el cliente con cta cte es el destinatario (almacena en sucursal)
        destinatarioId = formData.cliente_cta_cte_id || remitenteId;
      } else {
        destinatarioId = await findOrCreateClient({
          nombre: formData.destinatario_nombre,
          apellido: formData.destinatario_apellido,
          telefono: formData.destinatario_telefono,
          email: formData.destinatario_email,
          direccion: destinatarioDireccion,
          ciudad: destinatarioCiudad,
          codigo_postal: destinatarioCp,
          dni_cuit: formData.destinatario_dni,
          sucursal_id: sucursalDestinoId,
        });
      }

      // 3. Generate tracking number with sucursal code
      const { data: trackingData, error: trackingError } = await supabase
        .rpc('generate_tracking_number', { p_sucursal_id: sucursalOrigenId });

      if (trackingError) throw trackingError;

      const precioTotal = precioCalculado;

      // 4. Create shipment with all new fields
      // Estado inicial: si no requiere retiro (paquete ya en sucursal) → en_sucursal
      // Si requiere retiro (hay que ir a buscar) → pendiente
      const estadoInicial = tieneRetiro ? 'pendiente' : 'en_sucursal';
      
      const { data: envio, error: envioError } = await supabase
        .from('envios')
        .insert({
          tracking_number: trackingData,
          estado: estadoInicial,
          remitente_id: remitenteId,
          destinatario_id: destinatarioId,
          sucursal_origen_id: sucursalOrigenId,
          sucursal_destino_id: sucursalDestinoId,
          tarifa_id: formData.tarifa_id || null,
          tipo_pago: formData.tipo_pago,
          descripcion: formData.descripcion,
          peso_kg: parseFloat(formData.peso_kg) || null,
          dimensiones: formData.dimensiones,
          valor_declarado: parseFloat(formData.valor_declarado) || null,
          precio_total: precioTotal,
          precio_tarifa_vigente: precioTotal,
          pago_contra_entrega: formData.tipo_pago === 'destino' ? true : formData.pago_contra_entrega,
          notas: formData.notas,
          created_by: user?.id,
          tenant_id: profile?.tenant_id,
          // Service type
          tipo_servicio_detalle: tipoServicioDetalle,
          cantidad_bultos: parseInt(formData.cantidad_bultos) || 1,
          // Legacy field for backwards compatibility
          tipo_servicio: tieneRetiro ? 'solo_retiro' : 'envio_completo',
          requiere_retiro: tieneRetiro,
          // Pickup info
          fecha_retiro: tieneRetiro && formData.fecha_retiro ? formData.fecha_retiro : null,
          horario_retiro: tieneRetiro ? formData.horario_retiro : null,
          notas_retiro: tieneRetiro ? formData.notas_retiro : null,
          direccion_retiro: tieneRetiro ? formData.remitente_direccion : null,
          ciudad_retiro: tieneRetiro ? formData.remitente_ciudad : null,
          cp_retiro: tieneRetiro ? formData.remitente_codigo_postal : null,
          remitente_lat: origenCoords?.lat || null,
          remitente_lng: origenCoords?.lng || null,
          // Delivery info
          direccion_entrega: tieneEntrega ? formData.destinatario_direccion : null,
          ciudad_entrega: tieneEntrega ? formData.destinatario_ciudad : null,
          cp_entrega: tieneEntrega ? formData.destinatario_codigo_postal : null,
          dias_preferidos_entrega: diasPreferidos.length > 0 ? diasPreferidos : null,
          horario_preferido_entrega: formData.horario_preferido_entrega,
          destinatario_lat: destinoCoords?.lat || null,
          destinatario_lng: destinoCoords?.lng || null,
          // Distance
          distancia_km: distanciaKm,
          // IDs and contact info
          codigo_postal_origen: remitenteCp || null,
          codigo_postal_destino: destinatarioCp || null,
          dni_remitente: formData.remitente_dni || null,
          dni_destinatario: formData.destinatario_dni || null,
          whatsapp_destinatario: formData.destinatario_whatsapp || null,
          email_destinatario: formData.destinatario_email || null,
          nombre_destinatario: [formData.destinatario_nombre, formData.destinatario_apellido].filter(Boolean).join(' ') || null,
          nombre_remitente: [formData.remitente_nombre, formData.remitente_apellido].filter(Boolean).join(' ') || null,
        })
        .select()
        .single();

      if (envioError) throw envioError;

      // 5. Create shipment details by concept (solo los filtrados según tipo de servicio)
      // Build shipment details with REAL calculated amounts
      const valorDeclaradoReal = parseFloat(formData.valor_declarado) || 
        (configSeguro?.valor_minimo_declarado || 0);
      const cantidadBultosReal = parseInt(formData.cantidad_bultos) || 1;
      
      // Find the "Flete" concept from catalog
      const conceptoFlete = conceptos.find(c => 
        c.codigo?.toLowerCase() === 'flete' || 
        c.nombre?.toLowerCase() === 'flete'
      );
      
      const detallesEnvio: Array<{envio_id: string; concepto_id: string | null; nombre_concepto: string; monto: number}> = [];
      
      // 1. Add FLETE as explicit concept (always if calculated flete > 0)
      if (fleteCalculado > 0) {
        detallesEnvio.push({
          envio_id: envio.id,
          concepto_id: conceptoFlete?.id || null,
          nombre_concepto: 'Flete',
          monto: fleteCalculado,
        });
      }
      
      // 2. Add other concepts with CALCULATED amounts
      conceptosPreciosFiltrados.forEach((cp) => {
        // Skip flete if already included above (avoid duplicates)
        const conceptoCode = cp.concepto?.codigo?.toLowerCase();
        const conceptoName = cp.concepto?.nombre?.toLowerCase();
        if (conceptoCode?.includes('flete') || conceptoName?.includes('flete')) {
          return;
        }
        
        let montoConcepto = 0;
        // Use operator-entered amount for editable concepts
        if (cp.concepto?.monto_editable && montosEditables[cp.concepto_id]) {
          montoConcepto = parseFloat(montosEditables[cp.concepto_id]) || 0;
        } else if (cp.es_porcentaje && cp.porcentaje) {
          // Calculate percentage-based amount from declared value
          montoConcepto = valorDeclaradoReal * Number(cp.porcentaje) / 100;
        } else {
          montoConcepto = Number(cp.monto);
        }
        
        // Multiply by package count if configured
        if (cp.multiplicar_por_bultos) {
          montoConcepto *= cantidadBultosReal;
        }
        
        if (montoConcepto > 0) {
          detallesEnvio.push({
            envio_id: envio.id,
            concepto_id: cp.concepto_id,
            nombre_concepto: cp.concepto?.nombre || 'Sin nombre',
            monto: montoConcepto,
          });
        }
      });
      
      if (detallesEnvio.length > 0) {
        const { error: detallesError } = await supabase
          .from('envio_detalles')
          .insert(detallesEnvio);
        if (detallesError) throw detallesError;
      }

      // 6. If cuenta corriente, create movement
      // IMPORTANTE: Este paso es NO BLOQUEANTE. Si falla, el envío ya fue creado
      // correctamente y se muestra una advertencia sin interrumpir el flujo.
      let ctaCteWarning: string | null = null;
      
      if (formData.tipo_pago === 'cuenta_corriente' && formData.cliente_cta_cte_id) {
        try {
          // Detectar si el cliente es un seller → cargar en seller_cuenta_corriente
          const sellerVinculado = getSellerForCliente(formData.cliente_cta_cte_id);

          if (sellerVinculado) {
            // Es un seller: cargar en seller_cuenta_corriente y actualizar ecommerce_sellers
            const { data: sellerActual } = await supabase
              .from('ecommerce_sellers')
              .select('saldo_cuenta_corriente')
              .eq('id', sellerVinculado.id)
              .single();

            const saldoAnterior = Number(sellerActual?.saldo_cuenta_corriente) || 0;
            const saldoNuevo = saldoAnterior + precioTotal;

            const { error: movError } = await supabase
              .from('seller_cuenta_corriente')
              .insert({
                seller_id: sellerVinculado.id,
                envio_id: envio.id,
                tipo: 'cargo',
                monto: precioTotal,
                saldo_anterior: saldoAnterior,
                saldo_nuevo: saldoNuevo,
                descripcion: `Envío ${trackingData} (manual)`,
                created_by: user?.id,
              });

            if (movError) throw movError;

            const { error: updateSellerError } = await supabase
              .from('ecommerce_sellers')
              .update({ saldo_cuenta_corriente: saldoNuevo })
              .eq('id', sellerVinculado.id);

            if (updateSellerError) throw updateSellerError;

            // También sincronizar el saldo en clientes para consistencia visual
            const { error: syncClienteError } = await supabase
              .from('clientes')
              .update({ saldo_cuenta_corriente: saldoNuevo })
              .eq('id', formData.cliente_cta_cte_id);

            if (syncClienteError) throw syncClienteError;
          } else {
            // Es un cliente común: cargar en cliente_cuenta_corriente
            const { data: cliente } = await supabase
              .from('clientes')
              .select('saldo_cuenta_corriente')
              .eq('id', formData.cliente_cta_cte_id)
              .single();

            const saldoAnterior = Number(cliente?.saldo_cuenta_corriente) || 0;
            const saldoNuevo = saldoAnterior + precioTotal;

            const { error: movError } = await supabase
              .from('cliente_cuenta_corriente')
              .insert({
                cliente_id: formData.cliente_cta_cte_id,
                envio_id: envio.id,
                tipo: 'cargo',
                monto: precioTotal,
                saldo_anterior: saldoAnterior,
                saldo_nuevo: saldoNuevo,
                descripcion: `Envío ${trackingData}`,
                created_by: user?.id,
              });

            if (movError) throw movError;

            const { error: updateError } = await supabase
              .from('clientes')
              .update({ saldo_cuenta_corriente: saldoNuevo })
              .eq('id', formData.cliente_cta_cte_id);

            if (updateError) throw updateError;
          }
        } catch (ctaCteError: any) {
          // El envío fue creado exitosamente. El movimiento de cta cte falló.
          // NO interrumpir el flujo — guardar advertencia para mostrar en onSuccess.
          console.error('[CTA CTE] Error registrando movimiento de cuenta corriente:', ctaCteError);
          ctaCteWarning = ctaCteError?.message || 'Error desconocido';
          // Adjuntar la advertencia al objeto envio para que onSuccess pueda leerla
          (envio as any).__ctaCteWarning = ctaCteWarning;
        }
      }

      return envio;
    },
    onSuccess: (data) => {
      // Clear draft — protected to never block navigation
      try { clearDraft(); } catch (e) { console.error('[NewShipment] Error clearing draft:', e); }
      
      // Clear persisted auxiliary states
      try {
        sessionStorage.removeItem('ns-tipo-servicio');
        sessionStorage.removeItem('ns-dias-preferidos');
      } catch (e) { console.error('[NewShipment] Error clearing persisted state:', e); }

      try {
        queryClient.invalidateQueries({ queryKey: ['envios'] });
        queryClient.invalidateQueries({ queryKey: ['all_clients'] });
        queryClient.invalidateQueries({ queryKey: ['clientes_cta_cte'] });
      } catch (e) { console.error('[NewShipment] Error invalidating queries:', e); }

      // Fire-and-forget: send email notification if email is available
      if (data.email_destinatario && profile?.tenant_id) {
        import('@/lib/emailNotifications').then(({ sendShipmentEmail }) => {
          sendShipmentEmail({
            tenant_id: profile.tenant_id!,
            to: data.email_destinatario!,
            template: 'shipment_created',
            data: {
              tracking_number: data.tracking_number,
              nombre_destinatario: data.nombre_destinatario || '',
              direccion_entrega: data.direccion_entrega || '',
              pago_contra_entrega: formData.tipo_pago === 'destinatario' || formData.tipo_pago === 'contado',
              precio_total: data.precio_total,
              tracking_url: `${window.location.origin}/tracking?q=${data.tracking_number}`,
            },
          });
        }).catch(() => {});
      }
      
      // Si es pago contado, mostrar modal para seleccionar método de pago
      if (formData.tipo_pago === 'contado') {
        try {
          setCreatedEnvio({
            id: data.id,
            tracking_number: data.tracking_number,
            precio_total: data.precio_total,
            remitente_id: data.remitente_id || '',
          });
          setShowPaymentModal(true);
        } catch (e) {
          console.error('[NewShipment] Error showing payment modal:', e);
          setSucursalDestinoOpen(false);
          if (!navigationAttemptedRef.current) {
            navigationAttemptedRef.current = true;
            navigate(`/print-label?id=${data.id}`);
          }
        }
      } else {
        // Para cuenta corriente o destinatario, redirigir directamente
        const ctaCteWarning = (data as any).__ctaCteWarning;
        if (ctaCteWarning) {
          toast({
            title: '⚠️ Envío creado con advertencia',
            description: `Tracking: ${data.tracking_number}. El envío fue creado correctamente pero no se pudo registrar el movimiento de cuenta corriente. Por favor, regístrelo manualmente.`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: '¡Envío creado!',
            description: `Tracking: ${data.tracking_number}. Redirigiendo a etiqueta...`,
          });
        }
        // Close any open popovers before navigating
        setSucursalDestinoOpen(false);
        if (!navigationAttemptedRef.current) {
          navigationAttemptedRef.current = true;
          navigate(`/print-label?id=${data.id}`);
        }
      }
    },
    onSettled: (data, error) => {
      // Safety net: if mutation succeeded but user is still on this page after 3s, force navigate
      if (data && !error && formData.tipo_pago !== 'contado') {
        const envioId = data.id;
        setTimeout(() => {
          if (window.location.pathname.includes('/shipments/new')) {
            console.warn('[NewShipment] Safety net: forcing navigation to print-label');
            navigate(`/print-label?id=${envioId}`, { replace: true });
          }
        }, 3000);
      }
    },
    onError: (error) => {
      toast({
        title: 'Error al crear envío',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Guard contra doble-submit
    if (createShipmentMutation.isPending || navigationAttemptedRef.current) return;
    navigationAttemptedRef.current = false;
    // Validar que haya caja abierta
    if (!cajaAbierta) {
      toast({
        title: 'No hay caja abierta',
        description: 'Debes abrir una sesión de caja antes de crear envíos.',
        variant: 'destructive',
      });
      return;
    }
    
    // Validations
    if (!sucursalOrigenId) {
      toast({
        title: 'Sin sucursal asignada',
        description: 'No tienes una sucursal asignada. Contacta al administrador.',
        variant: 'destructive',
      });
      return;
    }

    if (tieneRetiro && !formData.fecha_retiro) {
      toast({
        title: 'Fecha requerida',
        description: 'Debes seleccionar una fecha para el retiro',
        variant: 'destructive',
      });
      return;
    }

    if (tieneRetiro && !formData.remitente_direccion) {
      toast({
        title: 'Dirección requerida',
        description: 'Debes ingresar la dirección del remitente para el retiro',
        variant: 'destructive',
      });
      return;
    }

    if (tieneEntrega && !formData.destinatario_direccion) {
      toast({
        title: 'Dirección requerida',
        description: 'Debes ingresar la dirección de entrega',
        variant: 'destructive',
      });
      return;
    }

    if (!tieneEntrega && !esRetiroAlmacenaje && !formData.sucursal_destino_id) {
      toast({
        title: 'Sucursal destino requerida',
        description: 'Debes seleccionar la sucursal de destino',
        variant: 'destructive',
      });
      return;
    }

    if (esRetiroAlmacenaje && !formData.cliente_cta_cte_id) {
      toast({
        title: 'Cliente requerido',
        description: 'Debes seleccionar un cliente con cuenta corriente para el retiro',
        variant: 'destructive',
      });
      return;
    }

    // Validar que haya tarifa seleccionada con precio válido
    if (!formData.tarifa_id) {
      toast({
        title: 'Tarifa requerida',
        description: 'Debes seleccionar una tarifa para el envío',
        variant: 'destructive',
      });
      return;
    }

    if (precioCalculado <= 0) {
      toast({
        title: 'Precio inválido',
        description: 'El precio del envío debe ser mayor a $0. Verifica que la tarifa tenga precios configurados.',
        variant: 'destructive',
      });
      return;
    }
    
    createShipmentMutation.mutate();
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLoadSenderClient = (client: Client) => {
    setClientLoadedManually(prev => ({ ...prev, remitente: true }));
    setFormData(prev => ({
      ...prev,
      remitente_nombre: client.nombre,
      remitente_apellido: client.apellido || '',
      remitente_telefono: client.telefono,
      remitente_email: client.email || '',
      remitente_direccion: client.direccion,
      remitente_ciudad: client.ciudad || '',
      remitente_codigo_postal: client.codigo_postal || '',
      remitente_dni: client.dni_cuit || '',
    }));
    
    // Establecer coordenadas si el cliente las tiene guardadas
    if (client.lat && client.lng) {
      setOrigenCoords({ lat: client.lat, lng: client.lng });
    }
    
    toast({
      title: 'Cliente cargado',
      description: `Datos de ${client.nombre} cargados como remitente`,
    });
  };

  const handleLoadRecipientClient = (client: Client) => {
    setClientLoadedManually(prev => ({ ...prev, destinatario: true }));
    setFormData(prev => ({
      ...prev,
      destinatario_nombre: client.nombre,
      destinatario_apellido: client.apellido || '',
      destinatario_telefono: client.telefono,
      destinatario_email: client.email || '',
      destinatario_direccion: client.direccion,
      destinatario_ciudad: client.ciudad || '',
      destinatario_codigo_postal: client.codigo_postal || '',
      destinatario_dni: client.dni_cuit || '',
    }));
    
    // Establecer coordenadas si el cliente las tiene guardadas
    if (client.lat && client.lng) {
      setDestinoCoords({ lat: client.lat, lng: client.lng });
    }
    
    toast({
      title: 'Cliente cargado',
      description: `Datos de ${client.nombre} cargados como destinatario`,
    });
  };

  const toggleDiaPreferido = (dia: string) => {
    setDiasPreferidos(prev => 
      prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]
    );
  };

  // Handle payment confirmation
  const handlePaymentConfirm = async (method: 'efectivo' | 'mercado_pago' | 'transferencia' | 'tarjeta', reference: string) => {
    if (!createdEnvio) return;
    
    setIsProcessingPayment(true);
    try {
      const { error } = await supabase.from('pagos').insert({
        envio_id: createdEnvio.id,
        cliente_id: createdEnvio.remitente_id || null,
        monto: createdEnvio.precio_total,
        metodo: method,
        referencia: reference || null,
        estado: 'pagado',
        created_by: user?.id,
      });

      if (error) throw error;

      // Register cash movement if there's an open cash session
      if (cajaAbierta?.id) {
        await supabase.from('movimientos_caja').insert({
          sesion_caja_id: cajaAbierta.id,
          tipo: 'ingreso',
          concepto: `Cobro contado envío ${createdEnvio.tracking_number}`,
          monto: createdEnvio.precio_total,
          metodo_pago: method,
          referencia: reference || `Envío ${createdEnvio.tracking_number}`,
          created_by: user?.id,
        });
      }

      toast({
        title: '¡Pago registrado!',
        description: `Tracking: ${createdEnvio.tracking_number}. Redirigiendo a etiqueta...`,
      });
      
      setShowPaymentModal(false);
      setSucursalDestinoOpen(false);
      if (!navigationAttemptedRef.current) {
        navigationAttemptedRef.current = true;
        navigate(`/print-label?id=${createdEnvio.id}`);
      }
    } catch (error: any) {
      toast({
        title: 'Error al registrar pago',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Handle address selection from Google Maps autocomplete
  const handleRemitenteAddressSelect = (details: AddressDetails) => {
    setFormData(prev => ({
      ...prev,
      remitente_direccion: details.address || details.formattedAddress,
      remitente_ciudad: details.city || prev.remitente_ciudad,
      remitente_codigo_postal: details.postalCode || prev.remitente_codigo_postal,
    }));
    // Defer coords update to avoid cascading re-renders with distance calc (Chrome fix)
    setTimeout(() => {
      setOrigenCoords({ lat: details.lat, lng: details.lng });
    }, 0);
  };

  const handleDestinatarioAddressSelect = (details: AddressDetails) => {
    setFormData(prev => ({
      ...prev,
      destinatario_direccion: details.address || details.formattedAddress,
      destinatario_ciudad: details.city || prev.destinatario_ciudad,
      destinatario_codigo_postal: details.postalCode || prev.destinatario_codigo_postal,
    }));
    // Defer coords update to avoid cascading re-renders with distance calc (Chrome fix)
    setTimeout(() => {
      setDestinoCoords({ lat: details.lat, lng: details.lng });
    }, 0);
  };

  // Update destination coords and city/postal when sucursal destino changes
  useEffect(() => {
    if (!tieneEntrega && formData.sucursal_destino_id) {
      const sucursalDestino = sucursales.find(s => s.id === formData.sucursal_destino_id);
      if (sucursalDestino) {
        if (sucursalDestino.lat && sucursalDestino.lng) {
          setDestinoCoords({ lat: sucursalDestino.lat, lng: sucursalDestino.lng });
        }
        const newCiudad = sucursalDestino.ciudad || '';
        setFormData(prev => {
          if (prev.destinatario_ciudad === newCiudad) return prev;
          return { ...prev, destinatario_ciudad: newCiudad };
        });
      }
    }
  }, [formData.sucursal_destino_id, sucursales, tieneEntrega]);

  // Calculate distance when both coordinates are available
  useEffect(() => {
    const calculateDistance = async () => {
      if (!origenCoords || !destinoCoords) {
        setDistanciaKm(null);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('calculate-distance', {
          body: {
            origin: origenCoords,
            destination: destinoCoords,
          },
        });

        if (!error && data?.distance_km) {
          setDistanciaKm(data.distance_km);
        }
      } catch (err) {
        console.error('Error calculating distance:', err);
      }
    };

    calculateDistance();
  }, [origenCoords, destinoCoords]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  const today = new Date().toISOString().split('T')[0];

  // Loading state while essential data loads
  if (!user || !profile || loadingSucursalUsuario || loadingTarifas) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Cargando formulario...</p>
        </div>
      </div>
    );
  }

  // Si no tiene sucursal asignada, mostrar mensaje
  if (!loadingSucursalUsuario && !sucursalOrigenId) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Nuevo Envío</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No tienes una sucursal asignada. Contacta al administrador para que te asigne una sucursal antes de poder crear envíos.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-24">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-envios" />
            Nuevo Envío
          </h1>
          {sucursalUsuario && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              {sucursalUsuario.codigo && `${sucursalUsuario.codigo} - `}{sucursalUsuario.nombre}
            </Badge>
          )}
          <DraftSavingIndicator hasDraft={hasDraft} lastSaved={lastSaved} />
        </div>
        {selectedTarifa && (
          <Badge className="text-base px-3 py-1.5 bg-envios hover:bg-envios">
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            {formatCurrency(precioCalculado)}
          </Badge>
        )}
      </div>

      {/* Alerts row */}
      <div className="space-y-2 mb-3">
        {isDraftRecovered && (
          <DraftIndicator
            lastSaved={lastSaved}
            onDiscard={discardDraft}
            onDismiss={() => setIsDraftRecovered(false)}
          />
        )}
        {!cajaAbierta && !loadingCaja && sucursalOrigenId && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-3.5 w-3.5" />
            <AlertDescription className="flex items-center justify-between text-xs">
              <span>No hay caja abierta. Debes abrir una sesión de caja antes de crear envíos.</span>
              <Button variant="link" className="p-0 h-auto text-destructive-foreground underline text-xs" onClick={() => navigate('/cash')}>
                Ir a Caja
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {remitenteConCtaCte && formData.tipo_pago !== 'cuenta_corriente' && (
          <Alert className="border-primary bg-primary/5 py-2">
            <Wallet className="h-3.5 w-3.5" />
            <AlertDescription className="flex items-center justify-between text-xs">
              <span>
                <span className="font-medium">✨ Cta. Cte.:</span> {remitenteConCtaCte.nombre}
                {remitenteConCtaCte.saldo_cuenta_corriente !== null && ` — Saldo: ${formatCurrency(Number(remitenteConCtaCte.saldo_cuenta_corriente) || 0)}`}
              </span>
              <Button variant="outline" size="sm" className="h-6 text-xs px-2"
                onClick={() => {
                  handleChange('tipo_pago', 'cuenta_corriente');
                  handleChange('cliente_cta_cte_id', remitenteConCtaCte.id);
                }}
              >
                Usar Cta Cte
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Main 3-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          
          {/* ═══ COLUMN 1: Service Type + Payment ═══ */}
          <div className="space-y-3">
            {/* Tipo de Servicio */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 text-envios" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo de Servicio</span>
              </div>
              <RadioGroup 
                value={tipoServicioDetalle} 
                onValueChange={(v) => {
                  const newValue = v as TipoServicioDetalle;
                  setTipoServicioDetalle(newValue);
                  if (newValue === 'retiro_almacenaje') {
                    handleChange('tipo_pago', 'cuenta_corriente');
                  }
                }}
                className="grid grid-cols-1 gap-1.5"
              >
                {TIPO_SERVICIO_OPTIONS.map((option) => (
                  <div key={option.value}>
                    <RadioGroupItem value={option.value} id={option.value} className="peer sr-only" />
                    <Label
                      htmlFor={option.value}
                      className={`flex items-center gap-2 rounded-md border border-muted bg-popover px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-envios peer-data-[state=checked]:bg-envios/5 [&:has([data-state=checked])]:border-envios [&:has([data-state=checked])]:bg-envios/5 cursor-pointer ${option.requiresCtaCte ? 'ring-1 ring-primary/30' : ''}`}
                    >
                      <span className="text-base">{option.icon}</span>
                      <span className="font-medium truncate">{option.label}</span>
                      {option.requiresCtaCte && (
                        <Badge variant="outline" className="ml-auto bg-primary/10 text-primary border-primary text-[9px] px-1 py-0">
                          Cta.Cte.
                        </Badge>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Tipo de Pago */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo de Pago</span>
              </div>
              {esRetiroAlmacenaje ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Requiere cuenta corriente</p>
                  <Select
                    value={formData.cliente_cta_cte_id}
                    onValueChange={(v) => {
                      handleChange('cliente_cta_cte_id', v);
                      const selectedClient = clientesCtaCte.find(c => c.id === v);
                      if (selectedClient) {
                        setTimeout(() => handleLoadSenderClient(selectedClient), 0);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientesCtaCte?.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.nombre} {c.apellido} - {formatCurrency(Number(c.saldo_cuenta_corriente) || 0)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button type="button" variant={formData.tipo_pago === 'contado' ? 'default' : 'outline'}
                      className={`h-8 text-xs px-2 ${formData.tipo_pago === 'contado' ? 'bg-success hover:bg-success/90' : ''}`}
                      onClick={() => handleChange('tipo_pago', 'contado')}>
                      Contado
                    </Button>
                    <Button type="button" variant={formData.tipo_pago === 'destino' ? 'default' : 'outline'}
                      className={`h-8 text-xs px-2 ${formData.tipo_pago === 'destino' ? 'bg-warning hover:bg-warning/90' : ''}`}
                      onClick={() => handleChange('tipo_pago', 'destino')}>
                      Destino
                    </Button>
                    <Button type="button" variant={formData.tipo_pago === 'cuenta_corriente' ? 'default' : 'outline'}
                      className={`h-8 text-xs px-2 ${formData.tipo_pago === 'cuenta_corriente' ? 'bg-primary hover:bg-primary/90' : ''}`}
                      onClick={() => handleChange('tipo_pago', 'cuenta_corriente')}>
                      Cta. Cte.
                    </Button>
                  </div>
                  {formData.tipo_pago === 'cuenta_corriente' && (
                    <Select value={formData.cliente_cta_cte_id} onValueChange={(v) => handleChange('cliente_cta_cte_id', v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientesCtaCte?.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.nombre} {c.apellido} - {formatCurrency(Number(c.saldo_cuenta_corriente) || 0)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* Tarifa selector (moved here for visibility) */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-envios" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarifa</span>
              </div>
              {autoSeleccionPorZona ? (
                tarifaFueAutoDetectada && selectedTarifa ? (
                  <div className="p-2 bg-primary/5 border border-primary/20 rounded-md space-y-1">
                    <p className="text-[10px] font-medium text-primary uppercase tracking-wide flex items-center gap-1">
                      <span>✓</span> Auto-detectada
                    </p>
                    <p className="text-xs font-semibold">{selectedTarifa.nombre}</p>
                    {fleteCalculado > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Flete{fleteDescripcion ? ` (${fleteDescripcion})` : ''}: <span className="font-medium text-foreground">${fleteCalculado.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-destructive">Ingresá ciudad destino</p>
                      <p className="text-[10px] text-muted-foreground">Precio automático por zona</p>
                    </div>
                  </div>
                )
              ) : tarifasDisponibles.length > 1 ? (
                <Select value={formData.tarifa_id} onValueChange={(v) => handleChange('tarifa_id', v)} disabled={loadingTarifas}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={loadingTarifas ? "Cargando..." : "Seleccionar tarifa"} />
                  </SelectTrigger>
                  <SelectContent>
                    {tarifasDisponibles.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.nombre} - ${Number(t.precio_base).toLocaleString('es-AR')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : tarifasDisponibles.length === 1 ? (
                <div className="p-2 bg-muted/50 rounded-md">
                  <p className="text-xs font-medium">{tarifasDisponibles[0].nombre} - ${Number(tarifasDisponibles[0].precio_base).toLocaleString('es-AR')}</p>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-2 border rounded-md">
                  {loadingTarifas ? (
                    <span className="flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1" />Cargando...</span>
                  ) : (
                    <>No hay tarifas disponibles<Button variant="outline" size="sm" onClick={() => refetchTarifas()} className="ml-2 h-6 text-[10px]" type="button">Reintentar</Button></>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ═══ COLUMN 2: Remitente ═══ */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remitente</span>
            </div>
            <div className="space-y-2">
              <ContactAutocomplete 
                clients={allClients}
                onSelect={handleLoadSenderClient}
                label=""
                placeholder="Buscar cliente..."
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Nombre *</Label>
                  <Input className="h-8 text-xs" value={formData.remitente_nombre} onChange={(e) => handleChange('remitente_nombre', e.target.value)} required />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Apellido</Label>
                  <Input className="h-8 text-xs" value={formData.remitente_apellido} onChange={(e) => handleChange('remitente_apellido', e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">DNI/CUIT</Label>
                  <Input className="h-8 text-xs" value={formData.remitente_dni}
                    onChange={(e) => { handleChange('remitente_dni', e.target.value); setClientLoadedManually(prev => ({ ...prev, remitente: false })); }}
                    onBlur={(e) => checkExistingClient(e.target.value, 'remitente')}
                    placeholder="12345678" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Teléfono *</Label>
                  <Input className="h-8 text-xs" value={formData.remitente_telefono} onChange={(e) => handleChange('remitente_telefono', e.target.value)} required />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] text-muted-foreground">Email</Label>
                  <Input className="h-8 text-xs" type="email" value={formData.remitente_email} onChange={(e) => handleChange('remitente_email', e.target.value)} />
                </div>
              </div>

              {/* Retiro info */}
              {tieneRetiro && (
                <div className="mt-2 p-2 rounded-md bg-warning/5 border border-warning/20 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Home className="h-3.5 w-3.5 text-warning" />
                    <span className="text-[10px] font-semibold text-warning uppercase">Dirección Retiro</span>
                  </div>
                  <AddressAutocomplete
                    id="remitente_direccion"
                    value={formData.remitente_direccion}
                    onChange={(value) => handleChange('remitente_direccion', value)}
                    onSelect={handleRemitenteAddressSelect}
                    label=""
                    placeholder="Dirección del remitente..."
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Ciudad</Label>
                      <Input className="h-8 text-xs" value={formData.remitente_ciudad} onChange={(e) => handleChange('remitente_ciudad', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">CP</Label>
                      <Input className="h-8 text-xs" value={formData.remitente_codigo_postal} onChange={(e) => handleChange('remitente_codigo_postal', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Fecha Retiro *</Label>
                      <Input className="h-8 text-xs" type="date" min={today} value={formData.fecha_retiro} onChange={(e) => handleChange('fecha_retiro', e.target.value)} required />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Horario</Label>
                      <Select value={formData.horario_retiro} onValueChange={(v) => handleChange('horario_retiro', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Horario" /></SelectTrigger>
                        <SelectContent>
                          {HORARIOS_RETIRO.map((h) => (<SelectItem key={h.value} value={h.value} className="text-xs">{h.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Notas retiro</Label>
                    <Textarea className="min-h-[40px] text-xs" value={formData.notas_retiro} onChange={(e) => handleChange('notas_retiro', e.target.value)} placeholder="Instrucciones..." />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ COLUMN 3: Destinatario ═══ */}
          <div className="border rounded-lg p-3">
            {!esRetiroAlmacenaje ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-success" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destinatario</span>
                </div>
                <div className="space-y-2">
                  <ContactAutocomplete 
                    clients={allClients}
                    onSelect={handleLoadRecipientClient}
                    label=""
                    placeholder="Buscar cliente..."
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Nombre *</Label>
                      <Input className="h-8 text-xs" value={formData.destinatario_nombre} onChange={(e) => handleChange('destinatario_nombre', e.target.value)} required />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Apellido</Label>
                      <Input className="h-8 text-xs" value={formData.destinatario_apellido} onChange={(e) => handleChange('destinatario_apellido', e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">DNI/CUIT</Label>
                      <Input className="h-8 text-xs" value={formData.destinatario_dni}
                        onChange={(e) => { handleChange('destinatario_dni', e.target.value); setClientLoadedManually(prev => ({ ...prev, destinatario: false })); }}
                        onBlur={(e) => checkExistingClient(e.target.value, 'destinatario')} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Teléfono *</Label>
                      <Input className="h-8 text-xs" value={formData.destinatario_telefono} onChange={(e) => handleChange('destinatario_telefono', e.target.value)} required />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">WhatsApp</Label>
                      <Input className="h-8 text-xs" value={formData.destinatario_whatsapp} onChange={(e) => handleChange('destinatario_whatsapp', e.target.value)} placeholder="+54..." />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Email</Label>
                      <Input className="h-8 text-xs" type="email" value={formData.destinatario_email} onChange={(e) => handleChange('destinatario_email', e.target.value)} />
                    </div>
                  </div>

                  {/* Sucursal destino OR Dirección entrega */}
                  {!tieneEntrega ? (
                    <div className="mt-2 p-2 rounded-md bg-muted/50 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">Suc. Destino</span>
                      </div>
                      <Popover open={sucursalDestinoOpen} onOpenChange={setSucursalDestinoOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" aria-expanded={sucursalDestinoOpen} className="w-full justify-between font-normal h-8 text-xs">
                            {formData.sucursal_destino_id
                              ? (() => {
                                  const sel = sucursalesDestino.find(s => s.id === formData.sucursal_destino_id);
                                  return sel ? `${sel.nombre}${sel.ciudad ? ` - ${sel.ciudad}` : ''}` : 'Seleccionar';
                                })()
                              : 'Seleccionar sucursal'}
                            <MapPin className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar sucursal..." className="text-xs" />
                            <CommandList>
                              <CommandEmpty>No encontrada</CommandEmpty>
                              {sucursalesDestino.map((s) => (
                                <CommandItem
                                  key={s.id}
                                  value={`${s.nombre} ${s.ciudad || ''} ${s.codigo || ''}`}
                                  onSelect={() => {
                                    handleChange('sucursal_destino_id', s.id);
                                    setSucursalDestinoOpen(false);
                                  }}
                                  className="text-xs"
                                >
                                  <Building2 className="h-3 w-3 mr-1.5" />
                                  {s.codigo && <span className="font-mono mr-1">{s.codigo}</span>}
                                  {s.nombre}
                                  {s.ciudad && <span className="text-muted-foreground ml-1">({s.ciudad})</span>}
                                </CommandItem>
                              ))}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : (
                    <div className="mt-2 p-2 rounded-md bg-success/5 border border-success/20 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Home className="h-3.5 w-3.5 text-success" />
                        <span className="text-[10px] font-semibold text-success uppercase">Dirección Entrega</span>
                      </div>
                      <AddressAutocomplete
                        id="destinatario_direccion"
                        value={formData.destinatario_direccion}
                        onChange={(value) => handleChange('destinatario_direccion', value)}
                        onSelect={handleDestinatarioAddressSelect}
                        label=""
                        placeholder="Dirección de entrega..."
                        required
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Ciudad</Label>
                          <Input className="h-8 text-xs" value={formData.destinatario_ciudad} onChange={(e) => handleChange('destinatario_ciudad', e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">CP</Label>
                          <Input className="h-8 text-xs" value={formData.destinatario_codigo_postal} onChange={(e) => handleChange('destinatario_codigo_postal', e.target.value)} />
                        </div>
                      </div>
                      {/* Delivery preferences */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Horario entrega</Label>
                          <Select value={formData.horario_preferido_entrega} onValueChange={(v) => handleChange('horario_preferido_entrega', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {HORARIOS_ENTREGA.map((h) => (<SelectItem key={h.value} value={h.value} className="text-xs">{h.label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Días preferidos</Label>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {DIAS_SEMANA.map((dia) => (
                              <Button key={dia.key} type="button" variant={diasPreferidos.includes(dia.key) ? 'default' : 'outline'}
                                className="h-6 px-1.5 text-[10px]" size="sm"
                                onClick={() => toggleDiaPreferido(dia.key)}>
                                {dia.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Retiro almacenaje info */
              <div className="flex items-center gap-3 h-full">
                <Package className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Destino del retiro</p>
                  <p className="text-sm font-semibold">
                    📦 Bodega {sucursalUsuario?.nombre || 'tu sucursal'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Mercadería en almacenaje hasta definir destino
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ BOTTOM ROW: Package + Concepts + Notes ═══ */}
        <div className="mt-3 border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-warning" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paquete y Detalles</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Bultos</Label>
              <Input className="h-8 text-xs" type="number" min="1" value={formData.cantidad_bultos} onChange={(e) => handleChange('cantidad_bultos', e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Peso (kg)</Label>
              <Input className="h-8 text-xs" type="number" step="0.1" min="0" value={formData.peso_kg} onChange={(e) => handleChange('peso_kg', e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Dimensiones (cm)</Label>
              <Input className="h-8 text-xs" value={formData.dimensiones} onChange={(e) => handleChange('dimensiones', e.target.value)} placeholder="30x20x15" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">V. Declarado ($)</Label>
              <Input className="h-8 text-xs" type="number" min="0" value={formData.valor_declarado} onChange={(e) => handleChange('valor_declarado', e.target.value)}
                placeholder={configSeguro?.valor_minimo_declarado ? `Mín $${configSeguro.valor_minimo_declarado}` : ''} />
            </div>
            <div className="col-span-2 md:col-span-2">
              <Label className="text-[10px] text-muted-foreground">Descripción contenido</Label>
              <Input className="h-8 text-xs" value={formData.descripcion} onChange={(e) => handleChange('descripcion', e.target.value)} placeholder="Documentos, ropa, etc..." />
            </div>
          </div>
          
          {/* Conceptos adicionales inline */}
          {conceptosAdicionales.length > 0 && formData.tarifa_id && (
            <div className="mt-2 pt-2 border-t">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1.5">
                <Plus className="h-3 w-3" /> Conceptos Adicionales
              </Label>
              <div className="flex flex-wrap gap-2">
                {conceptosAdicionales.map((cp) => (
                  <div key={cp.id} className="flex items-center gap-1.5 border rounded-md px-2 py-1 bg-muted/30">
                    <Checkbox id={`concepto-${cp.id}`} className="h-3.5 w-3.5"
                      checked={conceptosSeleccionados.has(cp.concepto_id)}
                      onCheckedChange={() => toggleConceptoAdicional(cp.concepto_id)} />
                    <Label htmlFor={`concepto-${cp.id}`} className="text-[10px] cursor-pointer">{cp.concepto?.nombre}</Label>
                    {cp.concepto?.monto_editable ? (
                      <Input type="number" step="0.01" min="0" placeholder="$" className="w-16 h-6 text-[10px]"
                        value={montosEditables[cp.concepto_id] || ''}
                        onChange={(e) => setMontosEditables(prev => ({ ...prev, [cp.concepto_id]: e.target.value }))}
                        disabled={!conceptosSeleccionados.has(cp.concepto_id)} />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {cp.es_porcentaje && cp.porcentaje ? `${cp.porcentaje}%` : formatCurrency(cp.monto)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notas */}
          <div className="mt-2 pt-2 border-t">
            <Label className="text-[10px] text-muted-foreground">Notas adicionales</Label>
            <Input className="h-8 text-xs" value={formData.notas} onChange={(e) => handleChange('notas', e.target.value)} placeholder="Instrucciones especiales..." />
          </div>
        </div>

        {/* ═══ STICKY FOOTER: Price Summary + Buttons ═══ */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t shadow-lg z-40">
          <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
            {/* Price breakdown (compact) */}
            <div className="flex items-center gap-4 text-xs overflow-x-auto">
              {selectedTarifa && (
                <>
                  <span className="whitespace-nowrap">
                    <span className="text-muted-foreground">Flete:</span> <span className="font-medium">{formatCurrency(fleteCalculado)}</span>
                    {fleteDescripcion && <span className="text-muted-foreground ml-1">({fleteDescripcion})</span>}
                  </span>
                  {totalConceptosBasicos > 0 && (
                    <span className="whitespace-nowrap">
                      <span className="text-muted-foreground">Conceptos:</span> <span className="font-medium">{formatCurrency(totalConceptosBasicos)}</span>
                    </span>
                  )}
                  {totalConceptosAdicionales > 0 && (
                    <span className="whitespace-nowrap text-primary">
                      <span>+ Adic.:</span> <span className="font-medium">{formatCurrency(totalConceptosAdicionales)}</span>
                    </span>
                  )}
                  {distanciaKm && (
                    <span className="whitespace-nowrap text-muted-foreground">
                      <Navigation className="h-3 w-3 inline mr-0.5" />{distanciaKm.toFixed(1)} km
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Total + buttons */}
            <div className="flex items-center gap-3 shrink-0">
              {selectedTarifa && (
                <span className="text-lg font-bold text-envios">{formatCurrency(precioCalculado)}</span>
              )}
              <Button type="button" variant="outline" className="h-9" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button type="submit" className="h-9 bg-envios hover:bg-envios/90" disabled={createShipmentMutation.isPending || !sucursalOrigenId}>
                {createShipmentMutation.isPending ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creando...</>
                ) : esRetiroAlmacenaje ? (
                  <><Package className="mr-1.5 h-4 w-4" />Crear Retiro</>
                ) : (
                  <><PackagePlus className="mr-1.5 h-4 w-4" />Crear Envío</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Payment Method Dialog */}
      <PaymentMethodDialog
        open={showPaymentModal}
        onOpenChange={(open) => {
          if (!open && createdEnvio) {
            navigate(`/print-label?id=${createdEnvio.id}`);
          }
          setShowPaymentModal(open);
        }}
        trackingNumber={createdEnvio?.tracking_number || ''}
        amount={createdEnvio?.precio_total || 0}
        envioId={createdEnvio?.id}
        onConfirm={handlePaymentConfirm}
        isLoading={isProcessingPayment}
      />

      {/* Alert dialog for existing client match */}
      <AlertDialog open={!!pendingClientMatch} onOpenChange={(open) => { if (!open) setPendingClientMatch(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cliente encontrado</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Se encontró un cliente ya registrado en el sistema:</p>
                <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                  <p className="font-medium text-foreground">
                    {pendingClientMatch?.client.nombre} {pendingClientMatch?.client.apellido || ''}
                  </p>
                  {pendingClientMatch?.client.telefono && <p>📞 {pendingClientMatch.client.telefono}</p>}
                  {pendingClientMatch?.client.direccion && <p>📍 {pendingClientMatch.client.direccion}{pendingClientMatch.client.ciudad ? `, ${pendingClientMatch.client.ciudad}` : ''}</p>}
                  {pendingClientMatch?.client.dni_cuit && <p>🪪 {pendingClientMatch.client.dni_cuit}</p>}
                </div>
                <p>¿Deseas cargar los datos de este cliente?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, continuar manual</AlertDialogCancel>
            <AlertDialogAction onClick={applyClientMatch}>Sí, cargar datos</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
