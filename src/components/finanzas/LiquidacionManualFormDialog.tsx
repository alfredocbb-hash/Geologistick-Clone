import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  numero: z.string().trim().min(1, 'Requerido').max(100),
  tipo: z.enum(['terciarizado', 'proveedor', 'partner', 'otro']),
  empresa_id: z.string().uuid().nullable().optional(),
  descripcion: z.string().max(500).optional().nullable(),
  periodo_desde: z.string().min(1, 'Requerido'),
  periodo_hasta: z.string().min(1, 'Requerido'),
  monto: z.coerce.number().refine(v => v !== 0, 'El monto no puede ser 0'),
  factura_id: z.string().uuid().nullable().optional(),
  notas: z.string().max(1000).optional().nullable(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liquidacion?: any | null;
  onSuccess?: () => void;
}

export function LiquidacionManualFormDialog({ open, onOpenChange, liquidacion, onSuccess }: Props) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    numero: '',
    tipo: 'terciarizado',
    empresa_id: null,
    descripcion: '',
    periodo_desde: new Date().toISOString().slice(0, 10),
    periodo_hasta: new Date().toISOString().slice(0, 10),
    monto: 0,
    factura_id: null,
    notas: '',
  });

  useEffect(() => {
    if (liquidacion) {
      setForm({
        numero: liquidacion.numero || '',
        tipo: liquidacion.tipo || 'terciarizado',
        empresa_id: liquidacion.empresa_id ?? null,
        descripcion: liquidacion.descripcion ?? '',
        periodo_desde: liquidacion.periodo_desde,
        periodo_hasta: liquidacion.periodo_hasta,
        monto: Number(liquidacion.monto),
        factura_id: liquidacion.factura_id ?? null,
        notas: liquidacion.notas ?? '',
      });
    } else if (open) {
      setForm((f: any) => ({ ...f, numero: '', monto: 0, descripcion: '', notas: '', factura_id: null, empresa_id: null }));
    }
  }, [liquidacion, open]);

  const { data: empresas } = useQuery({
    queryKey: ['empresas-terciarizadas-min', profile?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase.from('empresas_terciarizadas').select('id,nombre').eq('activo', true).order('nombre');
      return data || [];
    },
    enabled: open,
  });

  const { data: facturas } = useQuery({
    queryKey: ['facturas-emitidas-min', profile?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('facturas')
        .select('id, tipo_comprobante, punto_venta, numero_comprobante, importe_total, estado')
        .in('estado', ['emitida', 'pagada'])
        .order('created_at', { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: open,
  });

  const monto = Number(form.monto) || 0;
  const signo: 'pagar' | 'cobrar' | 'cero' = monto > 0 ? 'pagar' : monto < 0 ? 'cobrar' : 'cero';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Datos inválidos');
      return;
    }
    if (form.periodo_hasta < form.periodo_desde) {
      toast.error('El período hasta debe ser posterior al desde');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        numero: form.numero.trim(),
        tipo: form.tipo,
        empresa_id: form.empresa_id || null,
        descripcion: form.descripcion?.trim() || null,
        periodo_desde: form.periodo_desde,
        periodo_hasta: form.periodo_hasta,
        monto: Number(form.monto),
        factura_id: form.factura_id || null,
        notas: form.notas?.trim() || null,
        tenant_id: profile?.tenant_id,
      };
      if (liquidacion?.id) {
        const { error } = await (supabase as any).from('liquidaciones_manuales').update(payload).eq('id', liquidacion.id);
        if (error) throw error;
        toast.success('Liquidación actualizada');
      } else {
        const { error } = await (supabase as any).from('liquidaciones_manuales').insert(payload);
        if (error) throw error;
        toast.success('Liquidación creada');
      }
      qc.invalidateQueries({ queryKey: ['liquidaciones-manuales'] });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{liquidacion ? 'Editar liquidación' : 'Nueva liquidación manual'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Número de caja / liquidación *</Label>
              <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} maxLength={100} />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="terciarizado">Terciarizado</SelectItem>
                  <SelectItem value="proveedor">Proveedor</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.tipo === 'terciarizado' && (
            <div>
              <Label>Empresa terciarizada</Label>
              <Select value={form.empresa_id || 'none'} onValueChange={(v) => setForm({ ...form, empresa_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sin empresa —</SelectItem>
                  {empresas?.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Descripción</Label>
            <Input value={form.descripcion || ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} maxLength={500} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Período desde *</Label>
              <Input type="date" value={form.periodo_desde} onChange={(e) => setForm({ ...form, periodo_desde: e.target.value })} />
            </div>
            <div>
              <Label>Período hasta *</Label>
              <Input type="date" value={form.periodo_hasta} onChange={(e) => setForm({ ...form, periodo_hasta: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Monto * <span className="text-xs text-muted-foreground">(positivo = a pagar, negativo = a cobrar)</span></Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                step="0.01"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
              />
              {signo === 'pagar' && <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 whitespace-nowrap">A PAGAR</Badge>}
              {signo === 'cobrar' && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 whitespace-nowrap">A COBRAR</Badge>}
            </div>
          </div>

          <div>
            <Label>Factura de comisión (emitida)</Label>
            <Select value={form.factura_id || 'none'} onValueChange={(v) => setForm({ ...form, factura_id: v === 'none' ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Seleccionar factura..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sin factura —</SelectItem>
                {facturas?.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.tipo_comprobante} {String(f.punto_venta || 0).padStart(4, '0')}-{String(f.numero_comprobante || 0).padStart(8, '0')} — ${Number(f.importe_total).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea value={form.notas || ''} onChange={(e) => setForm({ ...form, notas: e.target.value })} maxLength={1000} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {liquidacion ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
