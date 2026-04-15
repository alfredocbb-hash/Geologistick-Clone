import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { FileText, Loader2, Search, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { useARCAIntegration, determinarTipoFactura, validateCUIT, formatCUIT } from '@/hooks/useARCAConfig';
import { format } from 'date-fns';

const CONDICION_IVA_OPTIONS = [
  { value: 'responsable_inscripto', label: 'Responsable Inscripto', requiresCuit: true },
  { value: 'monotributo', label: 'Monotributista', requiresCuit: true },
  { value: 'exento', label: 'Exento', requiresCuit: true },
  { value: 'consumidor_final', label: 'Consumidor Final', requiresCuit: false },
] as const;

type CondicionIVA = typeof CONDICION_IVA_OPTIONS[number]['value'];

export default function Facturacion() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, running: false });
  const [batchResults, setBatchResults] = useState<{ id: string; tracking: string; ok: boolean; error?: string }[]>([]);

  // Batch invoice form state
  const [tipoComprobante, setTipoComprobante] = useState<'A' | 'B' | 'C'>('B');
  const [cuit, setCuit] = useState('');
  const [nombre, setNombre] = useState('');
  const [condicionIva, setCondicionIva] = useState<CondicionIVA>('consumidor_final');
  const [domicilio, setDomicilio] = useState('');
  const [ivaIncluido, setIvaIncluido] = useState(true);
  const [selectedEnvironment, setSelectedEnvironment] = useState<'sandbox' | 'production'>('production');

  const { isConfigured, config, hasBothEnvironments, isLoading: arcaLoading } = useARCAIntegration(selectedEnvironment);

  // Fetch delivered shipments without invoice
  const { data: pendientes = [], isLoading, refetch } = useQuery({
    queryKey: ['facturacion-pendiente', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      // Get all delivered shipments
      const { data: envios, error: enviosError } = await supabase
        .from('envios')
        .select('id, tracking_number, nombre_destinatario, fecha_entrega, precio_total, ciudad_entrega, direccion_entrega')
        .eq('tenant_id', profile.tenant_id)
        .eq('estado', 'entregado')
        .order('fecha_entrega', { ascending: false })
        .limit(500);

      if (enviosError) throw enviosError;
      if (!envios?.length) return [];

      // Get invoiced shipment ids
      const { data: facturas } = await supabase
        .from('facturas')
        .select('envio_id')
        .eq('tenant_id', profile.tenant_id)
        .not('envio_id', 'is', null);

      const invoicedIds = new Set((facturas || []).map(f => f.envio_id));

      return envios.filter(e => !invoicedIds.has(e.id));
    },
    enabled: !!profile?.tenant_id,
  });

  const filtered = useMemo(() => {
    if (!search) return pendientes;
    const q = search.toLowerCase();
    return pendientes.filter(e =>
      e.tracking_number?.toLowerCase().includes(q) ||
      e.nombre_destinatario?.toLowerCase().includes(q) ||
      e.ciudad_entrega?.toLowerCase().includes(q)
    );
  }, [pendientes, search]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(e => e.id)));
    }
  };

  const selectedTotal = useMemo(() =>
    pendientes.filter(e => selected.has(e.id)).reduce((s, e) => s + (e.precio_total || 0), 0),
    [pendientes, selected]
  );

  const requiresCuit = CONDICION_IVA_OPTIONS.find(o => o.value === condicionIva)?.requiresCuit;

  const handleBatchInvoice = async () => {
    const ids = Array.from(selected);
    const enviosToInvoice = pendientes.filter(e => ids.includes(e.id));
    setBatchProgress({ current: 0, total: enviosToInvoice.length, running: true });
    setBatchResults([]);

    const results: typeof batchResults = [];

    for (let i = 0; i < enviosToInvoice.length; i++) {
      const envio = enviosToInvoice[i];
      setBatchProgress(p => ({ ...p, current: i + 1 }));

      const importeTotalConIva = ivaIncluido ? envio.precio_total : Math.round(envio.precio_total * 1.21 * 100) / 100;

      try {
        const { data, error } = await supabase.functions.invoke('arca-factura', {
          body: {
            envio_id: envio.id,
            tipo_comprobante: tipoComprobante,
            environment: selectedEnvironment,
            receptor: {
              cuit: cuit ? formatCUIT(cuit) : undefined,
              nombre: nombre.trim(),
              condicion_iva: condicionIva,
              domicilio: domicilio.trim() || undefined,
            },
            importe_total: importeTotalConIva,
          },
        });
        if (error) throw error;
        if (!data.success && data.error) throw new Error(data.error);
        results.push({ id: envio.id, tracking: envio.tracking_number, ok: true });
      } catch (err: any) {
        results.push({ id: envio.id, tracking: envio.tracking_number, ok: false, error: err.message });
      }
    }

    setBatchResults(results);
    setBatchProgress(p => ({ ...p, running: false }));

    const ok = results.filter(r => r.ok).length;
    const fail = results.filter(r => !r.ok).length;
    if (ok > 0) toast.success(`${ok} factura(s) emitida(s) correctamente`);
    if (fail > 0) toast.error(`${fail} factura(s) fallaron`);

    setSelected(new Set());
    refetch();
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cola de Facturación</h1>
          <p className="text-muted-foreground">Envíos entregados pendientes de facturar</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {pendientes.length} pendientes
        </Badge>
      </div>

      {/* Action bar */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por tracking, destinatario o ciudad..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => setBatchOpen(true)}
            disabled={selected.size === 0}
          >
            <FileText className="mr-2 h-4 w-4" />
            Facturar en Lote ({selected.size})
          </Button>
          {selected.size > 0 && (
            <span className="text-sm text-muted-foreground">
              Total seleccionado: <strong>{formatCurrency(selectedTotal)}</strong>
            </span>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mb-2" />
              <p>No hay envíos pendientes de facturar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Fecha Entrega</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(envio => (
                  <TableRow key={envio.id} className="cursor-pointer" onClick={() => toggleSelect(envio.id)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(envio.id)}
                        onCheckedChange={() => toggleSelect(envio.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{envio.tracking_number}</TableCell>
                    <TableCell>{envio.nombre_destinatario || '—'}</TableCell>
                    <TableCell>
                      {envio.fecha_entrega ? format(new Date(envio.fecha_entrega), 'dd/MM/yyyy') : '—'}
                    </TableCell>
                    <TableCell>{envio.ciudad_entrega || '—'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(envio.precio_total || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Batch Invoice Dialog */}
      <Dialog open={batchOpen} onOpenChange={o => { if (!batchProgress.running) setBatchOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Facturar en Lote — {selected.size} envíos
            </DialogTitle>
            <DialogDescription>
              Los datos fiscales del receptor se aplicarán a todas las facturas
            </DialogDescription>
          </DialogHeader>

          {batchProgress.running ? (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Procesando {batchProgress.current} de {batchProgress.total}...
              </p>
              <Progress value={(batchProgress.current / batchProgress.total) * 100} />
            </div>
          ) : batchResults.length > 0 ? (
            <div className="space-y-2 py-4 max-h-60 overflow-auto">
              {batchResults.map(r => (
                <div key={r.id} className={`flex items-center gap-2 text-sm p-2 rounded ${r.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {r.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span className="font-mono">{r.tracking}</span>
                  {r.error && <span className="text-xs truncate">— {r.error}</span>}
                </div>
              ))}
              <DialogFooter>
                <Button onClick={() => { setBatchOpen(false); setBatchResults([]); }}>Cerrar</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                {/* ARCA status */}
                {arcaLoading ? (
                  <div className="flex items-center justify-center py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                ) : isConfigured ? (
                  <div className="space-y-2">
                    {hasBothEnvironments && (
                      <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/40">
                        <span className="text-xs text-muted-foreground font-medium">Entorno:</span>
                        <div className="flex gap-1">
                          <Button type="button" size="sm" variant={selectedEnvironment === 'sandbox' ? 'default' : 'ghost'} className="h-7 px-3 text-xs" onClick={() => setSelectedEnvironment('sandbox')}>Sandbox</Button>
                          <Button type="button" size="sm" variant={selectedEnvironment === 'production' ? 'default' : 'ghost'} className="h-7 px-3 text-xs" onClick={() => setSelectedEnvironment('production')}>Producción</Button>
                        </div>
                      </div>
                    )}
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        ARCA configurado ({selectedEnvironment === 'sandbox' ? 'Sandbox' : 'Producción'})
                        {config && ` – ${config.razon_social}`}
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">ARCA no configurado. Se guardarán para facturación manual.</AlertDescription>
                  </Alert>
                )}

                {/* IVA toggle */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/40">
                  <Label className="text-sm font-medium cursor-pointer">
                    {ivaIncluido ? 'IVA incluido en el monto' : 'Agregar IVA 21% al monto'}
                  </Label>
                  <Switch checked={ivaIncluido} onCheckedChange={setIvaIncluido} />
                </div>

                {/* Total */}
                <div className="p-3 bg-muted rounded-lg flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total a facturar ({selected.size} envíos):</span>
                  <span className="text-lg font-bold">{formatCurrency(selectedTotal)}</span>
                </div>

                {/* Invoice type */}
                <div className="space-y-2">
                  <Label>Tipo de Comprobante</Label>
                  <RadioGroup value={tipoComprobante} onValueChange={v => setTipoComprobante(v as 'A' | 'B' | 'C')} className="flex gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="A" id="b-a" disabled={condicionIva === 'consumidor_final'} /><Label htmlFor="b-a">Factura A</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="B" id="b-b" /><Label htmlFor="b-b">Factura B</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="C" id="b-c" /><Label htmlFor="b-c">Factura C</Label></div>
                  </RadioGroup>
                </div>

                {/* IVA condition */}
                <div className="space-y-2">
                  <Label>Condición frente al IVA</Label>
                  <Select value={condicionIva} onValueChange={v => setCondicionIva(v as CondicionIVA)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDICION_IVA_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* CUIT */}
                <div className="space-y-2">
                  <Label>{requiresCuit ? 'CUIT *' : 'CUIT/DNI (opcional)'}</Label>
                  <Input placeholder="XX-XXXXXXXX-X" value={cuit} onChange={e => setCuit(e.target.value)} />
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label>Razón Social / Nombre *</Label>
                  <Input placeholder="Nombre completo o razón social" value={nombre} onChange={e => setNombre(e.target.value)} />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label>Domicilio Fiscal (opcional)</Label>
                  <Input placeholder="Dirección completa" value={domicilio} onChange={e => setDomicilio(e.target.value)} />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setBatchOpen(false)}>Cancelar</Button>
                <Button
                  onClick={handleBatchInvoice}
                  disabled={!nombre.trim() || (requiresCuit && !cuit.trim())}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Emitir {selected.size} Factura(s)
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
