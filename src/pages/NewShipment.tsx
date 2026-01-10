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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ContactAutocomplete from '@/components/shipments/ContactAutocomplete';
import { 
  PackagePlus, ArrowLeft, User, MapPin, Package, DollarSign, Loader2, 
  CreditCard, Truck, Calendar, Clock, Home, AlertCircle, Wallet, Phone
} from 'lucide-react';

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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Tipo de servicio
  const [tipoServicio, setTipoServicio] = useState<'envio_completo' | 'solo_retiro'>('envio_completo');
  
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
    sucursal_origen_id: '',
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
    requiere_retiro: false,
    fecha_retiro: '',
    horario_retiro: '',
    notas_retiro: '',
    // Preferencias de entrega
    horario_preferido_entrega: 'cualquier_hora',
  });

  // Queries
  const { data: sucursales } = useQuery({
    queryKey: ['sucursales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('*')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

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
      // Buscar por DNI primero
      if (formData.remitente_dni && c.dni_cuit) {
        const dniMatch = c.dni_cuit.toLowerCase().trim() === formData.remitente_dni.toLowerCase().trim();
        if (dniMatch && c.tiene_cuenta_corriente) return true;
      }
      // Luego por nombre
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
    return conceptoPrecios.reduce((sum, cp) => sum + Number(cp.monto), 0);
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

  // Find or create client helper
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
    // Search by DNI first
    let existingClient = null;
    
    if (data.dni_cuit && data.dni_cuit.trim()) {
      existingClient = allClients.find(c => 
        c.dni_cuit?.toLowerCase().trim() === data.dni_cuit!.toLowerCase().trim()
      );
    }
    
    // Search by phone if not found by DNI
    if (!existingClient && data.telefono) {
      existingClient = allClients.find(c => 
        c.telefono === data.telefono
      );
    }

    if (existingClient) {
      // Update existing client with new data
      const { error: updateError } = await supabase
        .from('clientes')
        .update({
          nombre: data.nombre,
          apellido: data.apellido || existingClient.apellido,
          email: data.email || existingClient.email,
          direccion: data.direccion || existingClient.direccion,
          ciudad: data.ciudad || existingClient.ciudad,
          codigo_postal: data.codigo_postal || existingClient.codigo_postal,
          dni_cuit: data.dni_cuit || existingClient.dni_cuit,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingClient.id);

      if (updateError) throw updateError;
      return existingClient.id;
    } else {
      // Create new client
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

      if (createError) throw createError;
      return newClient.id;
    }
  };

  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      // 1. Find or create remitente
      const remitenteId = await findOrCreateClient({
        nombre: formData.remitente_nombre,
        apellido: formData.remitente_apellido,
        telefono: formData.remitente_telefono,
        email: formData.remitente_email,
        direccion: formData.remitente_direccion,
        ciudad: formData.remitente_ciudad,
        codigo_postal: formData.remitente_codigo_postal,
        dni_cuit: formData.remitente_dni,
        sucursal_id: formData.sucursal_origen_id || null,
      });

      // 2. Find or create destinatario (unless using existing cta cte client or solo_retiro)
      let destinatarioId = formData.cliente_cta_cte_id || null;
      
      if (!destinatarioId && tipoServicio === 'envio_completo') {
        destinatarioId = await findOrCreateClient({
          nombre: formData.destinatario_nombre,
          apellido: formData.destinatario_apellido,
          telefono: formData.destinatario_telefono,
          email: formData.destinatario_email,
          direccion: formData.destinatario_direccion,
          ciudad: formData.destinatario_ciudad,
          codigo_postal: formData.destinatario_codigo_postal,
          dni_cuit: formData.destinatario_dni,
          sucursal_id: formData.sucursal_destino_id || null,
        });
      }

      // 3. Generate tracking number
      const { data: trackingData, error: trackingError } = await supabase
        .rpc('generate_tracking_number');

      if (trackingError) throw trackingError;

      const precioTotal = calcularPrecio();

      // 4. Create shipment with all new fields
      const { data: envio, error: envioError } = await supabase
        .from('envios')
        .insert({
          tracking_number: trackingData,
          remitente_id: remitenteId,
          destinatario_id: destinatarioId,
          sucursal_origen_id: formData.sucursal_origen_id || null,
          sucursal_destino_id: formData.sucursal_destino_id || null,
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
          // New fields
          tipo_servicio: tipoServicio,
          cantidad_bultos: parseInt(formData.cantidad_bultos) || 1,
          codigo_postal_origen: formData.remitente_codigo_postal || null,
          codigo_postal_destino: formData.destinatario_codigo_postal || null,
          dni_remitente: formData.remitente_dni || null,
          dni_destinatario: formData.destinatario_dni || null,
          whatsapp_destinatario: formData.destinatario_whatsapp || null,
          requiere_retiro: formData.requiere_retiro,
          fecha_retiro: formData.requiere_retiro && formData.fecha_retiro ? formData.fecha_retiro : null,
          horario_retiro: formData.requiere_retiro ? formData.horario_retiro : null,
          notas_retiro: formData.requiere_retiro ? formData.notas_retiro : null,
          dias_preferidos_entrega: diasPreferidos.length > 0 ? diasPreferidos : null,
          horario_preferido_entrega: formData.horario_preferido_entrega,
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
      toast({
        title: tipoServicio === 'solo_retiro' ? '¡Retiro creado!' : '¡Envío creado!',
        description: `Tracking: ${data.tracking_number}`,
      });
      navigate('/shipments');
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
    if (formData.requiere_retiro && !formData.fecha_retiro) {
      toast({
        title: 'Fecha requerida',
        description: 'Debes seleccionar una fecha para el retiro',
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  const today = new Date().toISOString().split('T')[0];
  const precioCalculado = calcularPrecio();

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
              {tipoServicio === 'solo_retiro' ? 'Nuevo Retiro' : 'Nuevo Envío'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {tipoServicio === 'solo_retiro' 
                ? 'Solicitar retiro de mercadería' 
                : 'Completa los datos para crear un nuevo envío'}
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
        {/* Tipo de Servicio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-envios" />
              Tipo de Servicio
            </CardTitle>
            <CardDescription>Selecciona el tipo de servicio que necesitas</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tipoServicio} onValueChange={(v) => setTipoServicio(v as 'envio_completo' | 'solo_retiro')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="envio_completo" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Envío Completo
                </TabsTrigger>
                <TabsTrigger value="solo_retiro" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Solo Retiro
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {tipoServicio === 'solo_retiro' && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Servicio de solo retiro:</strong> Pasaremos a retirar mercadería en la dirección indicada. 
                  No se requiere información de destinatario.
                </AlertDescription>
              </Alert>
            )}
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
            <CardDescription>Información de quien envía el paquete</CardDescription>
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
              <div className="space-y-2">
                <Label htmlFor="remitente_codigo_postal">Código Postal</Label>
                <Input
                  id="remitente_codigo_postal"
                  value={formData.remitente_codigo_postal}
                  onChange={(e) => handleChange('remitente_codigo_postal', e.target.value)}
                  placeholder="Ej: 1000"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="remitente_direccion">Dirección *</Label>
                <Input
                  id="remitente_direccion"
                  value={formData.remitente_direccion}
                  onChange={(e) => handleChange('remitente_direccion', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remitente_ciudad">Ciudad</Label>
                <Input
                  id="remitente_ciudad"
                  value={formData.remitente_ciudad}
                  onChange={(e) => handleChange('remitente_ciudad', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Retiro en Domicilio */}
        {tipoServicio === 'envio_completo' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-warning" />
                Retiro en Domicilio
              </CardTitle>
              <CardDescription>¿Necesitas que retiremos el paquete de tu domicilio?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requiere_retiro"
                  checked={formData.requiere_retiro}
                  onCheckedChange={(checked) => handleChange('requiere_retiro', !!checked)}
                />
                <label
                  htmlFor="requiere_retiro"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Sí, solicito retiro en domicilio
                </label>
              </div>

              {formData.requiere_retiro && (
                <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
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
                      required={formData.requiere_retiro}
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
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notas_retiro">Notas para el retiro</Label>
                    <Textarea
                      id="notas_retiro"
                      value={formData.notas_retiro}
                      onChange={(e) => handleChange('notas_retiro', e.target.value)}
                      placeholder="Instrucciones especiales para el retiro..."
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Solo Retiro - Fecha y horario obligatorios */}
        {tipoServicio === 'solo_retiro' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-warning" />
                Programar Retiro
              </CardTitle>
              <CardDescription>Selecciona cuándo pasamos a retirar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fecha_retiro">Fecha de Retiro *</Label>
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
                  <Label htmlFor="horario_retiro">Horario Preferido</Label>
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
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notas_retiro">Notas para el retiro</Label>
                  <Textarea
                    id="notas_retiro"
                    value={formData.notas_retiro}
                    onChange={(e) => handleChange('notas_retiro', e.target.value)}
                    placeholder="Instrucciones especiales para el retiro..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Destinatario - Solo si es envio_completo */}
        {tipoServicio === 'envio_completo' && (formData.tipo_pago !== 'cuenta_corriente' || !formData.cliente_cta_cte_id) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-success" />
                Datos del Destinatario
              </CardTitle>
              <CardDescription>Información de quien recibe el paquete</CardDescription>
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
                    required={formData.tipo_pago !== 'cuenta_corriente'}
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
                    placeholder="Ej: 12345678 o 20-12345678-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destinatario_telefono">Teléfono *</Label>
                  <Input
                    id="destinatario_telefono"
                    value={formData.destinatario_telefono}
                    onChange={(e) => handleChange('destinatario_telefono', e.target.value)}
                    required={formData.tipo_pago !== 'cuenta_corriente'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destinatario_whatsapp" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    WhatsApp
                  </Label>
                  <Input
                    id="destinatario_whatsapp"
                    value={formData.destinatario_whatsapp}
                    onChange={(e) => handleChange('destinatario_whatsapp', e.target.value)}
                    placeholder="Ej: +54 9 11 1234-5678"
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
                <div className="space-y-2">
                  <Label htmlFor="destinatario_codigo_postal">Código Postal</Label>
                  <Input
                    id="destinatario_codigo_postal"
                    value={formData.destinatario_codigo_postal}
                    onChange={(e) => handleChange('destinatario_codigo_postal', e.target.value)}
                    placeholder="Ej: 1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destinatario_ciudad">Ciudad</Label>
                  <Input
                    id="destinatario_ciudad"
                    value={formData.destinatario_ciudad}
                    onChange={(e) => handleChange('destinatario_ciudad', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="destinatario_direccion">Dirección *</Label>
                  <Input
                    id="destinatario_direccion"
                    value={formData.destinatario_direccion}
                    onChange={(e) => handleChange('destinatario_direccion', e.target.value)}
                    required={formData.tipo_pago !== 'cuenta_corriente'}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preferencias de Entrega - Solo para envio_completo */}
        {tipoServicio === 'envio_completo' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Preferencias de Entrega
              </CardTitle>
              <CardDescription>Selecciona días y horarios preferidos para la entrega</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <Label htmlFor="sucursal_origen_id">Sucursal Origen</Label>
              <Select
                value={formData.sucursal_origen_id}
                onValueChange={(v) => handleChange('sucursal_origen_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tipoServicio === 'envio_completo' && (
              <div className="space-y-2">
                <Label htmlFor="sucursal_destino_id">Sucursal Destino</Label>
                <Select
                  value={formData.sucursal_destino_id}
                  onValueChange={(v) => handleChange('sucursal_destino_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted md:col-span-2">
                <div className="space-y-0.5">
                  <Label>Pago contra entrega</Label>
                  <p className="text-sm text-muted-foreground">
                    El destinatario pagará al recibir el paquete
                  </p>
                </div>
                <Switch
                  checked={formData.pago_contra_entrega}
                  onCheckedChange={(v) => handleChange('pago_contra_entrega', v)}
                />
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notas">Notas adicionales</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => handleChange('notas', e.target.value)}
                placeholder="Instrucciones especiales de entrega..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Resumen de Precio */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Resumen de Precio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conceptoPrecios.length > 0 && (
                <div className="space-y-1 pb-2 border-b">
                  <p className="text-xs text-muted-foreground font-medium">Desglose por conceptos:</p>
                  {conceptoPrecios.map((cp) => (
                    <div key={cp.id} className="flex justify-between text-sm">
                      <span>{cp.concepto?.nombre || 'Concepto'}</span>
                      <span>{formatCurrency(Number(cp.monto))}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedTarifa && conceptoPrecios.length === 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tarifa base ({selectedTarifa.nombre})</span>
                  <span>${Number(selectedTarifa.precio_base).toLocaleString('es-AR')}</span>
                </div>
              )}
              
              {formData.peso_kg && selectedTarifa?.precio_por_kg && (
                <div className="flex justify-between text-sm">
                  <span>Peso ({formData.peso_kg} kg x ${Number(selectedTarifa.precio_por_kg)})</span>
                  <span>
                    ${(
                      parseFloat(formData.peso_kg) *
                      Number(selectedTarifa.precio_por_kg)
                    ).toLocaleString('es-AR')}
                  </span>
                </div>
              )}

              <Separator className="my-2" />

              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total a Pagar</span>
                <span className="text-2xl font-bold text-primary">
                  {formatCurrency(precioCalculado)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={createShipmentMutation.isPending}
            className="bg-envios hover:bg-envios/90 text-white"
          >
            {createShipmentMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <PackagePlus className="h-4 w-4 mr-2" />
                {tipoServicio === 'solo_retiro' ? 'Crear Retiro' : 'Crear Envío'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
