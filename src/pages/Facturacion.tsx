import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { EmitirFacturaDialog } from '@/components/invoicing/EmitirFacturaDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { FileText, Loader2, Search, CheckCircle, AlertCircle, Package, Copy, RefreshCw, Download, Plus, MoreVertical, Ban, FileMinus, Printer } from 'lucide-react';
import { useARCAIntegration, determinarTipoFactura, validateCUIT, formatCUIT } from '@/hooks/useARCAConfig';
import { useCuitLookup } from '@/hooks/useCuitLookup';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VoidInvoiceDialog } from '@/components/invoicing/VoidInvoiceDialog';
import { CreditNoteDialog } from '@/components/invoicing/CreditNoteDialog';
import { InvoiceLineItems, type LineItem } from '@/components/invoicing/InvoiceLineItems';
import { CONCEPTO_OPTIONS } from '@/components/invoicing/afipConstants';

const CONDICION_IVA_OPTIONS = [
  { value: 'responsable_inscripto', label: 'Responsable Inscripto', requiresCuit: true },
  { value: 'monotributo', label: 'Monotributista', requiresCuit: true },
  { value: 'exento', label: 'Exento', requiresCuit: true },
  { value: 'consumidor_final', label: 'Consumidor Final', requiresCuit: false },
] as const;

type CondicionIVA = typeof CONDICION_IVA_OPTIONS[number]['value'];

