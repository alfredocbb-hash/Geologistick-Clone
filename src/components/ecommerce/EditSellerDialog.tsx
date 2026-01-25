import { useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
}

interface EditSellerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller: Seller;
  onSuccess: () => void;
}

export function EditSellerDialog({ open, onOpenChange, seller, onSuccess }: EditSellerDialogProps) {
  const { tenantId } = useTenant();

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
    },
  });

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
      });
    }
  }, [seller, form]);

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
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await supabase
        .from('ecommerce_sellers')
        .update({
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
        })
        .eq('id', seller.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Seller actualizado' });
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
