import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

interface ConceptoPrecio {
  id: string;
  monto: number;
  multiplicar_por_dias: boolean;
  concepto: { id: string; nombre: string; codigo: string };
}

interface SellerConceptosEditorProps {
  sellerId: string;
  tarifaId: string | null;
}

export function SellerConceptosEditor({ sellerId, tarifaId }: SellerConceptosEditorProps) {
  const queryClient = useQueryClient();

  // Fetch all tarifas for this seller (exclusive ones)
  const { data: tarifaIds } = useQuery({
    queryKey: ['seller-tarifa-ids', sellerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tarifas')
        .select('id')
        .eq('seller_exclusivo_id' as any, sellerId)
        .eq('activa', true);
      return (data || []).map(t => t.id);
    },
    enabled: !!sellerId,
  });

  const { data: conceptos, isLoading } = useQuery({
    queryKey: ['seller-conceptos', tarifaIds],
    queryFn: async () => {
      if (!tarifaIds?.length) return [];
      const { data } = await supabase
        .from('tarifa_concepto_precios')
        .select('id, monto, multiplicar_por_dias, concepto_id, tarifa_id')
        .in('tarifa_id', tarifaIds);
      
      if (!data?.length) return [];

      // Get concepto details
      const conceptoIds = [...new Set(data.map(d => d.concepto_id))];
      const { data: conceptoDetails } = await supabase
        .from('tarifa_conceptos')
        .select('id, nombre, codigo')
        .in('id', conceptoIds);

      const conceptoMap = Object.fromEntries((conceptoDetails || []).map(c => [c.id, c]));

      // Group by concepto (avoid duplicates across tarifas) - take first occurrence
      const seen = new Set<string>();
      return data.filter(d => {
        if (seen.has(d.concepto_id)) return false;
        seen.add(d.concepto_id);
        return true;
      }).map(d => ({
        id: d.id,
        monto: d.monto,
        multiplicar_por_dias: (d as any).multiplicar_por_dias ?? false,
        concepto: conceptoMap[d.concepto_id] || { id: d.concepto_id, nombre: 'Desconocido', codigo: '' },
        allIds: data.filter(x => x.concepto_id === d.concepto_id).map(x => x.id),
      }));
    },
    enabled: !!tarifaIds?.length,
  });

  const [editState, setEditState] = useState<Record<string, { monto: number; multiplicar_por_dias: boolean }>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (conceptos) {
      const initial: Record<string, { monto: number; multiplicar_por_dias: boolean }> = {};
      conceptos.forEach(c => {
        initial[c.concepto.id] = { monto: c.monto, multiplicar_por_dias: c.multiplicar_por_dias };
      });
      setEditState(initial);
      setHasChanges(false);
    }
  }, [conceptos]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!conceptos) return;
      for (const cp of conceptos) {
        const state = editState[cp.concepto.id];
        if (!state) continue;
        // Update ALL records for this concepto across all seller tarifas
        for (const id of (cp as any).allIds) {
          const { error } = await supabase
            .from('tarifa_concepto_precios')
            .update({
              monto: state.monto,
              multiplicar_por_dias: state.multiplicar_por_dias,
            } as any)
            .eq('id', id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success('Conceptos actualizados');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['seller-conceptos'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!tarifaIds?.length) return null;
  if (isLoading) return null;
  if (!conceptos?.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Conceptos Adicionales de Tarifa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {conceptos.map(cp => {
          const state = editState[cp.concepto.id];
          if (!state) return null;
          return (
            <div key={cp.concepto.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{cp.concepto.nombre}</span>
                <code className="text-xs text-muted-foreground">{cp.concepto.codigo}</code>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Monto $</Label>
                  <Input
                    type="number"
                    value={state.monto || ''}
                    onChange={(e) => {
                      setEditState(prev => ({
                        ...prev,
                        [cp.concepto.id]: { ...prev[cp.concepto.id], monto: parseFloat(e.target.value) || 0 },
                      }));
                      setHasChanges(true);
                    }}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={state.multiplicar_por_dias}
                      onCheckedChange={(v) => {
                        setEditState(prev => ({
                          ...prev,
                          [cp.concepto.id]: { ...prev[cp.concepto.id], multiplicar_por_dias: v },
                        }));
                        setHasChanges(true);
                      }}
                    />
                    <div>
                      <Label className="text-xs">Por día (lun-vie)</Label>
                      <p className="text-[10px] text-muted-foreground">Se multiplica por días hábiles</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {hasChanges && (
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Guardar Cambios
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
