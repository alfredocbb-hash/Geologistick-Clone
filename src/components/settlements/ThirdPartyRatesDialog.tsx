import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresa: { id: string; nombre: string; tenant_id: string } | null;
}

interface ZonaRow { ciudades: string; provincias: string; precio: number }
interface FormState {
  id?: string;
  nombre: string;
  tipo_tarifa: 'fija' | 'por_zona' | 'por_kg';
  precio_fijo: number;
  precio_por_kg: number;
  precio_minimo: number;
  zonas: ZonaRow[];
  activa: boolean;
}

const emptyForm = (): FormState => ({
  nombre: '',
  tipo_tarifa: 'fija',
  precio_fijo: 0,
  precio_por_kg: 0,
  precio_minimo: 0,
  zonas: [{ ciudades: '', provincias: '', precio: 0 }],
  activa: true,
});

export function ThirdPartyRatesDialog({ open, onOpenChange, empresa }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<FormState | null>(null);

  const { data: tarifas = [], isLoading } = useQuery({
    queryKey: ['tarifas-terciarizadas', empresa?.id],
    queryFn: async () => {
      if (!empresa) return [];
      const { data, error } = await (supabase.from('tarifas_terciarizadas') as any)
        .select('*')
        .eq('empresa_id', empresa.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!empresa,
  });

  const saveMutation = useMutation({
    mutationFn: async (form: FormState) => {
      if (!empresa) throw new Error('Sin empresa');
      const zonasJson = form.tipo_tarifa === 'por_zona'
        ? form.zonas
            .filter(z => (z.ciudades || z.provincias) && z.precio > 0)
            .map(z => ({
              ciudades: z.ciudades.split(',').map(s => s.trim()).filter(Boolean),
              provincias: z.provincias.split(',').map(s => s.trim()).filter(Boolean),
              precio: Number(z.precio),
            }))
        : [];
      const payload: any = {
        tenant_id: empresa.tenant_id,
        empresa_id: empresa.id,
        nombre: form.nombre,
        tipo_tarifa: form.tipo_tarifa,
        precio_fijo: form.tipo_tarifa === 'fija' ? Number(form.precio_fijo) : 0,
        precio_por_kg: form.tipo_tarifa === 'por_kg' ? Number(form.precio_por_kg) : 0,
        precio_minimo: Number(form.precio_minimo) || 0,
        zonas: zonasJson,
        activa: form.activa,
      };
      if (form.id) {
        const { error } = await (supabase.from('tarifas_terciarizadas') as any)
          .update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('tarifas_terciarizadas') as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Tarifa guardada');
      qc.invalidateQueries({ queryKey: ['tarifas-terciarizadas', empresa?.id] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('tarifas_terciarizadas') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tarifa eliminada');
      qc.invalidateQueries({ queryKey: ['tarifas-terciarizadas', empresa?.id] });
    },
  });

  const startEdit = (t: any) => {
    setEditing({
      id: t.id,
      nombre: t.nombre,
      tipo_tarifa: t.tipo_tarifa,
      precio_fijo: t.precio_fijo || 0,
      precio_por_kg: t.precio_por_kg || 0,
      precio_minimo: t.precio_minimo || 0,
      zonas: (t.zonas && t.zonas.length > 0)
        ? t.zonas.map((z: any) => ({
            ciudades: (z.ciudades || []).join(', '),
            provincias: (z.provincias || []).join(', '),
            precio: z.precio || 0,
          }))
        : [{ ciudades: '', provincias: '', precio: 0 }],
      activa: t.activa,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tarifas — {empresa?.nombre}</DialogTitle>
        </DialogHeader>

        {!editing && (
          <>
            <div className="flex justify-end mb-2">
              <Button size="sm" onClick={() => setEditing(emptyForm())}>
                <Plus className="h-4 w-4 mr-1" /> Nueva tarifa
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5}>Cargando...</TableCell></TableRow>}
                {!isLoading && tarifas.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin tarifas</TableCell></TableRow>
                )}
                {tarifas.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.nombre}</TableCell>
                    <TableCell><Badge variant="outline">{t.tipo_tarifa}</Badge></TableCell>
                    <TableCell>
                      {t.tipo_tarifa === 'fija' && `$${(t.precio_fijo || 0).toLocaleString()}`}
                      {t.tipo_tarifa === 'por_kg' && `$${(t.precio_por_kg || 0).toLocaleString()}/kg`}
                      {t.tipo_tarifa === 'por_zona' && `${(t.zonas || []).length} zonas`}
                    </TableCell>
                    <TableCell>
                      {t.activa ? <Badge>Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(t)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm('¿Eliminar tarifa?')) deleteMutation.mutate(t.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        {editing && (
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={editing.nombre} onChange={e => setEditing({ ...editing, nombre: e.target.value })} placeholder="Ej: CABA y GBA" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de tarifa</Label>
                <Select value={editing.tipo_tarifa} onValueChange={(v: any) => setEditing({ ...editing, tipo_tarifa: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fija">Precio fijo</SelectItem>
                    <SelectItem value="por_zona">Por zona</SelectItem>
                    <SelectItem value="por_kg">Por kilo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Precio mínimo</Label>
                <Input type="number" value={editing.precio_minimo} onChange={e => setEditing({ ...editing, precio_minimo: +e.target.value })} />
              </div>
            </div>

            {editing.tipo_tarifa === 'fija' && (
              <div>
                <Label>Precio fijo por envío</Label>
                <Input type="number" value={editing.precio_fijo} onChange={e => setEditing({ ...editing, precio_fijo: +e.target.value })} />
              </div>
            )}
            {editing.tipo_tarifa === 'por_kg' && (
              <div>
                <Label>Precio por kg</Label>
                <Input type="number" value={editing.precio_por_kg} onChange={e => setEditing({ ...editing, precio_por_kg: +e.target.value })} />
              </div>
            )}
            {editing.tipo_tarifa === 'por_zona' && (
              <div className="space-y-2">
                <Label>Zonas (ciudades y/o provincias separadas por coma)</Label>
                {editing.zonas.map((z, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-5" placeholder="Ciudades" value={z.ciudades}
                      onChange={e => {
                        const zonas = [...editing.zonas]; zonas[i].ciudades = e.target.value;
                        setEditing({ ...editing, zonas });
                      }} />
                    <Input className="col-span-4" placeholder="Provincias" value={z.provincias}
                      onChange={e => {
                        const zonas = [...editing.zonas]; zonas[i].provincias = e.target.value;
                        setEditing({ ...editing, zonas });
                      }} />
                    <Input className="col-span-2" type="number" placeholder="Precio" value={z.precio}
                      onChange={e => {
                        const zonas = [...editing.zonas]; zonas[i].precio = +e.target.value;
                        setEditing({ ...editing, zonas });
                      }} />
                    <Button className="col-span-1" variant="ghost" size="sm" onClick={() => {
                      const zonas = editing.zonas.filter((_, idx) => idx !== i);
                      setEditing({ ...editing, zonas: zonas.length ? zonas : [{ ciudades: '', provincias: '', precio: 0 }] });
                    }}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() =>
                  setEditing({ ...editing, zonas: [...editing.zonas, { ciudades: '', provincias: '', precio: 0 }] })
                }><Plus className="h-4 w-4 mr-1" />Agregar zona</Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch checked={editing.activa} onCheckedChange={v => setEditing({ ...editing, activa: v })} />
              <Label>Activa</Label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={() => {
                if (!editing.nombre) { toast.error('Ingresa un nombre'); return; }
                saveMutation.mutate(editing);
              }} disabled={saveMutation.isPending}>Guardar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
