import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useARCAIntegration, determinarTipoFactura, validateCUIT, formatCUIT } from '@/hooks/useARCAConfig';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useCuitLookup } from '@/hooks/useCuitLookup';
import { useAuth } from '@/lib/auth';
import { InvoiceLineItems, type LineItem, calcLineSubtotal } from './InvoiceLineItems';
import {
  CONCEPTO_OPTIONS, TIPO_DOCUMENTO_OPTIONS, CONDICION_VENTA_OPTIONS,
  CONDICION_IVA_OPTIONS, type CondicionIVA,
} from './afipConstants';

interface EmitirFacturaDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EmitirFacturaDialog({ open, onClose, onSuccess }: EmitirFacturaDialogProps) {
  const [tipoComprobante, setTipoComprobante] = useState<'A' | 'B' | 'C'>('B');
  const [cuit, setCuit] = useState('');
  const [nombre, setNombre] = useState('');
  const [condicionIva, setCondicionIva] = useState<CondicionIVA>('consumidor_final');
  const [domicilio, setDomicilio] = useState('');
  const [cuitError, setCuitError] = useState('');
  
  const [ivaIncluido, setIvaIncluido] = useState(true);
  const [importeTotal, setImporteTotal] = useState(0);

  const [concepto, setConcepto] = useState(1);
  const [tipoDocumento, setTipoDocumento] = useState(80);
  const [condicionVenta, setCondicionVenta] = useState('Contado');
  const [fechaServicioDesde, setFechaServicioDesde] = useState('');
  const [fechaServicioHasta, setFechaServicioHasta] = useState('');
  const [fechaVtoPago, setFechaVtoPago] = useState('');
  const [importeNoGravado, setImporteNoGravado] = useState(0);
  const [importeExento, setImporteExento] = useState(0);
  const [importeTributos, setImporteTributos] = useState(0);
  const [descripcion, setDescripcion] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const { profile } = useAuth();
  const { isConfigured, config, environment: activeEnvironment, isLoading: arcaLoading } = useARCAIntegration('production');
  const { match: cuitMatch, loading: cuitLoading, lookup: lookupCuit, clear: clearCuitMatch, updateSourceRecord } = useCuitLookup({ tenantId: profile?.tenant_id });

  const needsServiceDates = concepto === 2 || concepto === 3;

  useEffect(() => {
    const clean = cuit.replace(/\D/g, '');
    if (clean.length === 11 && validateCUIT(clean)) {
      lookupCuit(cuit);
    } else {
      clearCuitMatch();
    }
  }, [cuit, lookupCuit, clearCuitMatch]);

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

  useEffect(() => {
    if (config) {
      const tipoSugerido = determinarTipoFactura(config.condicion_iva, condicionIva);
      setTipoComprobante(tipoSugerido);
    }
  }, [condicionIva, config]);

  useEffect(() => {
    const reqCuit = CONDICION_IVA_OPTIONS.find(o => o.value === condicionIva)?.requiresCuit;
    setTipoDocumento(reqCuit ? 80 : 99);
  }, [condicionIva]);

  useEffect(() => {
    if (cuit && CONDICION_IVA_OPTIONS.find(o => o.value === condicionIva)?.requiresCuit) {
      setCuitError(!validateCUIT(cuit) ? 'CUIT inválido' : '');
    } else {
      setCuitError('');
    }
  }, [cuit, condicionIva]);

