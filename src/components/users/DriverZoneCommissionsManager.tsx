import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, MapPin, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface ZonaRegla {
  id: string;
  chofer_id: string;
  tenant_id: string;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal_desde: string | null;
  codigo_postal_hasta: string | null;
  monto_fijo: number;
  porcentaje: number;
  prioridad: number;
  activa: boolean;
  notas: string | null;
}

interface Props {
  choferUserId: string;
  tenantId: string;
}

const emptyForm = {
  ciudad: '',
  provincia: '',
  codigo_postal_desde: '',
  codigo_postal_hasta: '',
  monto_fijo: 0,
  porcentaje: 0,
  prioridad: 100,
  activa: true,
  notas: '',
};

export function DriverZoneCommissionsManager({ choferUserId, tenantId }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ZonaRegla | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: reglas = [], isLoading } = useQuery({
    queryKey: ['chofer-comisiones-zona', choferUserId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('chofer_comisiones_zona')
        .select('*')
        .eq('chofer_id', choferUserId)
        .order('prioridad', { ascending: true });
      if (error) throw error;
      return (data || []) as ZonaRegla[];
    },
    enabled: !!choferUserId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.ciudad && !form.provincia && !form.codigo_postal_desde) {
        throw new Error('Cargá al menos ciudad, provincia o código postal');
      }
      const payload = {
        chofer_id: choferUserId,
        tenant_id: tenantId,
        ciudad: form.ciudad || null,
        provincia: form.provincia || null,
        codigo_postal_desde: form.codigo_postal_desde || null,
        codigo_postal_hasta: form.codigo_postal_hasta || form.codigo_postal_desde || null,
        monto_fijo: Number(form.monto_fijo) || 0,
        porcentaje: Number(form.porcentaje) || 0,
        prioridad: Number(form.prioridad) || 100,
        activa: form.activa,
        notas: form.notas || null,
      };
      if (editing) {
        const { error } = await (supabase as any)
          .from('chofer_comisiones_zona')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('chofer_comisiones_zona')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chofer-comisiones-zona', choferUserId] });
      toast.success(editing ? 'Regla actualizada' : 'Regla creada');
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('chofer_comisiones_zona')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chofer-comisiones-zona', choferUserId] });
      toast.success('Regla eliminada');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (r: ZonaRegla) => {
    setEditing(r);
    setForm({
      ciudad: r.ciudad || '',
      provincia: r.provincia || '',
      codigo_postal_desde: r.codigo_postal_desde || '',
      codigo_postal_hasta: r.codigo_postal_hasta || '',
      monto_fijo: r.monto_fijo,
      porcentaje: r.porcentaje,
      prioridad: r.prioridad,
      activa: r.activa,
      notas: r.notas || '',
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-3 border rounded-md p-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4" />
          Reglas por zona/localidad
        </Label>
        <Button type="button" size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-3 w-3 mr-1" /> Agregar
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        El sistema busca la primera regla activa que matchee (por prioridad). Orden: ciudad → CP → provincia.
      </p>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando...</p>
      ) : reglas.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin reglas cargadas. Si no hay match se usa el % / fijo del chofer como fallback.</p>
      ) : (
        <div className="border rounded-md bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Prio.</TableHead>
                <TableHead className="text-xs">Ciudad</TableHead>
                <TableHead className="text-xs">Provincia</TableHead>
                <TableHead className="text-xs">CP</TableHead>
                <TableHead className="text-xs text-right">%</TableHead>
                <TableHead className="text-xs text-right">Fijo</TableHead>
                <TableHead className="text-xs">Activa</TableHead>
                <TableHead className="text-xs w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reglas.map((r) => (
                <TableRow key={r.id} className={!r.activa ? 'opacity-50' : ''}>
                  <TableCell className="text-xs">{r.prioridad}</TableCell>
                  <TableCell className="text-xs">{r.ciudad || '—'}</TableCell>
                  <TableCell className="text-xs">{r.provincia || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {r.codigo_postal_desde
                      ? r.codigo_postal_hasta && r.codigo_postal_hasta !== r.codigo_postal_desde
                        ? `${r.codigo_postal_desde}–${r.codigo_postal_hasta}`
                        : r.codigo_postal_desde
                      : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-right">{r.porcentaje}%</TableCell>
                  <TableCell className="text-xs text-right">${r.monto_fijo}</TableCell>
                  <TableCell className="text-xs">{r.activa ? 'Sí' : 'No'}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => {
                        if (confirm('¿Eliminar esta regla?')) deleteMutation.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar regla' : 'Nueva regla de comisión por zona'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ciudad</Label>
                <Input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} placeholder="Ej: Belgrano" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Provincia</Label>
                <Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} placeholder="Ej: Buenos Aires" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CP desde</Label>
                <Input value={form.codigo_postal_desde} onChange={(e) => setForm({ ...form, codigo_postal_desde: e.target.value })} placeholder="1400" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CP hasta</Label>
                <Input value={form.codigo_postal_hasta} onChange={(e) => setForm({ ...form, codigo_postal_hasta: e.target.value })} placeholder="1499" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Porcentaje (%)</Label>
                <Input type="number" step="0.1" value={form.porcentaje} onChange={(e) => setForm({ ...form, porcentaje: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Monto fijo ($)</Label>
                <Input type="number" step="0.01" value={form.monto_fijo} onChange={(e) => setForm({ ...form, monto_fijo: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prioridad</Label>
                <Input type="number" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: parseInt(e.target.value) || 100 })} />
                <p className="text-[10px] text-muted-foreground">Menor número = mayor prioridad</p>
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={form.activa} onCheckedChange={(v) => setForm({ ...form, activa: v })} />
                <Label className="text-xs">Activa</Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <Input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
