import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, User, UserPlus, UserX } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useFormDraft } from '@/hooks/useFormDraft';
import { DraftIndicator, DraftSavingIndicator } from '@/components/ui/draft-indicator';

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
  plataforma: z.string().default('manual'),
  store_url: z.string().optional(),
  sucursal_pickup_id: z.string().optional(),
  tarifa_id: z.string().optional(),
  tiene_cuenta_corriente: z.boolean().default(false),
  limite_credito: z.number().default(0),
  // User linking fields
  vincular_usuario: z.enum(['ninguno', 'existente', 'nuevo']).default('ninguno'),
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

interface CreateSellerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const defaultValues: FormValues = {
  nombre: '',
  email: '',
  plataforma: 'manual',
  tiene_cuenta_corriente: false,
  limite_credito: 0,
  vincular_usuario: 'ninguno',
  user_id: '',
  user_email: '',
  user_password: '',
  razon_social: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  provincia: '',
  codigo_postal: '',
  cuit: '',
  store_url: '',
  sucursal_pickup_id: '',
  tarifa_id: '',
};

export function CreateSellerDialog({ open, onOpenChange, onSuccess }: CreateSellerDialogProps) {
  const { tenantId } = useTenant();
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const {
    formData: draftData,
    setFormData: setDraftData,
    hasDraft,
    lastSaved,
    clearDraft,
    discardDraft,
    isDraftRecovered,
    setIsDraftRecovered,
  } = useFormDraft('create-seller', defaultValues);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Load recovered draft into form
  useEffect(() => {
    if (isDraftRecovered && open) {
      form.reset(draftData);
    }
  }, [isDraftRecovered, open]);

  // Sync form changes to draft
  useEffect(() => {
    const subscription = form.watch((value) => {
      setDraftData(value as FormValues);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, setDraftData]);

  const vincularUsuario = form.watch('vincular_usuario');

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

  // Fetch sucursales and tarifas for selects
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

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      let linkedUserId: string | null = null;

      // Handle user linking
      if (values.vincular_usuario === 'existente' && values.user_id) {
        linkedUserId = values.user_id;
        await ensureSellerRole(linkedUserId);
      } else if (values.vincular_usuario === 'nuevo' && values.user_email && values.user_password) {
        setIsCreatingUser(true);
        try {
          // Create user via edge function
          const { data: session } = await supabase.auth.getSession();
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
          
          linkedUserId = data.user_id;
        } finally {
          setIsCreatingUser(false);
        }
      }

      // Create seller
      const { data: newSeller, error } = await supabase
        .from('ecommerce_sellers')
        .insert({
          tenant_id: tenantId,
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
          user_id: linkedUserId,
        })
        .select('id')
        .single();
      if (error) throw error;

      // Auto-link seller to cliente
      if (newSeller && tenantId) {
        try {
          // Search for existing client by email or phone
          let clienteId: string | null = null;
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
            // Create new client from seller data
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

          if (clienteId) {
            await supabase
              .from('ecommerce_sellers')
              .update({ cliente_id: clienteId } as any)
              .eq('id', newSeller.id);
          }
        } catch (linkError) {
          console.error('Error linking seller to client:', linkError);
          // Non-blocking: seller was created successfully
        }
      }
    },
    onSuccess: () => {
      toast({ title: 'Seller creado correctamente' });
      clearDraft();
      form.reset(defaultValues);
      onSuccess();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error al crear seller', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Seller</DialogTitle>
          <DialogDescription>
            Registra una nueva tienda online para gestionar sus pedidos
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {isDraftRecovered && (
              <DraftIndicator
                lastSaved={lastSaved}
                onDiscard={() => {
                  discardDraft();
                  form.reset(defaultValues);
                }}
                onDismiss={() => setIsDraftRecovered(false)}
              />
            )}

            <div className="flex justify-end">
              <DraftSavingIndicator hasDraft={hasDraft} lastSaved={lastSaved} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Mi Tienda" {...field} />
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
                      <Input type="email" placeholder="contacto@tienda.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="razon_social"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razón Social</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input placeholder="20-12345678-9" {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plataforma"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plataforma</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="tiendanube">Tiendanube</SelectItem>
                        <SelectItem value="mercadolibre">MercadoLibre</SelectItem>
                        <SelectItem value="shopify">Shopify</SelectItem>
                        <SelectItem value="woocommerce">WooCommerce</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="store_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de la Tienda</FormLabel>
                  <FormControl>
                    <Input placeholder="https://mitienda.mitiendanube.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="direccion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección de Retiro</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="ciudad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="provincia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provincia</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="codigo_postal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CP</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Cuenta Corriente</Label>
                <p className="text-sm text-muted-foreground">
                  Habilitar cuenta corriente para este seller
                </p>
              </div>
              <FormField
                control={form.control}
                name="tiene_cuenta_corriente"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
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

            {/* User Linking Section */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="space-y-1">
                <Label className="text-base font-medium">Acceso al Portal de Sellers</Label>
                <p className="text-sm text-muted-foreground">
                  Vincula un usuario para que el seller pueda acceder al portal y ver sus pedidos
                </p>
              </div>

              <FormField
                control={form.control}
                name="vincular_usuario"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="space-y-3"
                      >
                        <div className="flex items-center space-x-3 rounded-md border p-3">
                          <RadioGroupItem value="ninguno" id="ninguno" />
                          <Label htmlFor="ninguno" className="flex items-center gap-2 cursor-pointer flex-1">
                            <UserX className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">Sin acceso</p>
                              <p className="text-sm text-muted-foreground">El seller no tendrá acceso al portal</p>
                            </div>
                          </Label>
                        </div>
                        
                        <div className="flex items-start space-x-3 rounded-md border p-3">
                          <RadioGroupItem value="existente" id="existente" className="mt-1" />
                          <Label htmlFor="existente" className="flex items-start gap-2 cursor-pointer flex-1">
                            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium">Vincular usuario existente</p>
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
                                          {availableUsers?.map((u) => (
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
              <Button type="submit" disabled={createMutation.isPending || isCreatingUser}>
                {(createMutation.isPending || isCreatingUser) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Seller
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