  const emitirMutation = useMutation({
    mutationFn: async () => {
      const selectedCondition = CONDICION_IVA_OPTIONS.find(o => o.value === condicionIva);
      if (!nombre.trim()) throw new Error('Nombre o Razón Social es requerido');
      if (importeTotal <= 0) throw new Error('El importe total debe ser mayor a 0');
      if (selectedCondition?.requiresCuit && !cuit.trim()) throw new Error('CUIT es requerido para esta condición de IVA');
      if (tipoComprobante === 'A' && !validateCUIT(cuit)) throw new Error('Factura A requiere CUIT válido');
      if (needsServiceDates && (!fechaServicioDesde || !fechaServicioHasta || !fechaVtoPago)) {
        throw new Error('Para servicios, las fechas de servicio y vto. pago son obligatorias');
      }

      const importeTotalConIva = ivaIncluido ? importeTotal : Math.round(importeTotal * 1.21 * 100) / 100;

      const { data, error } = await supabase.functions.invoke('arca-factura', {
        body: {
          tipo_comprobante: tipoComprobante,
          environment: activeEnvironment || 'production',
          receptor: {
            cuit: cuit ? formatCUIT(cuit) : undefined,
            nombre: nombre.trim(),
            condicion_iva: condicionIva,
            domicilio: domicilio.trim() || undefined,
          },
          importe_total: importeTotalConIva,
          concepto,
          tipo_documento: tipoDocumento,
          condicion_venta: condicionVenta,
          fecha_servicio_desde: needsServiceDates ? fechaServicioDesde : undefined,
          fecha_servicio_hasta: needsServiceDates ? fechaServicioHasta : undefined,
          fecha_vto_pago: needsServiceDates ? fechaVtoPago : undefined,
          importe_no_gravado: importeNoGravado,
          importe_exento: importeExento,
          importe_tributos: importeTributos,
          descripcion: descripcion.trim() || undefined,
          line_items: lineItems.length > 0 ? lineItems.map(li => ({
            codigo: li.codigo,
            descripcion: li.descripcion,
            cantidad: li.cantidad,
            unidad_medida: li.unidad_medida,
            precio_unitario: li.precio_unitario,
            bonificacion_pct: li.bonificacion_pct,
            subtotal: calcLineSubtotal(li),
            alicuota_iva: li.alicuota_iva,
          })) : undefined,
        },
      });

      if (error) {
        // Try to surface the real backend error message instead of generic "non-2xx"
        // deno-lint-ignore no-explicit-any
        const ctx: any = (error as any).context;
        let backendMsg: string | undefined;
        try {
          if (ctx && typeof ctx.json === 'function') {
            const parsed = await ctx.json();
            backendMsg = parsed?.error;
          } else if (ctx && typeof ctx.text === 'function') {
            const txt = await ctx.text();
            try { backendMsg = JSON.parse(txt)?.error; } catch { backendMsg = txt; }
          }
        } catch { /* noop */ }
        throw new Error(backendMsg || error.message || 'Error al invocar el servicio');
      }
      if (!data.success && data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (cuitMatch) {
        updateSourceRecord(cuitMatch, {
          nombre: nombre.trim(),
          razonSocial: nombre.trim(),
          direccion: domicilio.trim() || undefined,
          condicionIva: condicionIva,
        });
      }
      if (data.estado === 'emitida') {
        toast.success(`Factura ${tipoComprobante} emitida correctamente`, { description: `CAE: ${data.cae}` });
      } else if (data.estado === 'pendiente') {
        toast.info('Datos de factura guardados', { description: data.message || 'Se procesará manualmente' });
      }
      onSuccess();
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Error al procesar factura', { description: error.message });
    },
  });

  const handleClose = () => {
    setCuit(''); setNombre(''); setCondicionIva('consumidor_final'); setDomicilio('');
    setCuitError(''); setTipoComprobante('B'); setIvaIncluido(true); setImporteTotal(0);
    setConcepto(1); setTipoDocumento(80); setCondicionVenta('Contado');
    setFechaServicioDesde(''); setFechaServicioHasta(''); setFechaVtoPago('');
    setImporteNoGravado(0); setImporteExento(0); setImporteTributos(0);
    setDescripcion(''); setLineItems([]);
    clearCuitMatch();
    onClose();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);

  const requiresCuit = CONDICION_IVA_OPTIONS.find(o => o.value === condicionIva)?.requiresCuit;

  const neto = ivaIncluido
    ? Math.round((importeTotal / 1.21) * 100) / 100
    : importeTotal;
  const total = ivaIncluido
    ? importeTotal
    : Math.round(importeTotal * 1.21 * 100) / 100;
  const iva = Math.round((total - neto) * 100) / 100;
  const grandTotal = Math.round((total + importeNoGravado + importeExento + importeTributos) * 100) / 100;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Emitir Factura Electrónica
          </DialogTitle>
          <DialogDescription>
            Formulario completo para emitir comprobantes con todos los campos AFIP
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* ARCA Status */}
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
              <AlertDescription className="text-yellow-800">
                ARCA no configurado. Los datos se guardarán para facturación manual.
              </AlertDescription>
            </Alert>
          )}

          {/* Concepto + Condición de Venta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Concepto</Label>
              <Select value={String(concepto)} onValueChange={v => setConcepto(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONCEPTO_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condición de Venta</Label>
              <Select value={condicionVenta} onValueChange={setCondicionVenta}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDICION_VENTA_OPTIONS.map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Service dates */}
          {needsServiceDates && (
            <div className="grid grid-cols-3 gap-4 p-3 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label className="text-xs">Período Desde *</Label>
                <Input type="date" value={fechaServicioDesde} onChange={e => setFechaServicioDesde(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Período Hasta *</Label>
                <Input type="date" value={fechaServicioHasta} onChange={e => setFechaServicioHasta(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Fecha Vto. Pago *</Label>
                <Input type="date" value={fechaVtoPago} onChange={e => setFechaVtoPago(e.target.value)} />
              </div>
            </div>
          )}

          {/* IVA toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/40">
            <Label htmlFor="emit-iva-toggle" className="text-sm font-medium cursor-pointer">
              {ivaIncluido ? 'IVA incluido en el monto' : 'Agregar IVA 21% al monto'}
            </Label>
            <Switch id="emit-iva-toggle" checked={ivaIncluido} onCheckedChange={setIvaIncluido} />
          </div>

          {/* Importe Total */}
          <div className="space-y-2">
            <Label>Importe Total *</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              placeholder="0.00"
              value={importeTotal || ''}
              onChange={e => setImporteTotal(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Amount breakdown */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Neto Gravado:</span>
              <span>{formatCurrency(neto)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">IVA 21%:</span>
              <span>{formatCurrency(iva)}</span>
            </div>
            {importeNoGravado > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">No Gravado:</span>
                <span>{formatCurrency(importeNoGravado)}</span>
              </div>
            )}
            {importeExento > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Exento:</span>
                <span>{formatCurrency(importeExento)}</span>
              </div>
            )}
            {importeTributos > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Tributos:</span>
                <span>{formatCurrency(importeTributos)}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t pt-1 mt-1">
              <span className="text-sm font-medium">Total:</span>
              <span className="text-lg font-bold">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Invoice Type */}
          <div className="space-y-2">
            <Label>Tipo de Comprobante</Label>
            <RadioGroup value={tipoComprobante} onValueChange={(v) => setTipoComprobante(v as 'A' | 'B' | 'C')} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="A" id="emit-a" disabled={condicionIva === 'consumidor_final'} />
                <Label htmlFor="emit-a" className="cursor-pointer">Factura A</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="B" id="emit-b" />
                <Label htmlFor="emit-b" className="cursor-pointer">Factura B</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="C" id="emit-c" />
                <Label htmlFor="emit-c" className="cursor-pointer">Factura C</Label>
              </div>
            </RadioGroup>
          </div>

          {/* IVA Condition + Document Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Condición frente al IVA</Label>
              <Select value={condicionIva} onValueChange={(v) => setCondicionIva(v as CondicionIVA)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDICION_IVA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo Documento</Label>
              <Select value={String(tipoDocumento)} onValueChange={v => setTipoDocumento(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_DOCUMENTO_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* CUIT */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>
                {requiresCuit ? 'CUIT' : 'CUIT/DNI (opcional)'}
                {tipoComprobante === 'A' && <span className="text-destructive ml-1">*</span>}
              </Label>
              {cuitLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              {cuitMatch && (
                <Badge variant="secondary" className="text-xs">
                  {cuitMatch.source === 'cliente' ? 'Cliente' : 'Empresa Terciarizada'}
                </Badge>
              )}
            </div>
            <Input placeholder="XX-XXXXXXXX-X" value={cuit} onChange={(e) => setCuit(e.target.value)} className={cuitError ? 'border-destructive' : ''} />
            {cuitError && <p className="text-xs text-destructive">{cuitError}</p>}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>Razón Social / Nombre <span className="text-destructive">*</span></Label>
            <Input placeholder="Nombre completo o razón social" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label>Domicilio Fiscal (opcional)</Label>
            <Input placeholder="Dirección completa" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
          </div>

          {/* Line Items */}
          <InvoiceLineItems items={lineItems} onChange={setLineItems} />

          {/* Extra amounts */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Imp. No Gravado</Label>
              <Input type="number" step="0.01" min={0} value={importeNoGravado} onChange={e => setImporteNoGravado(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Imp. Exento</Label>
              <Input type="number" step="0.01" min={0} value={importeExento} onChange={e => setImporteExento(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Imp. Tributos</Label>
              <Input type="number" step="0.01" min={0} value={importeTributos} onChange={e => setImporteTributos(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descripción / Observaciones (opcional)</Label>
            <Textarea placeholder="Nota o detalle general de la factura" value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={() => emitirMutation.mutate()}
            disabled={emitirMutation.isPending || !nombre.trim() || importeTotal <= 0 || (requiresCuit && !cuit.trim()) || !!cuitError}
          >
            {emitirMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
            ) : (
              <><FileText className="mr-2 h-4 w-4" />{isConfigured ? 'Emitir Factura' : 'Guardar para Facturar'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
