import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  slug: z.string().min(2, 'El slug debe tener al menos 2 caracteres').regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  plan: z.enum(['trial', 'starter', 'professional', 'enterprise']),
  activo: z.boolean(),
  max_usuarios: z.coerce.number().min(1, 'Mínimo 1 usuario'),
  max_sucursales: z.coerce.number().min(1, 'Mínimo 1 sucursal'),
  max_envios_mes: z.coerce.number().min(1, 'Mínimo 1 envío'),
  trial_days: z.coerce.number().min(0, 'Mínimo 0 días')
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const planDefaults: Record<string, { usuarios: number; sucursales: number; envios: number }> = {
  trial: { usuarios: 5, sucursales: 3, envios: 500 },
  starter: { usuarios: 10, sucursales: 5, envios: 2000 },
  professional: { usuarios: 25, sucursales: 15, envios: 10000 },
  enterprise: { usuarios: 100, sucursales: 50, envios: 50000 }
};

export function CreateTenantDialog({ open, onOpenChange, onSuccess }: CreateTenantDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: '',
      slug: '',
      plan: 'trial',
      activo: true,
      max_usuarios: 5,
      max_sucursales: 3,
      max_envios_mes: 500,
      trial_days: 14
    }
  });

  const handlePlanChange = (plan: string) => {
    const defaults = planDefaults[plan];
    if (defaults) {
      form.setValue('max_usuarios', defaults.usuarios);
      form.setValue('max_sucursales', defaults.sucursales);
      form.setValue('max_envios_mes', defaults.envios);
    }
  };

  const generateSlug = (nombre: string) => {
    return nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const trialEndsAt = values.plan === 'trial' && values.trial_days > 0
        ? new Date(Date.now() + values.trial_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Create tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          nombre: values.nombre,
          slug: values.slug,
          plan: values.plan,
          activo: values.activo,
          max_usuarios: values.max_usuarios,
          max_sucursales: values.max_sucursales,
          max_envios_mes: values.max_envios_mes,
          trial_ends_at: trialEndsAt
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Create default branch
      const { error: branchError } = await supabase
        .from('sucursales')
        .insert({
          nombre: 'Sucursal Principal',
          direccion: 'Por configurar',
          tenant_id: tenant.id,
          codigo: 'MAIN',
          es_centro_logistico: true,
          activa: true
        });

      if (branchError) {
        console.error('Error creating branch:', branchError);
      }

      // Create branding
      const { error: brandingError } = await supabase
        .from('tenant_branding')
        .insert({
          tenant_id: tenant.id,
          nombre_app: values.nombre
        });

      if (brandingError) {
        console.error('Error creating branding:', brandingError);
      }

      toast.success('Empresa creada correctamente');
      form.reset();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating tenant:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una empresa con ese slug');
      } else {
        toast.error('Error al crear la empresa');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Empresa</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Empresa</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Mi Empresa"
                      onChange={(e) => {
                        field.onChange(e);
                        if (!form.getValues('slug')) {
                          form.setValue('slug', generateSlug(e.target.value));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (URL)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="mi-empresa" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="plan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handlePlanChange(value);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('plan') === 'trial' && (
              <FormField
                control={form.control}
                name="trial_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días de Trial</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="max_usuarios"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Usuarios</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_sucursales"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Sucursales</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_envios_mes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Envíos/Mes</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="activo"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel className="text-base">Empresa Activa</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      La empresa puede operar inmediatamente
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear Empresa
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
