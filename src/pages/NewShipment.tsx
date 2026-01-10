import { useState, useEffect } from 'react';
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
import { PackagePlus, ArrowLeft, User, MapPin, Package, DollarSign, Loader2, CreditCard } from 'lucide-react';

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

export default function NewShipment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    // Remitente
    remitente_nombre: '',
    remitente_apellido: '',
    remitente_telefono: '',
    remitente_email: '',
    remitente_direccion: '',
    remitente_ciudad: '',
    // Destinatario
    destinatario_nombre: '',
    destinatario_apellido: '',
    destinatario_telefono: '',
    destinatario_email: '',
    destinatario_direccion: '',
    destinatario_ciudad: '',
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
  });

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

  // Fetch precios por concepto para la tarifa seleccionada
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

  // Fetch clientes con cuenta corriente
  const { data: clientesCtaCte = [] } = useQuery({
    queryKey: ['clientes_cta_cte'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('tiene_cuenta_corriente', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
    enabled: formData.tipo_pago === 'cuenta_corriente',
  });

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
    
    // Si hay conceptos definidos, usar esos; si no, usar precio base
    const baseTotal = totalConceptos > 0 ? totalConceptos : precioBase;
    return baseTotal + (peso * precioPorKg);
  };

  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      // 1. Crear remitente
      const { data: remitente, error: remError } = await supabase
        .from('clientes')
        .insert({
          nombre: formData.remitente_nombre,
          apellido: formData.remitente_apellido,
          telefono: formData.remitente_telefono,
          email: formData.remitente_email,
          direccion: formData.remitente_direccion,
          ciudad: formData.remitente_ciudad,
          sucursal_id: formData.sucursal_origen_id || null,
        })
        .select()
        .single();

      if (remError) throw remError;

      // 2. Crear destinatario (o usar cliente con cta cte)
      let destinatarioId = formData.cliente_cta_cte_id;
      
      if (!destinatarioId) {
        const { data: destinatario, error: destError } = await supabase
          .from('clientes')
          .insert({
            nombre: formData.destinatario_nombre,
            apellido: formData.destinatario_apellido,
            telefono: formData.destinatario_telefono,
            email: formData.destinatario_email,
            direccion: formData.destinatario_direccion,
            ciudad: formData.destinatario_ciudad,
            sucursal_id: formData.sucursal_destino_id || null,
          })
          .select()
          .single();

        if (destError) throw destError;
        destinatarioId = destinatario.id;
      }

      // 3. Generar tracking number
      const { data: trackingData, error: trackingError } = await supabase
        .rpc('generate_tracking_number');

      if (trackingError) throw trackingError;

      const precioTotal = calcularPrecio();

      // 4. Crear envío
      const { data: envio, error: envioError } = await supabase
        .from('envios')
        .insert({
          tracking_number: trackingData,
          remitente_id: remitente.id,
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
        })
        .select()
        .single();

      if (envioError) throw envioError;

      // 5. Crear detalles del envío por concepto
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

      // 6. Si es cuenta corriente, crear movimiento
      if (formData.tipo_pago === 'cuenta_corriente' && formData.cliente_cta_cte_id) {
        // Obtener saldo actual del cliente
        const { data: cliente } = await supabase
          .from('clientes')
          .select('saldo_cuenta_corriente')
          .eq('id', formData.cliente_cta_cte_id)
          .single();

        const saldoAnterior = Number(cliente?.saldo_cuenta_corriente) || 0;
        const saldoNuevo = saldoAnterior - precioTotal;

        // Crear movimiento
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

        // Actualizar saldo del cliente
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
      queryClient.invalidateQueries({ queryKey: ['clientes_cta_cte'] });
      toast({
        title: '¡Envío creado!',
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
    createShipmentMutation.mutate();
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <PackagePlus className="h-8 w-8 text-shipments" />
            Nuevo Envío
          </h1>
          <p className="text-muted-foreground mt-1">
            Completa los datos para crear un nuevo envío
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
          <CardContent className="grid gap-4 md:grid-cols-2">
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
          </CardContent>
        </Card>

        {/* Destinatario - Solo mostrar si no es cuenta corriente o no hay cliente seleccionado */}
        {(formData.tipo_pago !== 'cuenta_corriente' || !formData.cliente_cta_cte_id) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-success" />
                Datos del Destinatario
              </CardTitle>
              <CardDescription>Información de quien recibe el paquete</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
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
                <Label htmlFor="destinatario_telefono">Teléfono *</Label>
                <Input
                  id="destinatario_telefono"
                  value={formData.destinatario_telefono}
                  onChange={(e) => handleChange('destinatario_telefono', e.target.value)}
                  required={formData.tipo_pago !== 'cuenta_corriente'}
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
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="destinatario_direccion">Dirección *</Label>
                <Input
                  id="destinatario_direccion"
                  value={formData.destinatario_direccion}
                  onChange={(e) => handleChange('destinatario_direccion', e.target.value)}
                  required={formData.tipo_pago !== 'cuenta_corriente'}
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
              {/* Mostrar desglose por conceptos si hay */}
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
                  {formatCurrency(calcularPrecio())}
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
                Crear Envío
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
