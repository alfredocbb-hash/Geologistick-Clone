import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ZonaRow {
  nombre: string;
  ciudades: string;
  precio: number;
}

interface ConceptoAdicional {
  nombre: string;
  codigo: string;
  monto: number;
  multiplicar_por_dias: boolean;
}

interface CreateSellerTarifaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellerId: string;
  sellerNombre: string;
  onSuccess: (tarifaId: string) => void;
}

export function CreateSellerTarifaDialog({
  open,
  onOpenChange,
  sellerId,
  sellerNombre,
  onSuccess,
}: CreateSellerTarifaDialogProps) {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const [zonas, setZonas] = useState<ZonaRow[]>([
    { nombre: 'Zona 1 - Local', ciudades: '', precio: 0 },
    { nombre: 'Zona 2 - Cercana', ciudades: '', precio: 0 },
    { nombre: 'Zona 3 - Lejana', ciudades: '', precio: 0 },
  ]);

  const [agregarConcepto, setAgregarConcepto] = useState(false);
  const [concepto, setConcepto] = useState<ConceptoAdicional>({
    nombre: 'Recargo por día',
    codigo: 'RECARGO_DIA',
    monto: 0,
    multiplicar_por_dias: true,
  });

  const updateZona = (index: number, field: keyof ZonaRow, value: string | number) => {
    setZonas(prev => prev.map((z, i) => i === index ? { ...z, [field]: value } : z));
  };

  const addZona = () => {
    setZonas(prev => [...prev, { nombre: `Zona ${prev.length + 1}`, ciudades: '', precio: 0 }]);
  };

  const removeZona = (index: number) => {
    if (zonas.length <= 1) return;
    setZonas(prev => prev.filter((_, i) => i !== index));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Sin tenant');

      const validZonas = zonas.filter(z => z.ciudades.trim() && z.precio > 0);
      if (validZonas.length === 0) throw new Error('Agrega al menos una zona con ciudades y precio');

      let conceptoId: string | null = null;

      // Create concepto adicional if needed
      if (agregarConcepto && concepto.monto > 0) {
        // Check if concepto already exists for this tenant
        const { data: existing } = await supabase
          .from('tarifa_conceptos')
          .select('id')
          .eq('codigo', concepto.codigo)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (existing) {
          conceptoId = existing.id;
        } else {
          const { data: newConcepto, error: cErr } = await supabase
            .from('tarifa_conceptos')
            .insert({
              nombre: concepto.nombre,
              codigo: concepto.codigo,
              es_basico: true,
              tenant_id: tenantId,
            })
            .select('id')
            .single();
          if (cErr) throw cErr;
          conceptoId = newConcepto.id;
        }
      }

      let firstTarifaId: string | null = null;

      // Create one tarifa per zone
      for (const zona of validZonas) {
        const tarifaNombre = `${sellerNombre} - ${zona.nombre}`;

        const { data: tarifa, error: tErr } = await supabase
          .from('tarifas')
          .insert({
            nombre: tarifaNombre,
            tipo_tarifa: 'zona',
            precio_base: zona.precio,
            zona_destino: zona.ciudades,
            activa: true,
            tenant_id: tenantId,
            seller_exclusivo_id: sellerId,
          } as any)
          .select('id')
          .single();

        if (tErr) throw tErr;
        if (!firstTarifaId) firstTarifaId = tarifa.id;

        // Link concepto to tarifa if applicable
        if (conceptoId && concepto.monto > 0) {
          const { error: cpErr } = await supabase
            .from('tarifa_concepto_precios')
            .insert({
              tarifa_id: tarifa.id,
              concepto_id: conceptoId,
              monto: concepto.monto,
              multiplicar_por_dias: concepto.multiplicar_por_dias,
            } as any);
          if (cpErr) console.error('Error linking concepto:', cpErr);
        }
      }

      // Assign first tarifa to seller
      if (firstTarifaId) {
        const { error: sErr } = await supabase
          .from('ecommerce_sellers')
          .update({ tarifa_id: firstTarifaId })
          .eq('id', sellerId);
        if (sErr) throw sErr;
      }

      return firstTarifaId!;
    },
    onSuccess: (tarifaId) => {
      toast({ title: `${zonas.filter(z => z.ciudades.trim() && z.precio > 0).length} tarifas creadas para ${sellerNombre}` });
      queryClient.invalidateQueries({ queryKey: ['tarifas-active'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
      onSuccess(tarifaId);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Tarifa Personalizada</DialogTitle>
          <DialogDescription>
            Crear tarifas por zona exclusivas para {sellerNombre}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Zones */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Zonas de envío</Label>
            {zonas.map((zona, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto_auto] gap-2 items-end">
                <div>
                  <Label className="text-xs text-muted-foreground">Nombre zona</Label>
                  <Input
                    value={zona.nombre}
                    onChange={(e) => updateZona(i, 'nombre', e.target.value)}
                    placeholder="Zona 1"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ciudades destino (separadas por coma)</Label>
                  <Input
                    value={zona.ciudades}
                    onChange={(e) => updateZona(i, 'ciudades', e.target.value)}
                    placeholder="Berazategui, Quilmes"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Precio $</Label>
                  <Input
                    type="number"
                    value={zona.precio || ''}
                    onChange={(e) => updateZona(i, 'precio', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="h-9 text-sm w-28"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => removeZona(i)}
                  disabled={zonas.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addZona}>
              <Plus className="h-4 w-4 mr-1" /> Agregar zona
            </Button>
          </div>

          {/* Optional concept */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Concepto adicional</Label>
                <p className="text-xs text-muted-foreground">Ej: recargo por día, seguro, etc.</p>
              </div>
              <Switch checked={agregarConcepto} onCheckedChange={setAgregarConcepto} />
            </div>
            {agregarConcepto && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nombre</Label>
                    <Input
                      value={concepto.nombre}
                      onChange={(e) => setConcepto(prev => ({ ...prev, nombre: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Código</Label>
                    <Input
                      value={concepto.codigo}
                      onChange={(e) => setConcepto(prev => ({ ...prev, codigo: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Monto $</Label>
                    <Input
                      type="number"
                      value={concepto.monto || ''}
                      onChange={(e) => setConcepto(prev => ({ ...prev, monto: parseFloat(e.target.value) || 0 }))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Cobro por día (lun-vie)</Label>
                    <p className="text-xs text-muted-foreground">Se multiplica por días hábiles del período de liquidación</p>
                  </div>
                  <Switch
                    checked={concepto.multiplicar_por_dias}
                    onCheckedChange={(v) => setConcepto(prev => ({ ...prev, multiplicar_por_dias: v }))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Crear Tarifas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
