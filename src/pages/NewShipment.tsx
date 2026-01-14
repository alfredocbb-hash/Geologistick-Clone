import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ContactAutocomplete from '@/components/shipments/ContactAutocomplete';
import { AddressAutocomplete, type AddressDetails } from '@/components/maps';
import { 
  PackagePlus, ArrowLeft, User, MapPin, Package, DollarSign, Loader2, 
  CreditCard, Truck, Calendar, Clock, Home, AlertCircle, Wallet, Phone,
  Building2, ArrowRight, Navigation
} from 'lucide-react';
import { PaymentMethodDialog } from '@/components/shipments/PaymentMethodDialog';

interface TarifaConcepto {
  id: string;
  nombre: string;
  codigo: string;
}

interface TarifaConceptoPrecio {
  id: string;
  tarifa_id: string;
  concepto_id: string;
  monto: number;
  concepto?: TarifaConcepto;
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

type TipoServicioDetalle = 'sucursal_sucursal' | 'sucursal_puerta' | 'puerta_sucursal' | 'puerta_puerta';

const TIPO_SERVICIO_OPTIONS: { value: TipoServicioDetalle; label: string; icon: string; description: string }[] = [
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

export default function NewShipment() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Tipo de servicio detallado (4 opciones)
  const [tipoServicioDetalle, setTipoServicioDetalle] = useState<TipoServicioDetalle>('sucursal_sucursal');
  
  // Días preferidos de entrega
  const [diasPreferidos, setDiasPreferidos] = useState<string[]>([]);

  const [formData, setFormData] = useState({
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
    destinatario_whatsapp: '',
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
  });

  // Coordinates state for distance calculation
  const [origenCoords, setOrigenCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [createdEnvio, setCreatedEnvio] = useState<{ id: string; tracking_number: string; precio_total: number; remitente_id: string } | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Derived states
  const tieneRetiro = tipoServicioDetalle === 'puerta_sucursal' || tipoServicioDetalle === 'puerta_puerta';
  const tieneEntrega = tipoServicioDetalle === 'sucursal_puerta' || tipoServicioDetalle === 'puerta_puerta';
  
  // La sucursal de origen es fija - la del usuario
  const sucursalOrigenId = profile?.sucursal_id;

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
  });

  // Sucursales destino (para retiro en sucursal)
  const sucursalesDestino = useMemo(() => {
    return sucursales.filter(s => s.puede_recibir !== false && s.id !== sucursalOrigenId);
  }, [sucursales, sucursalOrigenId]);

