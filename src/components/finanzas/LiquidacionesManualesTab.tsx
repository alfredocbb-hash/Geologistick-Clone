import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveTenantId } from '@/hooks/useEffectiveTenantId';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, DollarSign, TrendingUp, TrendingDown, FileText, Wallet, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { LiquidacionManualFormDialog } from './LiquidacionManualFormDialog';
import { RegistrarMovimientoDialog } from './RegistrarMovimientoDialog';

export function LiquidacionesManualesTab() {
  const tenantId = useEffectiveTenantId();
  const qc = useQueryClient();
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [desde, setDesde] = useState(firstDay.toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10));
  const [tipoFiltro, setTipoFiltro] = useState<string>('all');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [movOpen, setMovOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const { data: liquidaciones, isLoading } = useQuery({
    queryKey: ['liquidaciones-manuales', tenantId, desde, hasta],
    queryFn: async () => {
      let q = (supabase as any)
        .from('liquidaciones_manuales')
        .select(`*, empresa:empresas_terciarizadas(id,nombre,cuit), factura:facturas(id,tipo_comprobante,punto_venta,numero_comprobante,importe_total,estado)`)
        .gte('periodo_desde', desde)
        .lte('periodo_hasta', hasta)
        .order('created_at', { ascending: false });
      if (tenantId) q = q.eq('tenant_id', tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    let list = liquidaciones || [];
    if (tipoFiltro !== 'all') list = list.filter((l: any) => l.tipo === tipoFiltro);
    if (estadoFiltro !== 'all') list = list.filter((l: any) => l.estado === estadoFiltro);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((l: any) =>
        l.numero?.toLowerCase().includes(s) ||
        l.descripcion?.toLowerCase().includes(s) ||
        l.empresa?.nombre?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [liquidaciones, tipoFiltro, estadoFiltro, search]);

  const totales = useMemo(() => {
    const pend = filtered.filter((l: any) => l.estado === 'pendiente');
    const aPagar = pend.filter((l: any) => Number(l.monto) > 0).reduce((s: number, l: any) => s + Number(l.monto), 0);
    const aCobrar = pend.filter((l: any) => Number(l.monto) < 0).reduce((s: number, l: any) => s + Math.abs(Number(l.monto)), 0);
    const neto = filtered.reduce((s: number, l: any) => s + Number(l.monto), 0);
    return { aPagar, aCobrar, neto, cantidad: filtered.length };
  }, [filtered]);

  const handleDelete = async (liq: any) => {
    if (!confirm(`¿Eliminar liquidación #${liq.numero}?`)) return;
    const { error } = await (supabase as any).from('liquidaciones_manuales').delete().eq('id', liq.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Eliminada');
      qc.invalidateQueries({ queryKey: ['liquidaciones-manuales'] });
    }
  };

  const handleAnular = async (liq: any) => {
    if (liq.movimiento_caja_id) {
      toast.error('Ya generó movimiento de caja. Revertí manualmente desde Caja.');
      return;
    }
    if (!confirm('¿Anular esta liquidación?')) return;
    const { error } = await (supabase as any).from('liquidaciones_manuales').update({ estado: 'anulada' }).eq('id', liq.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Anulada');
      qc.invalidateQueries({ queryKey: ['liquidaciones-manuales'] });
    }
  };

  const estadoBadge = (estado: string) => {
    const map: Record<string, string> = {
      pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      pagada: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      cobrada: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      anulada: 'bg-muted text-muted-foreground',
    };
    return <Badge className={map[estado] || ''}>{estado}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <Label>Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div>
            <Label>Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="terciarizado">Terciarizado</SelectItem>
                <SelectItem value="proveedor">Proveedor</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="pagada">Pagada</SelectItem>
                <SelectItem value="cobrada">Cobrada</SelectItem>
                <SelectItem value="anulada">Anulada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nº, empresa..." className="pl-8" />
            </div>
          </div>
          <Button onClick={() => { setSelected(null); setFormOpen(true); }} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Nueva
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><FileText className="h-4 w-4" /> Registros</div>
          <p className="text-2xl font-bold mt-1">{totales.cantidad}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-600 text-sm"><TrendingDown className="h-4 w-4" /> A pagar (pendiente)</div>
          <p className="text-2xl font-bold mt-1">${totales.aPagar.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-green-600 text-sm"><TrendingUp className="h-4 w-4" /> A cobrar (pendiente)</div>
          <p className="text-2xl font-bold mt-1">${totales.aCobrar.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><DollarSign className="h-4 w-4" /> Neto período</div>
          <p className={`text-2xl font-bold mt-1 ${totales.neto < 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${totales.neto.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </CardContent></Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Empresa / Descripción</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sin registros en el período</TableCell></TableRow>
              )}
              {filtered.map((liq: any) => {
                const monto = Number(liq.monto);
                const esPagar = monto > 0;
                return (
                  <TableRow key={liq.id}>
                    <TableCell className="font-mono text-sm">{liq.numero}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{liq.tipo}</Badge></TableCell>
                    <TableCell>
                      <div className="font-medium">{liq.empresa?.nombre || liq.descripcion || '-'}</div>
                      {liq.empresa && liq.descripcion && (
                        <div className="text-xs text-muted-foreground">{liq.descripcion}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(liq.periodo_desde + 'T00:00'), 'dd/MM/yy')} - {format(new Date(liq.periodo_hasta + 'T00:00'), 'dd/MM/yy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`font-semibold ${esPagar ? 'text-red-600' : 'text-green-600'}`}>
                          ${Math.abs(monto).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <Badge variant="outline" className={`text-xs ${esPagar ? 'border-red-300' : 'border-green-300'}`}>
                          {esPagar ? 'A pagar' : 'A cobrar'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{estadoBadge(liq.estado)}</TableCell>
                    <TableCell>
                      {liq.factura ? (
                        <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => window.open(`/print-invoice?factura_id=${liq.factura.id}`, '_blank')}>
                          {liq.factura.tipo_comprobante} {String(liq.factura.punto_venta || 0).padStart(4, '0')}-{String(liq.factura.numero_comprobante || 0).padStart(8, '0')}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {liq.estado === 'pendiente' && (
                            <DropdownMenuItem onClick={() => { setSelected(liq); setMovOpen(true); }}>
                              <Wallet className="h-4 w-4 mr-2" /> Registrar {esPagar ? 'pago' : 'cobro'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => { setSelected(liq); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          {liq.estado === 'pendiente' && (
                            <DropdownMenuItem onClick={() => handleAnular(liq)}>
                              <XCircle className="h-4 w-4 mr-2" /> Anular
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(liq)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LiquidacionManualFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        liquidacion={selected}
      />
      <RegistrarMovimientoDialog
        open={movOpen}
        onOpenChange={setMovOpen}
        liquidacion={selected}
      />
    </div>
  );
}