export default function Facturacion() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('pendientes');
  const [search, setSearch] = useState('');
  const [searchEmitidas, setSearchEmitidas] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, running: false });
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncPuntoVenta, setSyncPuntoVenta] = useState('');
  const [syncTipo, setSyncTipo] = useState<string>('todos');
  const [syncResult, setSyncResult] = useState<{ imported: number; pending: number; message: string; errors?: string[] } | null>(null);
  const [batchResults, setBatchResults] = useState<{ id: string; tracking: string; ok: boolean; error?: string }[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [emitirOpen, setEmitirOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    tipo_comprobante: 'B' as 'A' | 'B' | 'C',
    punto_venta: '',
    numero_comprobante: '',
    fecha_emision: format(new Date(), 'yyyy-MM-dd'),
    receptor_cuit: '',
    receptor_nombre: '',
    importe_neto: '',
    importe_iva: '',
    importe_total: '',
    cae: '',
  });

  // Duplicate dialog state
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<any>(null);

  // Batch/duplicate invoice form state
  const [tipoComprobante, setTipoComprobante] = useState<'A' | 'B' | 'C'>('B');
  const [cuit, setCuit] = useState('');
  const [nombre, setNombre] = useState('');
  const [condicionIva, setCondicionIva] = useState<CondicionIVA>('consumidor_final');
  const [domicilio, setDomicilio] = useState('');
  const [ivaIncluido, setIvaIncluido] = useState(true);
  const [duplicateImporte, setDuplicateImporte] = useState(0);
  const [duplicateConcepto, setDuplicateConcepto] = useState<number>(1);
  const [duplicateFechaServicioDesde, setDuplicateFechaServicioDesde] = useState('');
  const [duplicateFechaServicioHasta, setDuplicateFechaServicioHasta] = useState('');
  const [duplicateFechaVtoPago, setDuplicateFechaVtoPago] = useState('');
  const [duplicateDescripcion, setDuplicateDescripcion] = useState('');
  const [duplicateLineItems, setDuplicateLineItems] = useState<LineItem[]>([]);

  // Void / Credit Note state
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<any>(null);
  const [ncOpen, setNcOpen] = useState(false);
  const [ncTarget, setNcTarget] = useState<any>(null);
  const [tipoFilter, setTipoFilter] = useState<'todas' | 'facturas' | 'nc'>('todas');

  const { match: cuitMatch, loading: cuitLoading, lookup: lookupCuit, clear: clearCuitMatch, updateSourceRecord } = useCuitLookup({ tenantId: profile?.tenant_id });

  const { isConfigured, config, environment: activeEnvironment, isLoading: arcaLoading } = useARCAIntegration('production');

  // CUIT auto-lookup for batch/duplicate forms
  useEffect(() => {
    const clean = cuit.replace(/\D/g, '');
    if (clean.length === 11 && validateCUIT(clean)) {
      lookupCuit(cuit);
    } else {
      clearCuitMatch();
    }
  }, [cuit, lookupCuit, clearCuitMatch]);

  // Auto-fill from CUIT match
  useEffect(() => {
    if (cuitMatch) {
      if (cuitMatch.nombre) setNombre(cuitMatch.nombre);
      if (cuitMatch.direccion) setDomicilio(cuitMatch.direccion);
      if (cuitMatch.condicionIva) {
        const validCondicion = CONDICION_IVA_OPTIONS.find(o => o.value === cuitMatch.condicionIva);
        if (validCondicion) setCondicionIva(validCondicion.value);
      }
    }
  }, [cuitMatch]);

  // Fetch delivered shipments without invoice
  const { data: pendientes = [], isLoading, refetch } = useQuery({
    queryKey: ['facturacion-pendiente', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      const { data: envios, error: enviosError } = await supabase
        .from('envios')
        .select('id, tracking_number, nombre_destinatario, fecha_entrega, precio_total, ciudad_entrega, direccion_entrega')
        .eq('tenant_id', profile.tenant_id)
        .eq('estado', 'entregado')
        .order('fecha_entrega', { ascending: false })
        .limit(500);
      if (enviosError) throw enviosError;
      if (!envios?.length) return [];
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

  // Fetch emitted invoices
  const { data: emitidas = [], isLoading: loadingEmitidas, refetch: refetchEmitidas } = useQuery({
    queryKey: ['facturas-emitidas', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      const { data, error } = await supabase
        .from('facturas')
        .select('*, factura_origen:facturas!factura_origen_id(id, punto_venta, numero_comprobante, tipo_comprobante, fecha_emision, cae)')
        .eq('tenant_id', profile.tenant_id)
        .in('estado', ['emitida', 'anulada', 'anulada_por_nc'])
        .order('fecha_emision', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.tenant_id,
  });

  // Sync from AFIP mutation
  const syncMutation = useMutation({
    mutationFn: async ({ puntoVenta, tipo }: { puntoVenta?: number; tipo?: string }) => {
      const body: Record<string, unknown> = { action: 'sync_from_afip', environment: activeEnvironment || 'production' };
      if (puntoVenta) body.punto_venta = puntoVenta;
      if (tipo && tipo !== 'todos') body.tipo = tipo;
      const { data, error } = await supabase.functions.invoke('arca-factura', { body });
      if (error) throw error;
      if (!data.success && data.fallback) {
        // Session conflict - graceful degradation
        return { imported: 0, pending: 0, message: 'AFIP tiene una sesión activa. Intente de nuevo en unos minutos.', fallback: true };
      }
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data.fallback) {
        toast.warning('Sesión AFIP activa', { description: data.message });
        return;
      }
      setSyncResult({ imported: data.imported, pending: data.pending || 0, message: data.message, errors: data.errors });
      if (data.errors?.length) {
        // Check if it's a PV not RECE error
        const pvError = data.errors.find((e: string) => e.includes('ARCA_PV_NOT_RECE'));
        if (pvError) {
          toast.warning('Punto de Venta no compatible', { description: 'Este PV es de tipo "Factura en Línea". Usá "Cargar Manual" para registrar estos comprobantes.' });
        } else {
          toast.warning('Sincronización parcial', { description: data.errors.join('; ') });
        }
      } else if (data.pending === 0) {
        toast.success(data.message || `${data.imported} facturas importadas`);
      } else {
        toast.info(data.message);
      }
      refetchEmitidas();
    },
    onError: (err: Error) => {
      toast.error('Error al sincronizar', { description: err.message });
    },
  });

  const handleManualSave = async () => {
    if (!profile?.tenant_id) return;
    const { data: { user } } = await supabase.auth.getUser();
    const importeTotal = parseFloat(manualForm.importe_total) || 0;
    if (importeTotal <= 0) { toast.error('El importe total debe ser mayor a 0'); return; }
    if (!manualForm.punto_venta || !manualForm.numero_comprobante) { toast.error('Punto de venta y número son obligatorios'); return; }
    
    const { error } = await supabase.from('facturas').insert({
      tenant_id: profile.tenant_id,
      tipo_comprobante: manualForm.tipo_comprobante,
      punto_venta: parseInt(manualForm.punto_venta),
      numero_comprobante: parseInt(manualForm.numero_comprobante),
      fecha_emision: manualForm.fecha_emision,
      receptor_cuit: manualForm.receptor_cuit || null,
      receptor_nombre: manualForm.receptor_nombre || 'Sin datos',
      importe_neto: parseFloat(manualForm.importe_neto) || 0,
      importe_iva: parseFloat(manualForm.importe_iva) || 0,
      importe_total: importeTotal,
      cae: manualForm.cae || null,
      estado: 'emitida',
      importada: true,
      created_by: user?.id,
    });

    if (error) {
      toast.error('Error al guardar factura', { description: error.message });
      return;
    }
    toast.success('Factura manual cargada correctamente');
    setManualOpen(false);
    setManualForm({
      tipo_comprobante: 'B', punto_venta: '', numero_comprobante: '',
      fecha_emision: format(new Date(), 'yyyy-MM-dd'), receptor_cuit: '',
      receptor_nombre: '', importe_neto: '', importe_iva: '', importe_total: '', cae: '',
    });
    refetchEmitidas();
  };

  const filtered = useMemo(() => {
    if (!search) return pendientes;
    const q = search.toLowerCase();
    return pendientes.filter(e =>
      e.tracking_number?.toLowerCase().includes(q) ||
      e.nombre_destinatario?.toLowerCase().includes(q) ||
      e.ciudad_entrega?.toLowerCase().includes(q)
    );
  }, [pendientes, search]);

  const filteredEmitidas = useMemo(() => {
    let list = emitidas;
    if (tipoFilter === 'facturas') list = list.filter((f: any) => !f.es_nota_credito);
    else if (tipoFilter === 'nc') list = list.filter((f: any) => f.es_nota_credito);
    if (!searchEmitidas) return list;
    const q = searchEmitidas.toLowerCase();
    return list.filter((f: any) =>
      f.receptor_nombre?.toLowerCase().includes(q) ||
      f.receptor_cuit?.includes(q) ||
      String(f.numero_comprobante)?.includes(q) ||
      f.cae?.includes(q)
    );
  }, [emitidas, searchEmitidas, tipoFilter]);



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

  const resetForm = () => {
    setCuit('');
    setNombre('');
    setCondicionIva('consumidor_final');
    setDomicilio('');
    setTipoComprobante('B');
    setIvaIncluido(true);
    setDuplicateImporte(0);
    setDuplicateConcepto(1);
    setDuplicateFechaServicioDesde('');
    setDuplicateFechaServicioHasta('');
    setDuplicateFechaVtoPago('');
    setDuplicateDescripcion('');
    setDuplicateLineItems([]);
    clearCuitMatch();
  };

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
            environment: activeEnvironment || 'production',
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
    if (ok > 0) {
      toast.success(`${ok} factura(s) emitida(s) correctamente`);
      // Update source record with missing data
      if (cuitMatch) {
        updateSourceRecord(cuitMatch, {
          nombre: nombre.trim(),
          razonSocial: nombre.trim(),
          direccion: domicilio.trim() || undefined,
          condicionIva: condicionIva,
        });
      }
    }
    if (fail > 0) toast.error(`${fail} factura(s) fallaron`);
    setSelected(new Set());
    refetch();
    refetchEmitidas();
  };

  const handleDuplicate = (factura: any) => {
    setDuplicateSource(factura);
    setTipoComprobante(factura.tipo_comprobante || 'B');
    setCuit(factura.receptor_cuit || '');
    setNombre(factura.receptor_nombre || '');
    setCondicionIva(factura.receptor_condicion_iva || 'consumidor_final');
    setDomicilio(factura.receptor_domicilio || '');
    setDuplicateImporte(factura.importe_total || 0);
    setIvaIncluido(true);
    setDuplicateConcepto(factura.concepto ?? 1);
    setDuplicateFechaServicioDesde(factura.fecha_servicio_desde ? String(factura.fecha_servicio_desde).slice(0, 10) : '');
    setDuplicateFechaServicioHasta(factura.fecha_servicio_hasta ? String(factura.fecha_servicio_hasta).slice(0, 10) : '');
    setDuplicateFechaVtoPago(factura.fecha_vto_pago ? String(factura.fecha_vto_pago).slice(0, 10) : '');
    setDuplicateDescripcion(factura.descripcion || '');
    setDuplicateLineItems(Array.isArray(factura.line_items) ? (factura.line_items as LineItem[]) : []);
    setDuplicateOpen(true);
  };

  const duplicateNeedsServiceDates = duplicateConcepto === 2 || duplicateConcepto === 3;

  const handleEmitDuplicate = async () => {
    try {
      if (duplicateNeedsServiceDates && (!duplicateFechaServicioDesde || !duplicateFechaServicioHasta || !duplicateFechaVtoPago)) {
        toast.error('Para Servicios o Productos+Servicios, las fechas de período y vto. pago son obligatorias');
        return;
      }
      const importeTotal = ivaIncluido ? duplicateImporte : Math.round(duplicateImporte * 1.21 * 100) / 100;
      const { data, error } = await supabase.functions.invoke('arca-factura', {
        body: {
          envio_id: duplicateSource?.envio_id || undefined,
          liquidacion_seller_id: duplicateSource?.liquidacion_seller_id || undefined,
          tipo_comprobante: tipoComprobante,
          environment: activeEnvironment || 'production',
          receptor: {
            cuit: cuit ? formatCUIT(cuit) : undefined,
            nombre: nombre.trim(),
            condicion_iva: condicionIva,
            domicilio: domicilio.trim() || undefined,
          },
          importe_total: importeTotal,
          concepto: duplicateConcepto,
          fecha_servicio_desde: duplicateNeedsServiceDates ? duplicateFechaServicioDesde : undefined,
          fecha_servicio_hasta: duplicateNeedsServiceDates ? duplicateFechaServicioHasta : undefined,
          fecha_vto_pago: duplicateNeedsServiceDates ? duplicateFechaVtoPago : undefined,
          descripcion: duplicateDescripcion.trim() || undefined,
          line_items: duplicateLineItems.length > 0 ? duplicateLineItems : undefined,
        },
      });
      if (error) throw error;
      if (!data.success && data.error) throw new Error(data.error);
      toast.success('Factura duplicada emitida correctamente');
      if (cuitMatch) {
        updateSourceRecord(cuitMatch, {
          nombre: nombre.trim(),
          razonSocial: nombre.trim(),
          direccion: domicilio.trim() || undefined,
          condicionIva: condicionIva,
        });
      }
      setDuplicateOpen(false);
      resetForm();
      refetchEmitidas();
    } catch (err: any) {
      toast.error('Error al emitir factura duplicada', { description: err.message });
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

  const formatComprobante = (pv: number, num: number) =>
    `${String(pv).padStart(4, '0')}-${String(num).padStart(8, '0')}`;

  // Shared ARCA status component
  const ARCAStatus = () => (
    <>
      {arcaLoading ? (
        <div className="flex items-center justify-center py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : isConfigured ? (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            ARCA configurado{config && ` – ${config.razon_social}`}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">ARCA no configurado. Se guardarán para facturación manual.</AlertDescription>
        </Alert>
      )}
    </>
  );

  // Shared invoice form fields
  const InvoiceFormFields = ({ showImporte = false }: { showImporte?: boolean }) => (
    <div className="space-y-4 py-2">
      <ARCAStatus />

      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/40">
        <Label className="text-sm font-medium cursor-pointer">
          {ivaIncluido ? 'IVA incluido en el monto' : 'Agregar IVA 21% al monto'}
        </Label>
        <Switch checked={ivaIncluido} onCheckedChange={setIvaIncluido} />
      </div>

      {showImporte && (
        <div className="space-y-2">
          <Label>Importe Total *</Label>
          <Input
            type="number"
            step="0.01"
            value={duplicateImporte}
            onChange={e => setDuplicateImporte(parseFloat(e.target.value) || 0)}
          />
        </div>
      )}

      {!showImporte && (
        <div className="p-3 bg-muted rounded-lg flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total a facturar ({selected.size} envíos):</span>
          <span className="text-lg font-bold">{formatCurrency(selectedTotal)}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label>Tipo de Comprobante</Label>
        <RadioGroup value={tipoComprobante} onValueChange={v => setTipoComprobante(v as 'A' | 'B' | 'C')} className="flex gap-4">
          <div className="flex items-center space-x-2"><RadioGroupItem value="A" id="f-a" disabled={condicionIva === 'consumidor_final'} /><Label htmlFor="f-a">Factura A</Label></div>
          <div className="flex items-center space-x-2"><RadioGroupItem value="B" id="f-b" /><Label htmlFor="f-b">Factura B</Label></div>
          <div className="flex items-center space-x-2"><RadioGroupItem value="C" id="f-c" /><Label htmlFor="f-c">Factura C</Label></div>
        </RadioGroup>
      </div>

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

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>{requiresCuit ? 'CUIT *' : 'CUIT/DNI (opcional)'}</Label>
          {cuitLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {cuitMatch && (
            <Badge variant="secondary" className="text-xs">
              {cuitMatch.source === 'cliente' ? 'Cliente' : 'Empresa Terciarizada'}
            </Badge>
          )}
        </div>
        <Input placeholder="XX-XXXXXXXX-X" value={cuit} onChange={e => setCuit(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Razón Social / Nombre *</Label>
        <Input placeholder="Nombre completo o razón social" value={nombre} onChange={e => setNombre(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Domicilio Fiscal (opcional)</Label>
        <Input placeholder="Dirección completa" value={domicilio} onChange={e => setDomicilio(e.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Facturación</h1>
          <p className="text-muted-foreground">Gestión de facturas electrónicas</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pendientes">
            Pendientes
            {pendientes.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendientes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="emitidas">
            Emitidas
            {emitidas.length > 0 && (
              <Badge variant="secondary" className="ml-2">{emitidas.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ══════ TAB PENDIENTES ══════ */}
        <TabsContent value="pendientes">
          <div className="space-y-4">
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
                <Button onClick={() => { resetForm(); setBatchOpen(true); }} disabled={selected.size === 0}>
                  <FileText className="mr-2 h-4 w-4" />
                  Facturar en Lote ({selected.size})
                </Button>
                {selected.size > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Total: <strong>{formatCurrency(selectedTotal)}</strong>
                  </span>
                )}
              </CardContent>
            </Card>

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
                          <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
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
                            <Checkbox checked={selected.has(envio.id)} onCheckedChange={() => toggleSelect(envio.id)} />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{envio.tracking_number}</TableCell>
                          <TableCell>{envio.nombre_destinatario || '—'}</TableCell>
                          <TableCell>{envio.fecha_entrega ? format(new Date(envio.fecha_entrega), 'dd/MM/yyyy') : '—'}</TableCell>
                          <TableCell>{envio.ciudad_entrega || '—'}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(envio.precio_total || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══════ TAB EMITIDAS ══════ */}
        <TabsContent value="emitidas">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por receptor, CUIT, nro comprobante o CAE..."
                    value={searchEmitidas}
                    onChange={e => setSearchEmitidas(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v as any)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="facturas">Solo Facturas</SelectItem>
                    <SelectItem value="nc">Solo Notas de Crédito</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => setManualOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Cargar Manual
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSyncPuntoVenta(config?.punto_venta ? String(config.punto_venta) : '');
                    setSyncDialogOpen(true);
                  }}
                  disabled={syncMutation.isPending || !isConfigured}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Sincronizar desde AFIP
                </Button>
                <Button
                  onClick={() => setEmitirOpen(true)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Emitir Factura
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                {loadingEmitidas ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredEmitidas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-10 w-10 mb-2" />
                    <p>No hay facturas emitidas</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nro Comprobante</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Receptor</TableHead>
                        <TableHead>CUIT</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>CAE</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead className="w-20">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmitidas.map((factura: any) => (
                        <TableRow key={factura.id}>
                          <TableCell className="font-mono text-xs">
                            {factura.punto_venta && factura.numero_comprobante
                              ? formatComprobante(factura.punto_venta, factura.numero_comprobante)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {factura.es_nota_credito ? (
                              <Badge className="bg-blue-600 text-white">NC {factura.tipo_comprobante}</Badge>
                            ) : (
                              <Badge variant="outline">Factura {factura.tipo_comprobante}</Badge>
                            )}
                            {factura.estado === 'anulada' && (
                              <Badge variant="destructive" className="ml-1 text-xs">Anulada</Badge>
                            )}
                            {factura.estado === 'anulada_por_nc' && (
                              <Badge className="ml-1 text-xs bg-orange-500 text-white">Anulada x NC</Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{factura.receptor_nombre || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{factura.receptor_cuit || '—'}</TableCell>
                          <TableCell>
                            {factura.fecha_emision ? format(new Date(factura.fecha_emision), 'dd/MM/yyyy') : '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(factura.importe_total || 0)}</TableCell>
                          <TableCell className="font-mono text-xs max-w-[120px] truncate">{factura.cae || '—'}</TableCell>
                          <TableCell>
                            {factura.importada ? (
                              <Badge variant="secondary" className="text-xs">AFIP</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Local</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => window.open(`/print-invoice?factura_id=${factura.id}`, '_blank')}>
                                  <Printer className="mr-2 h-4 w-4" />Imprimir / Ver PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/print-invoice?factura_id=${factura.id}&download=1`, '_blank')}>
                                  <Download className="mr-2 h-4 w-4" />Descargar PDF
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDuplicate(factura)}>
                                  <Copy className="mr-2 h-4 w-4" />Duplicar
                                </DropdownMenuItem>
                                {!factura.cae && factura.estado !== 'anulada' && !factura.es_nota_credito && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => { setVoidTarget(factura); setVoidOpen(true); }} className="text-destructive">
                                      <Ban className="mr-2 h-4 w-4" />Anular (sin CAE)
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {factura.cae && !factura.es_nota_credito && factura.estado !== 'anulada_por_nc' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => { setNcTarget(factura); setNcOpen(true); }}>
                                      <FileMinus className="mr-2 h-4 w-4" />Emitir Nota de Crédito
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════ BATCH INVOICE DIALOG ══════ */}
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
              <InvoiceFormFields />
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

      {/* ══════ DUPLICATE INVOICE DIALOG ══════ */}
      <Dialog open={duplicateOpen} onOpenChange={o => { if (!o) { setDuplicateOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Duplicar Factura
            </DialogTitle>
            <DialogDescription>
              Los datos están precargados de la factura original. Editá lo que necesites antes de emitir.
            </DialogDescription>
          </DialogHeader>

          <InvoiceFormFields showImporte />

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Concepto</Label>
              <Select value={String(duplicateConcepto)} onValueChange={v => setDuplicateConcepto(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONCEPTO_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {duplicateNeedsServiceDates && (
              <div className="grid grid-cols-3 gap-3 p-3 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label className="text-xs">Período Desde *</Label>
                  <Input type="date" value={duplicateFechaServicioDesde} onChange={e => setDuplicateFechaServicioDesde(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Período Hasta *</Label>
                  <Input type="date" value={duplicateFechaServicioHasta} onChange={e => setDuplicateFechaServicioHasta(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Vto. Pago *</Label>
                  <Input type="date" value={duplicateFechaVtoPago} onChange={e => setDuplicateFechaVtoPago(e.target.value)} />
                </div>
              </div>
            )}

            <InvoiceLineItems items={duplicateLineItems} onChange={setDuplicateLineItems} />

            <div className="space-y-2">
              <Label>Descripción / Notas</Label>
              <Textarea
                placeholder="Detalle general de la factura"
                value={duplicateDescripcion}
                onChange={e => setDuplicateDescripcion(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDuplicateOpen(false); resetForm(); }}>Cancelar</Button>
            <Button
              onClick={handleEmitDuplicate}
              disabled={
                !nombre.trim() ||
                (requiresCuit && !cuit.trim()) ||
                duplicateImporte <= 0 ||
                (duplicateNeedsServiceDates && (!duplicateFechaServicioDesde || !duplicateFechaServicioHasta || !duplicateFechaVtoPago))
              }
            >
              <FileText className="mr-2 h-4 w-4" />
              Emitir Factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={syncDialogOpen} onOpenChange={o => { if (!syncMutation.isPending) { setSyncDialogOpen(o); if (!o) setSyncResult(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Sincronizar desde AFIP
            </DialogTitle>
            <DialogDescription>
              Indicá el punto de venta y tipo de comprobante a importar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Punto de Venta</Label>
              <Input
                type="number"
                min={1}
                placeholder="Ej: 1, 2, 7..."
                value={syncPuntoVenta}
                onChange={e => setSyncPuntoVenta(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Punto de venta configurado: {config?.punto_venta || '—'}. Podés cambiarlo para importar de otro.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Comprobante</Label>
              <Select value={syncTipo} onValueChange={setSyncTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos (A, B, C)</SelectItem>
                  <SelectItem value="A">Solo Factura A</SelectItem>
                  <SelectItem value="B">Solo Factura B</SelectItem>
                  <SelectItem value="C">Solo Factura C</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se importan hasta 30 comprobantes por ejecución para evitar timeouts.
              </p>
            </div>

            {syncResult && (
              <>
                <Alert className={syncResult.errors?.length ? 'border-destructive/50 bg-destructive/10' : syncResult.pending > 0 ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30' : 'border-green-200 bg-green-50 dark:bg-green-950/30'}>
                  <AlertDescription className={syncResult.errors?.length ? 'text-destructive' : syncResult.pending > 0 ? 'text-yellow-800 dark:text-yellow-200' : 'text-green-800 dark:text-green-200'}>
                    {syncResult.message}
                    {syncResult.pending > 0 && (
                      <Button variant="link" className="p-0 h-auto ml-1" onClick={() => {
                        setSyncResult(null);
                        const pv = syncPuntoVenta ? parseInt(syncPuntoVenta) : undefined;
                        syncMutation.mutate({ puntoVenta: pv, tipo: syncTipo !== 'todos' ? syncTipo : undefined });
                      }}>
                        Ejecutar de nuevo →
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
                {syncResult.errors?.map((err, i) => (
                  <Alert key={i} className="border-destructive/50 bg-destructive/10">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-destructive text-xs">
                      {err.includes('ARCA_PV_NOT_RECE') 
                        ? err.replace('ARCA_PV_NOT_RECE: ', '') 
                        : err}
                    </AlertDescription>
                  </Alert>
                ))}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSyncDialogOpen(false); setSyncResult(null); }} disabled={syncMutation.isPending}>Cancelar</Button>
            <Button
              onClick={() => {
                setSyncResult(null);
                const pv = syncPuntoVenta ? parseInt(syncPuntoVenta) : undefined;
                syncMutation.mutate({ puntoVenta: pv, tipo: syncTipo !== 'todos' ? syncTipo : undefined });
              }}
              disabled={syncMutation.isPending || !syncPuntoVenta}
            >
              {syncMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════ MANUAL INVOICE DIALOG ══════ */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Cargar Factura Manual
            </DialogTitle>
            <DialogDescription>
              Para comprobantes emitidos desde la web de AFIP (Factura en Línea) u otro sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={manualForm.tipo_comprobante} onValueChange={v => setManualForm(f => ({ ...f, tipo_comprobante: v as 'A' | 'B' | 'C' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Factura A</SelectItem>
                    <SelectItem value="B">Factura B</SelectItem>
                    <SelectItem value="C">Factura C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Punto de Venta *</Label>
                <Input type="number" min={1} placeholder="Ej: 3" value={manualForm.punto_venta} onChange={e => setManualForm(f => ({ ...f, punto_venta: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Número *</Label>
                <Input type="number" min={1} placeholder="Ej: 150" value={manualForm.numero_comprobante} onChange={e => setManualForm(f => ({ ...f, numero_comprobante: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha Emisión *</Label>
                <Input type="date" value={manualForm.fecha_emision} onChange={e => setManualForm(f => ({ ...f, fecha_emision: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CUIT Receptor</Label>
                <Input placeholder="XX-XXXXXXXX-X" value={manualForm.receptor_cuit} onChange={e => setManualForm(f => ({ ...f, receptor_cuit: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Razón Social / Nombre Receptor</Label>
              <Input placeholder="Nombre del receptor" value={manualForm.receptor_nombre} onChange={e => setManualForm(f => ({ ...f, receptor_nombre: e.target.value }))} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Neto</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={manualForm.importe_neto} onChange={e => setManualForm(f => ({ ...f, importe_neto: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>IVA</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={manualForm.importe_iva} onChange={e => setManualForm(f => ({ ...f, importe_iva: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Total *</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={manualForm.importe_total} onChange={e => setManualForm(f => ({ ...f, importe_total: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>CAE</Label>
              <Input placeholder="Código de Autorización Electrónica" value={manualForm.cae} onChange={e => setManualForm(f => ({ ...f, cae: e.target.value }))} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleManualSave}
              disabled={!manualForm.punto_venta || !manualForm.numero_comprobante || !(parseFloat(manualForm.importe_total) > 0)}
            >
              <FileText className="mr-2 h-4 w-4" />
              Guardar Factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════ EMITIR FACTURA AFIP DIALOG ══════ */}
      <EmitirFacturaDialog
        open={emitirOpen}
        onClose={() => setEmitirOpen(false)}
        onSuccess={() => refetchEmitidas()}
      />

      {voidTarget && (
        <VoidInvoiceDialog
          open={voidOpen}
          onOpenChange={setVoidOpen}
          factura={voidTarget}
          onSuccess={() => refetchEmitidas()}
        />
      )}

      {ncTarget && (
        <CreditNoteDialog
          open={ncOpen}
          onOpenChange={setNcOpen}
          factura={ncTarget}
          environment={activeEnvironment || 'production'}
          onSuccess={() => refetchEmitidas()}
        />
      )}
    </div>
  );
}
