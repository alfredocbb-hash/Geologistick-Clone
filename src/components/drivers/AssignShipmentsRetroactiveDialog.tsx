import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { toLocalISOStart, toLocalISOEnd } from '@/lib/dateUtils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choferUserId: string;
  choferNombre: string;
  tenantId?: string | null;
  defaultFechaInicio?: string;
  defaultFechaFin?: string;
  onAssigned?: () => void;
}

interface EnvioRow {
  id: string;
  tracking_number: string;
  tracking_externo: string | null;
  created_at: string;
  fecha_entrega: string | null;
  estado: string;
  ciudad_entrega: string | null;
  precio_total: number | null;
  chofer_id: string | null;
  sucursal_origen_id: string | null;
  sucursal_entrega_id: string | null;
  destinatario_id: string | null;
}

const DEFAULT_ESTADOS = ['entregado', 'en_reparto', 'en_sucursal', 'en_transito', 'recogido'];

export function AssignShipmentsRetroactiveDialog({
  open,
  onOpenChange,
  choferUserId,
  choferNombre,
  tenantId,
  defaultFechaInicio,
  defaultFechaFin,
  onAssigned,
}: Props) {
  const queryClient = useQueryClient();
  const [fechaInicio, setFechaInicio] = useState(defaultFechaInicio || '');
  const [fechaFin, setFechaFin] = useState(defaultFechaFin || '');
  const [sucursalId, setSucursalId] = useState<string>('all');
  const [soloSinChofer, setSoloSinChofer] = useState(true);
  const [motivo, setMotivo] = useState('Liquidación física de envíos retirados ese día');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      if (defaultFechaInicio) setFechaInicio(defaultFechaInicio);
      if (defaultFechaFin) setFechaFin(defaultFechaFin);
    }
  }, [open, defaultFechaInicio, defaultFechaFin]);

  const { data: sucursales = [] } = useQuery({
    queryKey: ['sucursales-assign-retro', tenantId],
    enabled: open && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('tenant_id', tenantId!)
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data || [];
    },
  });

  const enviosQuery = useQuery({
    queryKey: ['envios-retro-assign', choferUserId, fechaInicio, fechaFin, sucursalId, soloSinChofer],
    enabled: open && !!fechaInicio && !!fechaFin && !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from('envios')
        .select('id, tracking_number, tracking_externo, created_at, fecha_entrega, estado, ciudad_entrega, precio_total, chofer_id, sucursal_origen_id, sucursal_entrega_id, destinatario_id')
        .eq('tenant_id', tenantId!)
        .gte('created_at', toLocalISOStart(fechaInicio))
        .lte('created_at', toLocalISOEnd(fechaFin))
        .in('estado', DEFAULT_ESTADOS as any)
        .order('created_at', { ascending: false })
        .limit(500);

      if (soloSinChofer) {
        q = q.is('chofer_id', null);
      }
      if (sucursalId !== 'all') {
        q = q.or(`sucursal_origen_id.eq.${sucursalId},sucursal_entrega_id.eq.${sucursalId}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as EnvioRow[];
    },
  });

  const envios = enviosQuery.data || [];
  const allSelected = envios.length > 0 && envios.every((e) => selectedIds.has(e.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(envios.map((e) => e.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPrecio = useMemo(
    () => envios.filter((e) => selectedIds.has(e.id)).reduce((s, e) => s + (Number(e.precio_total) || 0), 0),
    [envios, selectedIds]
  );

  const assignMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) throw new Error('Seleccioná al menos un envío');
      const { data, error } = await (supabase as any).rpc('assign_envios_to_chofer_retroactivo', {
        p_chofer_user_id: choferUserId,
        p_envio_ids: ids,
        p_motivo: motivo || null,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Error al asignar');
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(
        `Asignados ${data?.asignados ?? 0} envío(s) a ${choferNombre}${
          data?.omitidos ? ` · Omitidos: ${data.omitidos}` : ''
        }`
      );
      queryClient.invalidateQueries({ queryKey: ['envios-retro-assign'] });
      onAssigned?.();
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || 'Error al asignar envíos'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Asignar envíos retroactivos a {choferNombre}</DialogTitle>
          <DialogDescription>
            Buscá envíos sin chofer en un rango de fechas y asignáselos al chofer para que entren en la próxima liquidación.
            No se modifica el estado del envío.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Desde (creación)</Label>
            <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
          <div>
            <Label>Hasta (creación)</Label>
            <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </div>
          <div>
            <Label>Sucursal</Label>
            <Select value={sucursalId} onValueChange={setSucursalId}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {sucursales.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Checkbox
              id="solo-sin-chofer"
              checked={soloSinChofer}
              onCheckedChange={(v) => setSoloSinChofer(!!v)}
            />
            <Label htmlFor="solo-sin-chofer" className="cursor-pointer">
              Solo sin chofer asignado
            </Label>
          </div>
        </div>

        <div>
          <Label>Motivo (opcional)</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ciudad entrega</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Chofer actual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enviosQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    Buscando...
                  </TableCell>
                </TableRow>
              ) : envios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No hay envíos que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              ) : (
                envios.map((e) => (
                  <TableRow key={e.id} data-state={selectedIds.has(e.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => toggleOne(e.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.tracking_externo || e.tracking_number}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(e.created_at).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{e.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{e.ciudad_entrega || '-'}</TableCell>
                    <TableCell className="text-right">${Number(e.precio_total || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">
                      {e.chofer_id ? <Badge variant="secondary">Asignado</Badge> : <span className="text-muted-foreground">Sin chofer</span>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {envios.length} envío(s) encontrados · {selectedIds.size} seleccionado(s)
          </span>
          <span className="font-medium">Total seleccionado: ${totalPrecio.toFixed(2)}</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending || selectedIds.size === 0}
          >
            {assignMutation.isPending ? 'Asignando...' : `Asignar a ${choferNombre}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
