import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';

const formSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  slug: z.string().min(2, 'El slug debe tener al menos 2 caracteres').regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  plan: z.enum(['trial', 'starter', 'professional', 'enterprise']),
  activo: z.boolean(),
  max_usuarios: z.coerce.number().min(1, 'Mínimo 1 usuario'),
  max_sucursales: z.coerce.number().min(1, 'Mínimo 1 sucursal'),
  max_envios_mes: z.coerce.number().min(1, 'Mínimo 1 envío'),
  trial_ends_at: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

interface EditTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    id: string;
    nombre: string;
    slug: string;
    plan: string;
    activo: boolean;
    max_usuarios: number;
    max_sucursales: number;
    max_envios_mes: number;
    trial_ends_at: string | null;
    ecommerce_enabled?: boolean;
    planificador_enabled?: boolean;
  };
  onSuccess: () => void;
}

export function EditTenantDialog({ open, onOpenChange, tenant, onSuccess }: EditTenantDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ecommerceEnabled, setEcommerceEnabled] = useState(tenant.ecommerce_enabled ?? false);
  const [planificadorEnabled, setPlanificadorEnabled] = useState(tenant.planificador_enabled ?? true);
  const [modoFlexEnabled, setModoFlexEnabled] = useState((tenant as any).modo_flex ?? false);
  const [modoFlexMixtoEnabled, setModoFlexMixtoEnabled] = useState((tenant as any).modo_flex_mixto ?? false);
  const [autoSeleccionTarifaEnabled, setAutoSeleccionTarifaEnabled] = useState(
    !!((tenant as any).configuracion?.auto_seleccion_tarifa_por_zona)
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: tenant.nombre,
      slug: tenant.slug,
      plan: tenant.plan as 'trial' | 'starter' | 'professional' | 'enterprise',
      activo: tenant.activo,
      max_usuarios: tenant.max_usuarios,
      max_sucursales: tenant.max_sucursales,
      max_envios_mes: tenant.max_envios_mes,
      trial_ends_at: tenant.trial_ends_at ? format(new Date(tenant.trial_ends_at), 'yyyy-MM-dd') : ''
    }
  });

  useEffect(() => {
    form.reset({
      nombre: tenant.nombre,
      slug: tenant.slug,
      plan: tenant.plan as 'trial' | 'starter' | 'professional' | 'enterprise',
      activo: tenant.activo,
      max_usuarios: tenant.max_usuarios,
      max_sucursales: tenant.max_sucursales,
      max_envios_mes: tenant.max_envios_mes,
      trial_ends_at: tenant.trial_ends_at ? format(new Date(tenant.trial_ends_at), 'yyyy-MM-dd') : ''
    });
    setEcommerceEnabled(tenant.ecommerce_enabled ?? false);
    setPlanificadorEnabled(tenant.planificador_enabled ?? true);
    setModoFlexEnabled((tenant as any).modo_flex ?? false);
    setModoFlexMixtoEnabled((tenant as any).modo_flex_mixto ?? false);
    setAutoSeleccionTarifaEnabled(!!((tenant as any).configuracion?.auto_seleccion_tarifa_por_zona));
  }, [tenant, form]);

  const extendTrial = (days: number) => {
    const currentDate = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : new Date();
    const newDate = addDays(currentDate, days);
    form.setValue('trial_ends_at', format(newDate, 'yyyy-MM-dd'));
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          nombre: values.nombre,
          slug: values.slug,
          plan: values.plan,
          activo: values.activo,
          max_usuarios: values.max_usuarios,
          max_sucursales: values.max_sucursales,
          max_envios_mes: values.max_envios_mes,
          trial_ends_at: values.plan === 'trial' && values.trial_ends_at
            ? new Date(values.trial_ends_at).toISOString()
            : null,
          ecommerce_enabled: ecommerceEnabled,
          planificador_enabled: planificadorEnabled,
          modo_flex: modoFlexEnabled,
          modo_flex_mixto: modoFlexMixtoEnabled,
          configuracion: {
            ...((tenant as any).configuracion || {}),
            auto_seleccion_tarifa_por_zona: autoSeleccionTarifaEnabled
          }
        })
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success('Empresa actualizada correctamente');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating tenant:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una empresa con ese slug');
      } else {
        toast.error('Error al actualizar la empresa');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Empresa</DialogTitle>
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
                    <Input {...field} placeholder="Mi Empresa" />
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
                  <Select value={field.value} onValueChange={field.onChange}>
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
                name="trial_ends_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fin del Trial</FormLabel>
                    <div className="space-y-2">
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => extendTrial(7)}
                        >
                          +7 días
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => extendTrial(14)}
                        >
                          +14 días
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => extendTrial(30)}
                        >
                          +30 días
                        </Button>
                      </div>
                    </div>
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
                      La empresa puede operar normalmente
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* e-Commerce Module Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base font-medium">Módulo e-Commerce</Label>
                <p className="text-sm text-muted-foreground">
                  Habilita gestión de sellers y sincronización con plataformas
                </p>
              </div>
              <Switch 
                checked={ecommerceEnabled} 
                onCheckedChange={setEcommerceEnabled} 
              />
            </div>

            {/* Planificador Module Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base font-medium">Módulo Planificador</Label>
                <p className="text-sm text-muted-foreground">
                  Habilita la creación y edición de rutas planificadas desde la web
                </p>
              </div>
              <Switch
                checked={planificadorEnabled}
                onCheckedChange={setPlanificadorEnabled}
              />
            </div>

            {/* Modo Flex Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base font-medium">Modo Flex</Label>
                <p className="text-sm text-muted-foreground">
                  Interfaz simplificada para operación de última milla
                </p>
              </div>
              <Switch 
                checked={modoFlexEnabled} 
                onCheckedChange={setModoFlexEnabled} 
              />
            </div>

            {/* Modo Flex Mixto Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base font-medium">Modo Flex Mixto</Label>
                <p className="text-sm text-muted-foreground">
                  Habilita fallback OCR cuando el seller no está autorizado en ML
                </p>
              </div>
              <Switch 
                checked={modoFlexMixtoEnabled} 
                onCheckedChange={setModoFlexMixtoEnabled}
                disabled={!modoFlexEnabled}
              />
            </div>

            {/* Auto-selección de Tarifa Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base font-medium">Auto-selección de Tarifa</Label>
                <p className="text-sm text-muted-foreground">
                  Selecciona la tarifa automáticamente según el destino, peso y volumen del envío
                </p>
              </div>
              <Switch
                checked={autoSeleccionTarifaEnabled}
                onCheckedChange={setAutoSeleccionTarifaEnabled}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
