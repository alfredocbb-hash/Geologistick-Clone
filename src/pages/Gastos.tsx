import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Loader2, Trash2, Edit2, Receipt, Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { exportToExcel } from '@/lib/exportExcel';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const CATEGORIAS = [
  { value: 'combustible', label: 'Combustible' },
  { value: 'repuestos', label: 'Repuestos' },
  { value: 'peajes', label: 'Peajes' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'sueldos', label: 'Sueldos' },
  { value: 'tech', label: 'AWS / Tech' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'otros', label: 'Otros' },
];

interface GastoForm {
  proveedor: string;
  cuit_proveedor: string;
  fecha: string;
  importe_neto: number;
  iva: number;
  total: number;
  categoria: string;
  descripcion: string;
  numero_comprobante: string;
  tipo_comprobante: string;
}

const emptyForm: GastoForm = {
  proveedor: '', cuit_proveedor: '', fecha: format(new Date(), 'yyyy-MM-dd'),
  importe_neto: 0, iva: 0, total: 0, categoria: 'otros',
  descripcion: '', numero_comprobante: '', tipo_comprobante: 'factura_b',
};

export default function Gastos() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<GastoForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const { data: gastos = [], isLoading } = useQuery({
    queryKey: ['gastos', profile?.tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gastos')
        .select('*')
        .eq('tenant_id', profile!.tenant_id)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  const filtered = gastos.filter(g => {
    const q = search.toLowerCase();
    const matchSearch = !search || g.proveedor.toLowerCase().includes(q) || g.descripcion?.toLowerCase().includes(q);
    const matchCat = filterCat === 'all' || g.categoria === filterCat;
    return matchSearch && matchCat;
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        tenant_id: profile!.tenant_id,
        created_by: profile!.user_id,
      };
      if (editId) {
        const { error } = await supabase.from('gastos').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('gastos').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? 'Gasto actualizado' : 'Gasto registrado');
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gastos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Gasto eliminado');
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (g: any) => {
    setEditId(g.id);
    setForm({
      proveedor: g.proveedor,
      cuit_proveedor: g.cuit_proveedor || '',
      fecha: g.fecha,
      importe_neto: g.importe_neto,
      iva: g.iva,
      total: g.total,
      categoria: g.categoria,
      descripcion: g.descripcion || '',
      numero_comprobante: g.numero_comprobante || '',
      tipo_comprobante: g.tipo_comprobante || 'factura_b',
    });
    setDialogOpen(true);
  };

  const updateNeto = (neto: number) => {
    const iva = Math.round(neto * 0.21 * 100) / 100;
    setForm(f => ({ ...f, importe_neto: neto, iva, total: Math.round((neto + iva) * 100) / 100 }));
  };

  const handleExportIVACompras = () => {
    exportToExcel({
      filename: `Libro_IVA_Compras_${format(new Date(), 'yyyy-MM')}`,
      sheetName: 'IVA Compras',
      columns: [
        { header: 'Fecha', key: 'fecha' },
        { header: 'Tipo', key: 'tipo_comprobante' },
        { header: 'Proveedor', key: 'proveedor' },
        { header: 'CUIT', key: 'cuit_proveedor' },
        { header: 'Nro Comprobante', key: 'numero_comprobante' },
        { header: 'Neto', key: 'importe_neto', format: 'currency' },
        { header: 'IVA', key: 'iva', format: 'currency' },
        { header: 'Total', key: 'total', format: 'currency' },
        { header: 'Categoría', key: 'categoria' },
      ],
      data: gastos,
    });
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

  const totalGastos = gastos.reduce((s, g) => s + Number(g.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gastos</h1>
          <p className="text-muted-foreground">Conciliación de gastos operativos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportIVACompras} disabled={gastos.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Libro IVA Compras
          </Button>
          <Button onClick={() => { setEditId(null); setForm(emptyForm); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Gasto
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Gastos</p>
            <p className="text-2xl font-bold">{formatCurrency(totalGastos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">IVA Crédito Fiscal</p>
            <p className="text-2xl font-bold">{formatCurrency(gastos.reduce((s, g) => s + Number(g.iva), 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Registros</p>
            <p className="text-2xl font-bold">{gastos.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar proveedor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Receipt className="h-10 w-10 mb-2" />
              <p>No hay gastos registrados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(g => (
                  <TableRow key={g.id}>
                    <TableCell>{format(new Date(g.fecha), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{g.proveedor}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORIAS.find(c => c.value === g.categoria)?.label || g.categoria}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(g.importe_neto))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(g.iva))}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(g.total))}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(g)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) { setDialogOpen(false); setEditId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Gasto' : 'Nuevo Gasto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proveedor *</Label>
                <Input value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CUIT Proveedor</Label>
                <Input value={form.cuit_proveedor} onChange={e => setForm(f => ({ ...f, cuit_proveedor: e.target.value }))} placeholder="XX-XXXXXXXX-X" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Categoría *</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Neto *</Label>
                <Input type="number" step="0.01" value={form.importe_neto || ''} onChange={e => updateNeto(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>IVA 21%</Label>
                <Input type="number" step="0.01" value={form.iva || ''} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Total</Label>
                <Input type="number" step="0.01" value={form.total || ''} readOnly className="bg-muted" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nro Comprobante</Label>
              <Input value={form.numero_comprobante} onChange={e => setForm(f => ({ ...f, numero_comprobante: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => upsertMutation.mutate()} disabled={!form.proveedor || upsertMutation.isPending}>
              {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? 'Actualizar' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