  const { data: tarifas } = useQuery({
    queryKey: ['tarifas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarifas')
        .select('*')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

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

  const { data: conceptoPrecios = [] } = useQuery({
    queryKey: ['tarifa_concepto_precios', formData.tarifa_id],
    queryFn: async () => {
      if (!formData.tarifa_id) return [];
      const { data, error } = await supabase
        .from('tarifa_concepto_precios')
        .select('*, concepto:tarifa_conceptos(*)')
        .eq('tarifa_id', formData.tarifa_id);
      if (error) throw error;
      return data as TarifaConceptoPrecio[];
    },
    enabled: !!formData.tarifa_id,
  });

  // Fetch ALL clients for autocomplete and deduplication
  const { data: allClients = [] } = useQuery({
    queryKey: ['all_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre');
      if (error) throw error;
      return data as Client[];
    },
  });

  // Clientes con cuenta corriente (filtered from allClients)
  const clientesCtaCte = useMemo(() => {
    return allClients.filter(c => c.tiene_cuenta_corriente);
  }, [allClients]);

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

  const selectedTarifa = tarifas?.find(t => t.id === formData.tarifa_id);

  // Calcular total por conceptos
  const calcularTotalConceptos = () => {
    let total = conceptoPrecios.reduce((sum, cp) => sum + Number(cp.monto), 0);
    
    if (tieneRetiro) {
      const retiroConcepto = conceptoPrecios.find(cp => cp.concepto?.codigo === 'retiro');
      if (retiroConcepto) {
        total += Number(retiroConcepto.monto);
      }
    }
    
    if (tieneEntrega) {
      const entregaConcepto = conceptoPrecios.find(cp => cp.concepto?.codigo === 'entrega');
      if (entregaConcepto) {
        total += Number(entregaConcepto.monto);
      }
    }
    
    return total;
  };

  const calcularPrecio = () => {
    if (!selectedTarifa) return 0;
    const peso = parseFloat(formData.peso_kg) || 0;
    const precioBase = Number(selectedTarifa.precio_base) || 0;
    const precioPorKg = Number(selectedTarifa.precio_por_kg) || 0;
    const totalConceptos = calcularTotalConceptos();
    
    const baseTotal = totalConceptos > 0 ? totalConceptos : precioBase;
    return baseTotal + (peso * precioPorKg);
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
    
    // 2. Si no encontró por DNI, buscar por teléfono en la base de datos
    if (data.telefono) {
      const { data: clientByPhone, error: phoneError } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefono', data.telefono)
        .maybeSingle();
      
      if (phoneError) {
        console.error('Error buscando cliente por teléfono:', phoneError);
      }
      
      if (clientByPhone) {
        // Actualizar datos del cliente existente
        const { error: updateError } = await supabase
          .from('clientes')
          .update({
            nombre: data.nombre,
            apellido: data.apellido || clientByPhone.apellido,
            email: data.email || clientByPhone.email,
            direccion: data.direccion || clientByPhone.direccion,
            ciudad: data.ciudad || clientByPhone.ciudad,
            codigo_postal: data.codigo_postal || clientByPhone.codigo_postal,
            dni_cuit: data.dni_cuit || clientByPhone.dni_cuit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', clientByPhone.id);

        if (updateError) throw updateError;
        return clientByPhone.id;
      }
    }

    // 3. Solo si no existe, crear nuevo cliente
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
        sucursal_id: data.sucursal_id,
      })
      .select()
      .single();

    if (createError) {
      // Manejo específico para error de duplicado
      if (createError.message?.includes('idx_clientes_dni_cuit_unique') || 
          createError.code === '23505') {
        throw new Error(`Ya existe un cliente con el DNI/CUIT ${data.dni_cuit}. Por favor verifique los datos.`);
      }
      throw createError;
    }
    return newClient.id;
  };

  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      if (!sucursalOrigenId) {
        throw new Error('No tienes una sucursal asignada. Contacta al administrador.');
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

      if (tieneEntrega) {
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
      let destinatarioId = formData.cliente_cta_cte_id || null;
      
      if (!destinatarioId) {
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

      const precioTotal = calcularPrecio();

      // 4. Create shipment with all new fields
      // Estado inicial: si no requiere retiro (paquete ya en sucursal) → en_bodega
      // Si requiere retiro (hay que ir a buscar) → pendiente
      const estadoInicial = tieneRetiro ? 'pendiente' : 'en_bodega';
      
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
          pago_contra_entrega: formData.pago_contra_entrega,
          notas: formData.notas,
          created_by: user?.id,
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
        })
        .select()
        .single();

      if (envioError) throw envioError;

      // 5. Create shipment details by concept
      if (conceptoPrecios.length > 0) {
        const detalles = conceptoPrecios.map((cp) => ({
          envio_id: envio.id,
          concepto_id: cp.concepto_id,
          nombre_concepto: cp.concepto?.nombre || 'Sin nombre',
          monto: cp.monto,
        }));

        const { error: detallesError } = await supabase
          .from('envio_detalles')
          .insert(detalles);

        if (detallesError) throw detallesError;
      }

      // 6. If cuenta corriente, create movement
      if (formData.tipo_pago === 'cuenta_corriente' && formData.cliente_cta_cte_id) {
        const { data: cliente } = await supabase
          .from('clientes')
          .select('saldo_cuenta_corriente')
          .eq('id', formData.cliente_cta_cte_id)
          .single();

        const saldoAnterior = Number(cliente?.saldo_cuenta_corriente) || 0;
        const saldoNuevo = saldoAnterior - precioTotal;

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

      return envio;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['envios'] });
      queryClient.invalidateQueries({ queryKey: ['all_clients'] });
      queryClient.invalidateQueries({ queryKey: ['clientes_cta_cte'] });
      
      // Si es pago contado, mostrar modal para seleccionar método de pago
      if (formData.tipo_pago === 'contado') {
        setCreatedEnvio({
          id: data.id,
          tracking_number: data.tracking_number,
          precio_total: data.precio_total,
          remitente_id: data.remitente_id || '',
        });
        setShowPaymentModal(true);
      } else {
        // Para cuenta corriente o destinatario, redirigir directamente
        toast({
          title: '¡Envío creado!',
          description: `Tracking: ${data.tracking_number}. Redirigiendo a etiqueta...`,
        });
        navigate(`/print-label?id=${data.id}`);
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

    if (!tieneEntrega && !formData.sucursal_destino_id) {
      toast({
        title: 'Sucursal destino requerida',
        description: 'Debes seleccionar la sucursal de destino',
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
    toast({
      title: 'Cliente cargado',
      description: `Datos de ${client.nombre} cargados como remitente`,
    });
  };

  const handleLoadRecipientClient = (client: Client) => {
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
        estado: 'pendiente',
        created_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: '¡Pago registrado!',
        description: `Tracking: ${createdEnvio.tracking_number}. Redirigiendo a etiqueta...`,
      });
      
      setShowPaymentModal(false);
      navigate(`/print-label?id=${createdEnvio.id}`);
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
    setOrigenCoords({ lat: details.lat, lng: details.lng });
  };

  const handleDestinatarioAddressSelect = (details: AddressDetails) => {
    setFormData(prev => ({
      ...prev,
      destinatario_direccion: details.address || details.formattedAddress,
      destinatario_ciudad: details.city || prev.destinatario_ciudad,
      destinatario_codigo_postal: details.postalCode || prev.destinatario_codigo_postal,
    }));
    setDestinoCoords({ lat: details.lat, lng: details.lng });
  };

  // Update destination coords when sucursal destino changes
  useEffect(() => {
    if (!tieneEntrega && formData.sucursal_destino_id) {
      const sucursalDestino = sucursales.find(s => s.id === formData.sucursal_destino_id);
      if (sucursalDestino?.lat && sucursalDestino?.lng) {
        setDestinoCoords({ lat: sucursalDestino.lat, lng: sucursalDestino.lng });
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
  const precioCalculado = calcularPrecio();

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
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <PackagePlus className="h-8 w-8 text-envios" />
              Nuevo Envío
            </h1>
            <p className="text-muted-foreground mt-1">
              Completa los datos para crear un nuevo envío
            </p>
          </div>
        </div>
        
        {/* Badge de precio */}
        {selectedTarifa && (
          <Badge className="text-lg px-4 py-2 bg-envios hover:bg-envios">
            <DollarSign className="h-4 w-4 mr-1" />
            {formatCurrency(precioCalculado)}
          </Badge>
        )}
      </div>

      {/* Card de Sucursal Asignada */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Sucursal de Origen</p>
              <p className="font-semibold">
                {loadingSucursalUsuario ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : sucursalUsuario ? (
                  <>
                    {sucursalUsuario.codigo && `${sucursalUsuario.codigo} - `}
                    {sucursalUsuario.nombre}
                    {sucursalUsuario.ciudad && ` (${sucursalUsuario.ciudad})`}
                  </>
                ) : (
                  'Sin asignar'
                )}
              </p>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary">
              Tu sucursal
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Alert de cuenta corriente detectada */}
      {remitenteConCtaCte && formData.tipo_pago !== 'cuenta_corriente' && (
        <Alert className="border-primary bg-primary/5">
          <Wallet className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <span className="font-medium">✨ Cuenta Corriente Disponible:</span> {remitenteConCtaCte.nombre} tiene cuenta corriente activa.
              {remitenteConCtaCte.saldo_cuenta_corriente !== null && (
                <span className="ml-2">Saldo: {formatCurrency(Number(remitenteConCtaCte.saldo_cuenta_corriente) || 0)}</span>
              )}
              {remitenteConCtaCte.limite_credito && (
                <span className="ml-2">Límite: {formatCurrency(remitenteConCtaCte.limite_credito)}</span>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm"
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de Servicio - 4 opciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-envios" />
              Tipo de Servicio
            </CardTitle>
            <CardDescription>Selecciona el tipo de servicio que necesitas</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup 
              value={tipoServicioDetalle} 
              onValueChange={(v) => setTipoServicioDetalle(v as TipoServicioDetalle)}
              className="grid grid-cols-2 gap-4"
            >
              {TIPO_SERVICIO_OPTIONS.map((option) => (
                <div key={option.value}>
                  <RadioGroupItem 
                    value={option.value} 
                    id={option.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={option.value}
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-envios [&:has([data-state=checked])]:border-envios cursor-pointer"
                  >
                    <span className="text-2xl mb-2">{option.icon}</span>
                    <span className="font-semibold text-center">{option.label}</span>
                    <span className="text-xs text-muted-foreground text-center mt-1">
                      {option.description}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {/* Visual indicator of what's included */}
            <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${tieneRetiro ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                <Home className="h-4 w-4" />
                <span>Retiro</span>
                {tieneRetiro && <Badge variant="outline" className="bg-warning/10 text-warning border-warning">Incluido</Badge>}
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className={`flex items-center gap-2 ${tieneEntrega ? 'text-success font-medium' : 'text-muted-foreground'}`}>
                <MapPin className="h-4 w-4" />
                <span>Entrega</span>
                {tieneEntrega && <Badge variant="outline" className="bg-success/10 text-success border-success">Incluido</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tipo de Pago */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Tipo de Pago
            </CardTitle>
            <CardDescription>Selecciona cómo se realizará el pago</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <Button
                type="button"
                variant={formData.tipo_pago === 'contado' ? 'default' : 'outline'}
                className={formData.tipo_pago === 'contado' ? 'bg-success hover:bg-success/90' : ''}
                onClick={() => handleChange('tipo_pago', 'contado')}
              >
                Contado
              </Button>
              <Button
                type="button"
                variant={formData.tipo_pago === 'destino' ? 'default' : 'outline'}
                className={formData.tipo_pago === 'destino' ? 'bg-warning hover:bg-warning/90' : ''}
                onClick={() => handleChange('tipo_pago', 'destino')}
              >
                Pago en Destino
              </Button>
              <Button
                type="button"
                variant={formData.tipo_pago === 'cuenta_corriente' ? 'default' : 'outline'}
                className={formData.tipo_pago === 'cuenta_corriente' ? 'bg-primary hover:bg-primary/90' : ''}
                onClick={() => handleChange('tipo_pago', 'cuenta_corriente')}
              >
                Cuenta Corriente
              </Button>
            </div>

            {formData.tipo_pago === 'cuenta_corriente' && (
              <div className="mt-4 space-y-2">
                <Label>Cliente con Cuenta Corriente *</Label>
                <Select
                  value={formData.cliente_cta_cte_id}
                  onValueChange={(v) => handleChange('cliente_cta_cte_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientesCtaCte?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre} {c.apellido} - Saldo: {formatCurrency(Number(c.saldo_cuenta_corriente) || 0)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Remitente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Datos del Remitente
            </CardTitle>
            <CardDescription>
              {tieneRetiro 
                ? 'Información de quien envía el paquete - Se retirará en su domicilio'
                : 'Información de quien envía el paquete'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Autocomplete */}
            <ContactAutocomplete 
              clients={allClients}
              onSelect={handleLoadSenderClient}
              label="Cargar cliente existente"
              placeholder="Buscar por nombre, DNI o teléfono..."
            />
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="remitente_nombre">Nombre *</Label>
                <Input
                  id="remitente_nombre"
                  value={formData.remitente_nombre}
                  onChange={(e) => handleChange('remitente_nombre', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remitente_apellido">Apellido</Label>
                <Input
                  id="remitente_apellido"
                  value={formData.remitente_apellido}
                  onChange={(e) => handleChange('remitente_apellido', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remitente_dni">DNI / CUIT</Label>
                <Input
                  id="remitente_dni"
                  value={formData.remitente_dni}
                  onChange={(e) => handleChange('remitente_dni', e.target.value)}
                  placeholder="Ej: 12345678 o 20-12345678-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remitente_telefono">Teléfono *</Label>
                <Input
                  id="remitente_telefono"
                  value={formData.remitente_telefono}
                  onChange={(e) => handleChange('remitente_telefono', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remitente_email">Email</Label>
                <Input
                  id="remitente_email"
                  type="email"
                  value={formData.remitente_email}
                  onChange={(e) => handleChange('remitente_email', e.target.value)}
                />
              </div>
            </div>

            {/* Dirección del remitente - Solo si tiene retiro */}
            {tieneRetiro && (
              <>
                <Separator className="my-4" />
                <div className="p-4 rounded-lg bg-warning/5 border border-warning/20 space-y-4">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-warning" />
                    <Label className="text-warning font-medium">Dirección para Retiro</Label>
                  </div>
                  
                  <div className="space-y-2">
                    <AddressAutocomplete
                      id="remitente_direccion"
                      value={formData.remitente_direccion}
                      onChange={(value) => handleChange('remitente_direccion', value)}
                      onSelect={handleRemitenteAddressSelect}
                      label="Dirección *"
                      placeholder="Ingrese la dirección del remitente..."
                      required
                    />
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="remitente_ciudad">Ciudad</Label>
                      <Input
                        id="remitente_ciudad"
                        value={formData.remitente_ciudad}
                        onChange={(e) => handleChange('remitente_ciudad', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="remitente_codigo_postal">Código Postal</Label>
                      <Input
                        id="remitente_codigo_postal"
                        value={formData.remitente_codigo_postal}
                        onChange={(e) => handleChange('remitente_codigo_postal', e.target.value)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fecha_retiro" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Fecha de Retiro *
                      </Label>
                      <Input
                        id="fecha_retiro"
                        type="date"
                        min={today}
                        value={formData.fecha_retiro}
                        onChange={(e) => handleChange('fecha_retiro', e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="horario_retiro" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Horario Preferido
                      </Label>
                      <Select
                        value={formData.horario_retiro}
                        onValueChange={(v) => handleChange('horario_retiro', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar horario" />
                        </SelectTrigger>
                        <SelectContent>
                          {HORARIOS_RETIRO.map((h) => (
                            <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notas_retiro">Notas para el retiro</Label>
                    <Textarea
                      id="notas_retiro"
                      value={formData.notas_retiro}
                      onChange={(e) => handleChange('notas_retiro', e.target.value)}
                      placeholder="Instrucciones especiales para el retiro..."
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Destinatario */}
        {(formData.tipo_pago !== 'cuenta_corriente' || !formData.cliente_cta_cte_id) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-success" />
                Datos del Destinatario
              </CardTitle>
              <CardDescription>
                {tieneEntrega 
                  ? 'Información de quien recibe el paquete - Se entregará a domicilio'
                  : 'Información de quien recibe el paquete - Retirará en sucursal'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Autocomplete */}
              <ContactAutocomplete 
                clients={allClients}
                onSelect={handleLoadRecipientClient}
                label="Cargar cliente existente"
                placeholder="Buscar por nombre, DNI o teléfono..."
              />
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="destinatario_nombre">Nombre *</Label>
                  <Input
                    id="destinatario_nombre"
                    value={formData.destinatario_nombre}
                    onChange={(e) => handleChange('destinatario_nombre', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destinatario_apellido">Apellido</Label>
                  <Input
                    id="destinatario_apellido"
                    value={formData.destinatario_apellido}
                    onChange={(e) => handleChange('destinatario_apellido', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destinatario_dni">DNI / CUIT</Label>
                  <Input
                    id="destinatario_dni"
                    value={formData.destinatario_dni}
                    onChange={(e) => handleChange('destinatario_dni', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destinatario_telefono">Teléfono *</Label>
                  <Input
                    id="destinatario_telefono"
                    value={formData.destinatario_telefono}
                    onChange={(e) => handleChange('destinatario_telefono', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destinatario_whatsapp">WhatsApp</Label>
                  <Input
                    id="destinatario_whatsapp"
                    value={formData.destinatario_whatsapp}
                    onChange={(e) => handleChange('destinatario_whatsapp', e.target.value)}
                    placeholder="Ej: +54 11 1234-5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destinatario_email">Email</Label>
                  <Input
                    id="destinatario_email"
                    type="email"
                    value={formData.destinatario_email}
                    onChange={(e) => handleChange('destinatario_email', e.target.value)}
                  />
                </div>
              </div>

              {/* Sucursal Destino - Solo si NO tiene entrega (sucursal_sucursal o puerta_sucursal) */}
              {!tieneEntrega && (
                <>
                  <Separator className="my-4" />
                  <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <Label className="font-medium">Sucursal de Destino</Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      El destinatario retirará el paquete en esta sucursal
                    </p>
                    <Select
                      value={formData.sucursal_destino_id}
                      onValueChange={(v) => handleChange('sucursal_destino_id', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar sucursal de destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {sucursalesDestino.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.codigo && `${s.codigo} - `}{s.nombre}
                            {s.ciudad && ` (${s.ciudad})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Dirección de entrega - Solo si tiene entrega (sucursal_puerta o puerta_puerta) */}
              {tieneEntrega && (
                <>
                  <Separator className="my-4" />
                  <div className="p-4 rounded-lg bg-success/5 border border-success/20 space-y-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-success" />
                      <Label className="text-success font-medium">Dirección de Entrega</Label>
                    </div>
                    
                    <div className="space-y-2">
                      <AddressAutocomplete
                        id="destinatario_direccion"
                        value={formData.destinatario_direccion}
                        onChange={(value) => handleChange('destinatario_direccion', value)}
                        onSelect={handleDestinatarioAddressSelect}
                        label="Dirección *"
                        placeholder="Ingrese la dirección de entrega..."
                        required
                      />
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="destinatario_ciudad">Ciudad</Label>
                        <Input
                          id="destinatario_ciudad"
                          value={formData.destinatario_ciudad}
                          onChange={(e) => handleChange('destinatario_ciudad', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="destinatario_codigo_postal">Código Postal</Label>
                        <Input
                          id="destinatario_codigo_postal"
                          value={formData.destinatario_codigo_postal}
                          onChange={(e) => handleChange('destinatario_codigo_postal', e.target.value)}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Días preferidos (opcional)</Label>
                        <div className="flex flex-wrap gap-2">
                          {DIAS_SEMANA.map((dia) => (
                            <Button
                              key={dia.key}
                              type="button"
                              variant={diasPreferidos.includes(dia.key) ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => toggleDiaPreferido(dia.key)}
                            >
                              {dia.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="horario_preferido_entrega">Horario preferido</Label>
                        <Select
                          value={formData.horario_preferido_entrega}
                          onValueChange={(v) => handleChange('horario_preferido_entrega', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar horario" />
                          </SelectTrigger>
                          <SelectContent>
                            {HORARIOS_ENTREGA.map((h) => (
                              <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Detalles del Paquete */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-warning" />
              Detalles del Paquete
            </CardTitle>
            <CardDescription>Información sobre el envío</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cantidad_bultos">Cantidad de Bultos</Label>
              <Input
                id="cantidad_bultos"
                type="number"
                min="1"
                value={formData.cantidad_bultos}
                onChange={(e) => handleChange('cantidad_bultos', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="peso_kg">Peso (kg)</Label>
              <Input
                id="peso_kg"
                type="number"
                step="0.1"
                min="0"
                value={formData.peso_kg}
                onChange={(e) => handleChange('peso_kg', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dimensiones">Dimensiones (cm)</Label>
              <Input
                id="dimensiones"
                value={formData.dimensiones}
                onChange={(e) => handleChange('dimensiones', e.target.value)}
                placeholder="Ej: 30x20x15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_declarado">Valor Declarado ($)</Label>
              <Input
                id="valor_declarado"
                type="number"
                min="0"
                value={formData.valor_declarado}
                onChange={(e) => handleChange('valor_declarado', e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="descripcion">Descripción del contenido</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => handleChange('descripcion', e.target.value)}
                placeholder="Ej: Documentos, ropa, electrónicos..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tarifa_id">Tarifa</Label>
              <Select
                value={formData.tarifa_id}
                onValueChange={(v) => handleChange('tarifa_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tarifa" />
                </SelectTrigger>
                <SelectContent>
                  {tarifas?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre} - ${Number(t.precio_base).toLocaleString('es-AR')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.tipo_pago === 'destino' && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="pago_contra_entrega"
                  checked={formData.pago_contra_entrega}
                  onCheckedChange={(v) => handleChange('pago_contra_entrega', v)}
                />
                <Label htmlFor="pago_contra_entrega">Cobrar contra entrega</Label>
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notas">Notas adicionales</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => handleChange('notas', e.target.value)}
                placeholder="Instrucciones especiales..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Resumen de Precio */}
        {selectedTarifa && (
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-envios" />
                Resumen de Precio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {conceptoPrecios.length > 0 ? (
                  conceptoPrecios.map((cp) => (
                    <div key={cp.id} className="flex justify-between text-sm">
                      <span>{cp.concepto?.nombre || 'Concepto'}</span>
                      <span>{formatCurrency(cp.monto)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between text-sm">
                    <span>Precio base ({selectedTarifa.nombre})</span>
                    <span>{formatCurrency(selectedTarifa.precio_base)}</span>
                  </div>
                )}
                {parseFloat(formData.peso_kg) > 0 && selectedTarifa.precio_por_kg && (
                  <div className="flex justify-between text-sm">
                    <span>Peso ({formData.peso_kg} kg x {formatCurrency(selectedTarifa.precio_por_kg)})</span>
                    <span>{formatCurrency(parseFloat(formData.peso_kg) * selectedTarifa.precio_por_kg)}</span>
                  </div>
                )}
                {distanciaKm && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Navigation className="h-3 w-3" />
                      Distancia estimada
                    </span>
                    <span>{distanciaKm.toFixed(1)} km</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-envios">{formatCurrency(precioCalculado)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => navigate(-1)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-envios hover:bg-envios/90"
            disabled={createShipmentMutation.isPending || !sucursalOrigenId}
          >
            {createShipmentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <PackagePlus className="mr-2 h-4 w-4" />
                Crear Envío
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Payment Method Dialog */}
      <PaymentMethodDialog
        open={showPaymentModal}
        onOpenChange={(open) => {
          if (!open && createdEnvio) {
            // Si cierra el modal sin pagar, igual redirige a la etiqueta
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
    </div>
  );
}
