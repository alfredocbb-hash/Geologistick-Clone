import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, UserPlus, UserX, Link2Off, CheckCircle, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { CreateSellerTarifaDialog } from './CreateSellerTarifaDialog';

const formSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  razon_social: z.string().optional(),
  email: z.string().email('Email inválido'),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  ciudad: z.string().optional(),
  provincia: z.string().optional(),
  codigo_postal: z.string().optional(),
  cuit: z.string().optional(),
  plataforma: z.string(),
  store_url: z.string().optional(),
  sucursal_pickup_id: z.string().optional(),
  tarifa_id: z.string().optional(),
  tiene_cuenta_corriente: z.boolean(),
  limite_credito: z.number(),
  activo: z.boolean(),
  // Shipping options
  min_delivery_days: z.number().min(1).default(3),
  max_delivery_days: z.number().min(1).default(5),
  tarifa_express_id: z.string().optional(),
  express_delivery_days: z.number().min(1).default(1),
  express_surcharge: z.number().default(0),
  permite_pickup: z.boolean().default(false),
  pickup_surcharge: z.number().default(0),
  // User linking fields
  vincular_usuario: z.enum(['ninguno', 'existente', 'nuevo', 'mantener']).default('mantener'),
  user_id: z.string().optional(),
  user_email: z.string().email('Email inválido').optional().or(z.literal('')),
  user_password: z.string().min(6, 'Mínimo 6 caracteres').optional().or(z.literal('')),
}).refine((data) => {
  if (data.vincular_usuario === 'existente' && !data.user_id) {
    return false;
  }
  return true;
}, {
  message: 'Selecciona un usuario',
  path: ['user_id'],
}).refine((data) => {
  if (data.vincular_usuario === 'nuevo' && !data.user_email) {
    return false;
  }
  return true;
}, {
  message: 'Email requerido',
  path: ['user_email'],
}).refine((data) => {
  if (data.vincular_usuario === 'nuevo' && (!data.user_password || data.user_password.length < 6)) {
    return false;
  }
  return true;
}, {
  message: 'Contraseña requerida (mínimo 6 caracteres)',
  path: ['user_password'],
});

type FormValues = z.infer<typeof formSchema>;

interface Seller {
  id: string;
  nombre: string;
  razon_social: string | null;
  email: string;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  cuit: string | null;
  plataforma: string;
  store_url: string | null;
  sucursal_pickup_id: string | null;
  tarifa_id: string | null;
  tiene_cuenta_corriente: boolean;
  limite_credito: number;
  activo: boolean;
  user_id?: string | null;
  // Shipping options
  min_delivery_days?: number | null;
  max_delivery_days?: number | null;
  tarifa_express_id?: string | null;
  express_delivery_days?: number | null;
  express_surcharge?: number | null;
  permite_pickup?: boolean | null;
  pickup_surcharge?: number | null;
}

interface EditSellerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller: Seller;
  onSuccess: () => void;
}

