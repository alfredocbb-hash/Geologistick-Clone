import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Shield, Calculator, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InsuranceConfig {
  id?: string;
  tenant_id?: string;
  valor_minimo_declarado: number;
  seguro_base: number;
  porcentaje_excedente: number;
  valor_maximo_asegurado: number;
  activo: boolean;
}

interface InsuranceConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InsuranceConfigDialog({ open, onOpenChange }: InsuranceConfigDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<InsuranceConfig>({
    valor_minimo_declarado: 40000,
    seguro_base: 2400,
    porcentaje_excedente: 6,
    valor_maximo_asegurado: 500000,
    activo: true,
  });

  const [exampleValue, setExampleValue] = useState(100000);

  // Fetch existing config
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ['configuracion_seguro', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return null;
      const { data, error } = await supabase
        .from('configuracion_seguro')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle();
      if (error) throw error;
      return data as InsuranceConfig | null;
    },
    enabled: !!profile?.tenant_id && open,
  });

  useEffect(() => {
    if (existingConfig) {
      setFormData({
        id: existingConfig.id,
        tenant_id: existingConfig.tenant_id,
        valor_minimo_declarado: existingConfig.valor_minimo_declarado,
        seguro_base: existingConfig.seguro_base,
        porcentaje_excedente: existingConfig.porcentaje_excedente,
        valor_maximo_asegurado: existingConfig.valor_maximo_asegurado,
        activo: existingConfig.activo,
      });
    }
  }, [existingConfig]);

  // Calculate insurance example
  const calculateInsurance = (valorDeclarado: number): { total: number; breakdown: string } => {
    const valorFinal = Math.min(
      Math.max(valorDeclarado, formData.valor_minimo_declarado),
      formData.valor_maximo_asegurado
    );

    if (valorFinal <= formData.valor_minimo_declarado) {
      return {
        total: formData.seguro_base,
        breakdown: `Base: ${formatCurrency(formData.seguro_base)}`,
      };
    }

    const excedente = valorFinal - formData.valor_minimo_declarado;
    const costoExcedente = excedente * (formData.porcentaje_excedente / 100);
    const total = formData.seguro_base + costoExcedente;

    return {
      total,
      breakdown: `Base: ${formatCurrency(formData.seguro_base)} + Excedente (${formatCurrency(excedente)} × ${formData.porcentaje_excedente}%): ${formatCurrency(costoExcedente)}`,
    };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id) throw new Error('No tenant');

      const dataToSave = {
        tenant_id: profile.tenant_id,
        valor_minimo_declarado: formData.valor_minimo_declarado,
        seguro_base: formData.seguro_base,
        porcentaje_excedente: formData.porcentaje_excedente,
        valor_maximo_asegurado: formData.valor_maximo_asegurado,
        activo: formData.activo,
      };

      if (existingConfig?.id) {
        const { error } = await supabase
          .from('configuracion_seguro')
          .update(dataToSave)
          .eq('id', existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('configuracion_seguro')
          .insert(dataToSave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion_seguro'] });
      toast.success('Configuración de seguro guardada');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Error: ' + error.message);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const exampleResult = calculateInsurance(exampleValue);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Configuración de Seguro
          </DialogTitle>
          <DialogDescription>
            Define los parámetros para calcular el costo del seguro basado en el valor declarado.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Cargando...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label className="font-medium">Seguro obligatorio</Label>
                <p className="text-xs text-muted-foreground">
                  Si está activo, todos los envíos incluirán seguro
                </p>
              </div>
              <Switch
                checked={formData.activo}
                onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_minimo">Valor mínimo declarado</Label>
                <Input
                  id="valor_minimo"
                  type="number"
                  step="1000"
                  value={formData.valor_minimo_declarado}
                  onChange={(e) => setFormData({ ...formData, valor_minimo_declarado: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  Valor base para calcular el seguro
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seguro_base">Costo base del seguro</Label>
                <Input
                  id="seguro_base"
                  type="number"
                  step="100"
                  value={formData.seguro_base}
                  onChange={(e) => setFormData({ ...formData, seguro_base: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  Costo fijo hasta el mínimo
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="porcentaje">Porcentaje excedente (%)</Label>
                <Input
                  id="porcentaje"
                  type="number"
                  step="0.1"
                  value={formData.porcentaje_excedente}
                  onChange={(e) => setFormData({ ...formData, porcentaje_excedente: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  Se aplica sobre el valor que excede el mínimo
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maximo">Valor máximo asegurado</Label>
                <Input
                  id="maximo"
                  type="number"
                  step="10000"
                  value={formData.valor_maximo_asegurado}
                  onChange={(e) => setFormData({ ...formData, valor_maximo_asegurado: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  Tope máximo para el seguro
                </p>
              </div>
            </div>

            {/* Example Calculator */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Simulador de Cálculo</Label>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="example" className="whitespace-nowrap text-sm">
                      Valor declarado:
                    </Label>
                    <Input
                      id="example"
                      type="number"
                      step="10000"
                      value={exampleValue}
                      onChange={(e) => setExampleValue(parseFloat(e.target.value) || 0)}
                      className="w-32"
                    />
                  </div>
                  <div className="p-3 bg-background rounded-lg">
                    <p className="text-sm text-muted-foreground">{exampleResult.breakdown}</p>
                    <p className="text-lg font-bold mt-1">
                      Total Seguro: {formatCurrency(exampleResult.total)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {exampleValue > formData.valor_maximo_asegurado && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  El valor declarado excede el máximo asegurado. Se aplicará el tope de {formatCurrency(formData.valor_maximo_asegurado)}.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
