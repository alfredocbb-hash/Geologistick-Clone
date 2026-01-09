import { useState } from 'react';
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
import { PackagePlus, ArrowLeft, User, MapPin, Package, DollarSign, Loader2 } from 'lucide-react';

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
    descripcion: '',
    peso_kg: '',
    dimensiones: '',
    valor_declarado: '',
    pago_contra_entrega: false,
    notas: '',
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

  const selectedTarifa = tarifas?.find(t => t.id === formData.tarifa_id);

  const calcularPrecio = () => {
    if (!selectedTarifa) return 0;
    const peso = parseFloat(formData.peso_kg) || 0;
    const precioBase = Number(selectedTarifa.precio_base) || 0;
    const precioPorKg = Number(selectedTarifa.precio_por_kg) || 0;
    return precioBase + (peso * precioPorKg);
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

      // 2. Crear destinatario
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

      // 3. Generar tracking number
      const { data: trackingData, error: trackingError } = await supabase
        .rpc('generate_tracking_number');

      if (trackingError) throw trackingError;

      // 4. Crear envío
      const { data: envio, error: envioError } = await supabase
        .from('envios')
        .insert({
          tracking_number: trackingData,
          remitente_id: remitente.id,
          destinatario_id: destinatario.id,
          sucursal_origen_id: formData.sucursal_origen_id || null,
          sucursal_destino_id: formData.sucursal_destino_id || null,
          tarifa_id: formData.tarifa_id || null,
          descripcion: formData.descripcion,
          peso_kg: parseFloat(formData.peso_kg) || null,
          dimensiones: formData.dimensiones,
          valor_declarado: parseFloat(formData.valor_declarado) || null,
          precio_total: calcularPrecio(),
          pago_contra_entrega: formData.pago_contra_entrega,
          notas: formData.notas,
          created_by: user?.id,
        })
        .select()
        .single();

      if (envioError) throw envioError;

      return envio;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['envios'] });
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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

        {/* Destinatario */}
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
              <Label htmlFor="destinatario_telefono">Teléfono *</Label>
              <Input
                id="destinatario_telefono"
                value={formData.destinatario_telefono}
                onChange={(e) => handleChange('destinatario_telefono', e.target.value)}
                required
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
                required
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
              {selectedTarifa && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Tarifa base ({selectedTarifa.nombre})</span>
                    <span>${Number(selectedTarifa.precio_base).toLocaleString('es-AR')}</span>
                  </div>
                  {formData.peso_kg && (
                    <div className="flex justify-between text-sm">
                      <span>Peso ({formData.peso_kg} kg x ${Number(selectedTarifa.precio_por_kg)})</span>
                      <span>${(parseFloat(formData.peso_kg) * Number(selectedTarifa.precio_por_kg)).toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  <Separator />
                </>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">${calcularPrecio().toLocaleString('es-AR')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button 
            type="submit" 
            className="gradient-primary"
            disabled={createShipmentMutation.isPending}
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
    </div>
  );
}