export function EditSellerDialog({ open, onOpenChange, seller, onSuccess }: EditSellerDialogProps) {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showCreateTarifa, setShowCreateTarifa] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: seller.nombre,
      razon_social: seller.razon_social || '',
      email: seller.email,
      telefono: seller.telefono || '',
      direccion: seller.direccion || '',
      ciudad: seller.ciudad || '',
      provincia: seller.provincia || '',
      codigo_postal: seller.codigo_postal || '',
      cuit: seller.cuit || '',
      plataforma: seller.plataforma,
      store_url: seller.store_url || '',
      sucursal_pickup_id: seller.sucursal_pickup_id || '',
      tarifa_id: seller.tarifa_id || '',
      tiene_cuenta_corriente: seller.tiene_cuenta_corriente,
      limite_credito: seller.limite_credito || 0,
      activo: seller.activo,
      // Shipping options
      min_delivery_days: seller.min_delivery_days || 3,
      max_delivery_days: seller.max_delivery_days || 5,
      tarifa_express_id: seller.tarifa_express_id || '__none__',
      express_delivery_days: seller.express_delivery_days || 1,
      express_surcharge: seller.express_surcharge || 0,
      permite_pickup: seller.permite_pickup || false,
      pickup_surcharge: seller.pickup_surcharge || 0,
      // User linking
      vincular_usuario: seller.user_id ? 'mantener' : 'ninguno',
      user_id: '',
      user_email: '',
      user_password: '',
    },
  });

  const vincularUsuario = form.watch('vincular_usuario');

  useEffect(() => {
    if (seller) {
      form.reset({
        nombre: seller.nombre,
        razon_social: seller.razon_social || '',
        email: seller.email,
        telefono: seller.telefono || '',
        direccion: seller.direccion || '',
        ciudad: seller.ciudad || '',
        provincia: seller.provincia || '',
        codigo_postal: seller.codigo_postal || '',
        cuit: seller.cuit || '',
        plataforma: seller.plataforma,
        store_url: seller.store_url || '',
        sucursal_pickup_id: seller.sucursal_pickup_id || '',
        tarifa_id: seller.tarifa_id || '',
        tiene_cuenta_corriente: seller.tiene_cuenta_corriente,
        limite_credito: seller.limite_credito || 0,
        activo: seller.activo,
        // Shipping options
        min_delivery_days: seller.min_delivery_days || 3,
        max_delivery_days: seller.max_delivery_days || 5,
        tarifa_express_id: seller.tarifa_express_id || '__none__',
        express_delivery_days: seller.express_delivery_days || 1,
        express_surcharge: seller.express_surcharge || 0,
        permite_pickup: seller.permite_pickup || false,
        pickup_surcharge: seller.pickup_surcharge || 0,
        // User linking
        vincular_usuario: seller.user_id ? 'mantener' : 'ninguno',
        user_id: '',
        user_email: '',
        user_password: '',
      });
    }
  }, [seller, form]);

  // Fetch linked user info
  const { data: linkedUser } = useQuery({
    queryKey: ['linked-user', seller.user_id],
    queryFn: async () => {
      if (!seller.user_id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, nombre, apellido')
        .eq('user_id', seller.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!seller.user_id && open,
    refetchOnWindowFocus: false,
  });

  // Fetch available users for linking
  const { data: availableUsers } = useQuery({
    queryKey: ['users-for-seller', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, nombre, apellido')
        .eq('tenant_id', tenantId)
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && open,
    refetchOnWindowFocus: false,
  });

  // Fetch sucursales and tarifas
  const { data: sucursales } = useQuery({
    queryKey: ['sucursales-active', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && open,
    refetchOnWindowFocus: false,
  });

  const { data: tarifas } = useQuery({
    queryKey: ['tarifas-active', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarifas')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && open,
    refetchOnWindowFocus: false,
  });

  // Function to ensure user has seller role (idempotent using upsert)
  const ensureSellerRole = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .upsert(
        { user_id: userId, role: 'seller' },
        { onConflict: 'user_id,role', ignoreDuplicates: true }
      );
    if (error) throw error;
  };

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      let newUserId: string | null = seller.user_id || null;

      // Handle user linking changes
      if (values.vincular_usuario === 'ninguno') {
        newUserId = null;
      } else if (values.vincular_usuario === 'existente' && values.user_id) {
        newUserId = values.user_id;
        await ensureSellerRole(newUserId);
      } else if (values.vincular_usuario === 'nuevo' && values.user_email && values.user_password) {
        setIsCreatingUser(true);
        try {
          // Create user via edge function
          const { data, error } = await supabase.functions.invoke('create-user', {
            body: {
              email: values.user_email,
              password: values.user_password,
              nombre: values.nombre,
              roles: ['seller'],
            },
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          
          newUserId = data.user_id;
        } finally {
          setIsCreatingUser(false);
        }
      }
      // If 'mantener', keep the current user_id

      // Auto-link seller to cliente if not yet linked
      let clienteId: string | undefined = undefined;
      try {
        // Check if seller already has a cliente_id by querying DB
        const { data: currentSeller } = await supabase
          .from('ecommerce_sellers')
          .select('cliente_id')
          .eq('id', seller.id)
          .single();

        if (!(currentSeller as any)?.cliente_id && tenantId) {
          // Search for existing client by email or phone
          const { data: existingCliente } = await supabase
            .from('clientes')
            .select('id')
            .eq('tenant_id', tenantId)
            .or(`email.eq.${values.email}${values.telefono ? `,telefono.eq.${values.telefono}` : ''}`)
            .limit(1)
            .maybeSingle();

          if (existingCliente) {
            clienteId = existingCliente.id;
          } else {
            const { data: newCliente } = await supabase
              .from('clientes')
              .insert({
                tenant_id: tenantId,
                nombre: values.nombre,
                email: values.email,
                telefono: values.telefono || 'Sin teléfono',
                direccion: values.direccion || 'Sin dirección',
                ciudad: values.ciudad || null,
                codigo_postal: values.codigo_postal || null,
                dni_cuit: values.cuit || null,
                razon_social: values.razon_social || null,
              })
              .select('id')
              .single();
            if (newCliente) clienteId = newCliente.id;
          }
        }
      } catch (linkError) {
        console.error('Error linking seller to client:', linkError);
      }

      const updateData: any = {
          nombre: values.nombre,
          razon_social: values.razon_social || null,
          email: values.email,
          telefono: values.telefono || null,
          direccion: values.direccion || null,
          ciudad: values.ciudad || null,
          provincia: values.provincia || null,
          codigo_postal: values.codigo_postal || null,
          cuit: values.cuit || null,
          plataforma: values.plataforma,
          store_url: values.store_url || null,
          sucursal_pickup_id: values.sucursal_pickup_id || null,
          tarifa_id: values.tarifa_id || null,
          tiene_cuenta_corriente: values.tiene_cuenta_corriente,
          limite_credito: values.limite_credito,
          activo: values.activo,
          min_delivery_days: values.min_delivery_days,
          max_delivery_days: values.max_delivery_days,
          tarifa_express_id: values.tarifa_express_id === '__none__' ? null : (values.tarifa_express_id || null),
          express_delivery_days: values.express_delivery_days,
          express_surcharge: values.express_surcharge,
          permite_pickup: values.permite_pickup,
          pickup_surcharge: values.pickup_surcharge,
          user_id: newUserId,
      };
      if (clienteId) updateData.cliente_id = clienteId;

      const { error } = await supabase
        .from('ecommerce_sellers')
        .update(updateData)
        .eq('id', seller.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Seller actualizado' });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error al actualizar', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Seller</DialogTitle>
          <DialogDescription>
            Modifica la configuración de {seller.nombre}
          </DialogDescription>
        </DialogHeader>

        {form.formState.isDirty && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertDescription>
              Tienes cambios sin guardar. Se perderán si cierras sin guardar.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Estado</Label>
                <p className="text-sm text-muted-foreground">Seller activo/inactivo</p>
              </div>
              <FormField
                control={form.control}
                name="activo"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value || ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cuit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CUIT</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="plataforma"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plataforma</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="mercadolibre">MercadoLibre</SelectItem>
                        <SelectItem value="tiendanube">Tiendanube</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sucursal_pickup_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sucursal de Pickup</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sucursales?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tarifa_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa</FormLabel>
                    <div className="flex gap-2">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tarifas?.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setShowCreateTarifa(true)}
                        title="Crear tarifa personalizada"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CreateSellerTarifaDialog
                open={showCreateTarifa}
                onOpenChange={setShowCreateTarifa}
                sellerId={seller.id}
                sellerNombre={seller.nombre}
                onSuccess={(tarifaId) => {
                  form.setValue('tarifa_id', tarifaId, { shouldDirty: true });
                  queryClient.invalidateQueries({ queryKey: ['tarifas-active'] });
                }}
              />
            </div>

            {/* Logistics Account Toggle */}
            {form.watch('plataforma') === 'mercadolibre' && (
              <div className="flex items-center justify-between rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                <div className="space-y-0.5">
                  <Label>Cuenta Logística</Label>
                  <p className="text-sm text-muted-foreground">
                    Usar esta cuenta para registrar envíos Flex de sellers no autorizados
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="es_cuenta_logistica"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Cuenta Corriente</Label>
                <p className="text-sm text-muted-foreground">Habilitar cuenta corriente</p>
              </div>
              <FormField
                control={form.control}
                name="tiene_cuenta_corriente"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {form.watch('tiene_cuenta_corriente') && (
              <FormField
                control={form.control}
                name="limite_credito"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Límite de Crédito</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Shipping Options Section */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="space-y-1">
                <Label className="text-base font-medium">Opciones de Envío (Tiendanube)</Label>
                <p className="text-sm text-muted-foreground">
                  Configuración de tarifas para el checkout de Tiendanube
                </p>
              </div>

              {/* Standard Delivery Days */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="min_delivery_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Días mínimos entrega</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 3)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_delivery_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Días máximos entrega</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Express Shipping */}
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-medium">Envío Express (opcional)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tarifa_express_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tarifa Express</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || '__none__'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sin express" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">Sin express</SelectItem>
                            {tarifas?.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="express_delivery_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Días entrega express</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="express_surcharge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recargo Express ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Monto adicional sobre la tarifa express</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Pickup Option */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Retiro en Sucursal</Label>
                    <p className="text-sm text-muted-foreground">Permitir retiro en sucursales habilitadas</p>
                  </div>
                  <FormField
                    control={form.control}
                    name="permite_pickup"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                {form.watch('permite_pickup') && (
                  <FormField
                    control={form.control}
                    name="pickup_surcharge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descuento/Recargo Pickup ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Valor negativo = descuento, positivo = recargo</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* User Linking Section */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="space-y-1">
                <Label className="text-base font-medium">Acceso al Portal de Sellers</Label>
                <p className="text-sm text-muted-foreground">
                  Vincula un usuario para que el seller pueda acceder al portal y ver sus pedidos
                </p>
              </div>

              {/* Show current linked user if exists */}
              {seller.user_id && linkedUser && vincularUsuario === 'mantener' && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    <span className="font-medium">Usuario vinculado:</span> {linkedUser.nombre} {linkedUser.apellido} ({linkedUser.email})
                  </AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="vincular_usuario"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="space-y-3"
                      >
                        {seller.user_id && (
                          <div className="flex items-center space-x-3 rounded-md border p-3">
                            <RadioGroupItem value="mantener" id="mantener" />
                            <Label htmlFor="mantener" className="flex items-center gap-2 cursor-pointer flex-1">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <div>
                                <p className="font-medium">Mantener usuario actual</p>
                                <p className="text-sm text-muted-foreground">Conservar la vinculación existente</p>
                              </div>
                            </Label>
                          </div>
                        )}

                        <div className="flex items-center space-x-3 rounded-md border p-3">
                          <RadioGroupItem value="ninguno" id="ninguno" />
                          <Label htmlFor="ninguno" className="flex items-center gap-2 cursor-pointer flex-1">
                            {seller.user_id ? (
                              <Link2Off className="h-4 w-4 text-destructive" />
                            ) : (
                              <UserX className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium">{seller.user_id ? 'Desvincular usuario' : 'Sin acceso'}</p>
                              <p className="text-sm text-muted-foreground">
                                {seller.user_id ? 'Quitar el acceso del usuario actual' : 'El seller no tendrá acceso al portal'}
                              </p>
                            </div>
                          </Label>
                        </div>
                        
                        <div className="flex items-start space-x-3 rounded-md border p-3">
                          <RadioGroupItem value="existente" id="existente" className="mt-1" />
                          <Label htmlFor="existente" className="flex items-start gap-2 cursor-pointer flex-1">
                            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium">{seller.user_id ? 'Cambiar a otro usuario' : 'Vincular usuario existente'}</p>
                              <p className="text-sm text-muted-foreground mb-2">Selecciona un usuario del sistema</p>
                              {vincularUsuario === 'existente' && (
                                <FormField
                                  control={form.control}
                                  name="user_id"
                                  render={({ field: userField }) => (
                                    <FormItem>
                                      <Select onValueChange={userField.onChange} value={userField.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar usuario..." />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {availableUsers?.filter(u => u.user_id !== seller.user_id).map((u) => (
                                            <SelectItem key={u.user_id} value={u.user_id}>
                                              {u.nombre} {u.apellido} ({u.email})
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                            </div>
                          </Label>
                        </div>
                        
                        <div className="flex items-start space-x-3 rounded-md border p-3">
                          <RadioGroupItem value="nuevo" id="nuevo" className="mt-1" />
                          <Label htmlFor="nuevo" className="flex items-start gap-2 cursor-pointer flex-1">
                            <UserPlus className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium">Crear usuario nuevo</p>
                              <p className="text-sm text-muted-foreground mb-2">Crea una cuenta nueva para el seller</p>
                              {vincularUsuario === 'nuevo' && (
                                <div className="space-y-3">
                                  <FormField
                                    control={form.control}
                                    name="user_email"
                                    render={({ field: emailField }) => (
                                      <FormItem>
                                        <FormLabel>Email de acceso</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="email" 
                                            placeholder="usuario@email.com" 
                                            {...emailField} 
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="user_password"
                                    render={({ field: passField }) => (
                                      <FormItem>
                                        <FormLabel>Contraseña</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="password" 
                                            placeholder="Mínimo 6 caracteres" 
                                            {...passField} 
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              )}
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || isCreatingUser}>
                {(updateMutation.isPending || isCreatingUser) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
