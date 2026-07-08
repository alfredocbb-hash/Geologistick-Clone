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
import { useCuitLookup } from '@/hooks/useCuitLookup';
import { useAuth } from '@/lib/auth';

const CONDICION_IVA_OPTIONS = [
  { value: 'responsable_inscripto' as const, label: 'Responsable Inscripto', requiresCuit: true },
  { value: 'monotributo' as const, label: 'Monotributista', requiresCuit: true },
  { value: 'exento' as const, label: 'Exento', requiresCuit: true },
  { value: 'consumidor_final' as const, label: 'Consumidor Final', requiresCuit: false },
];

type CondicionIVA = typeof CONDICION_IVA_OPTIONS[number]['value'];

interface InvoiceDataDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (facturaData: FacturaResult) => void;
  envioId?: string;
  liquidacionSellerId?: string;
  liquidacionTerciarizadoId?: string;
  importeTotal: number;
}

interface FacturaResult {
  factura_id: string;
  estado: 'pendiente' | 'emitida' | 'rechazada';
  cae?: string;
  cae_vencimiento?: string;
  numero_comprobante?: string;
  message?: string;
}

export function InvoiceDataDialog({
  open, onClose, onSuccess, envioId, liquidacionSellerId, liquidacionTerciarizadoId, importeTotal,
}: InvoiceDataDialogProps) {
  const [tipoComprobante, setTipoComprobante] = useState<'A' | 'B' | 'C'>('B');
  const [cuit, setCuit] = useState('');
  const [nombre, setNombre] = useState('');
  const [condicionIva, setCondicionIva] = useState<CondicionIVA>('consumidor_final');
  const [domicilio, setDomicilio] = useState('');
  const [cuitError, setCuitError] = useState('');
  
  const [ivaIncluido, setIvaIncluido] = useState(true);

  const { profile } = useAuth();
  const { isConfigured, config, environment: activeEnvironment, isLoading: arcaLoading } = useARCAIntegration('production');
  const { match: cuitMatch, loading: cuitLoading, lookup: lookupCuit, clear: clearCuitMatch, updateSourceRecord } = useCuitLookup({ tenantId: profile?.tenant_id });

  // CUIT auto-lookup
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

  // Determine invoice type when IVA condition changes
  useEffect(() => {
    if (config) {
      const tipoSugerido = determinarTipoFactura(config.condicion_iva, condicionIva);
      setTipoComprobante(tipoSugerido);
    }
  }, [condicionIva, config]);

  // Validate CUIT when it changes
  useEffect(() => {
    if (cuit && CONDICION_IVA_OPTIONS.find(o => o.value === condicionIva)?.requiresCuit) {
      if (!validateCUIT(cuit)) {
        setCuitError('CUIT inválido');
      } else {
        setCuitError('');
      }
    } else {
      setCuitError('');
    }
  }, [cuit, condicionIva]);

  // Determine document type/number from user input
  const docInput = cuit.replace(/\D/g, '');
  const isCuit = docInput.length === 11 && validateCUIT(docInput);
  const isDni = docInput.length >= 7 && docInput.length <= 8;
  const tipoDocumento = isCuit ? 80 : isDni ? 96 : 99;

  const emitirFacturaMutation = useMutation({
    mutationFn: async () => {
      const selectedCondition = CONDICION_IVA_OPTIONS.find(o => o.value === condicionIva);

      if (!nombre.trim()) throw new Error('Nombre o Razón Social es requerido');
      if (selectedCondition?.requiresCuit && !cuit.trim()) throw new Error('CUIT es requerido para esta condición de IVA');
      if (selectedCondition?.requiresCuit && !isCuit) throw new Error('CUIT inválido para esta condición de IVA');
      if (tipoComprobante === 'A' && !isCuit) throw new Error('Factura A requiere CUIT válido');

      const importeTotalConIva = ivaIncluido ? importeTotal : Math.round(importeTotal * 1.21 * 100) / 100;

      const { data, error } = await supabase.functions.invoke('arca-factura', {
        body: {
          envio_id: envioId || undefined,
          liquidacion_seller_id: liquidacionSellerId || undefined,
          liquidacion_terciarizado_id: liquidacionTerciarizadoId || undefined,
          tipo_comprobante: tipoComprobante,
          environment: activeEnvironment || 'production',
          tipo_documento: tipoDocumento,
          receptor: {
            cuit: isCuit ? formatCUIT(docInput) : undefined,
            dni: isDni ? docInput : undefined,
            nombre: nombre.trim(),
            condicion_iva: condicionIva,
            domicilio: domicilio.trim() || undefined,
          },
          importe_total: importeTotalConIva,
        },
      });

      if (error) throw error;
      if (!data.success && data.error) throw new Error(data.error);
      return data as FacturaResult;
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
      onSuccess(data);
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Error al procesar factura', { description: error.message });
    },
  });

  const handleClose = () => {
    setCuit(''); setNombre(''); setCondicionIva('consumidor_final'); setDomicilio('');
    setCuitError(''); setTipoComprobante('B'); setIvaIncluido(true);
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Datos para Facturación
          </DialogTitle>
          <DialogDescription>
            Complete los datos fiscales del receptor para emitir la factura electrónica
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* ARCA Status Alert */}
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

          {/* IVA toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/40">
            <Label htmlFor="iva-toggle" className="text-sm font-medium cursor-pointer">
              {ivaIncluido ? 'IVA incluido en el monto' : 'Agregar IVA 21% al monto'}
            </Label>
            <Switch id="iva-toggle" checked={ivaIncluido} onCheckedChange={setIvaIncluido} />
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
            <div className="flex justify-between items-center border-t pt-1 mt-1">
              <span className="text-sm font-medium">Total:</span>
              <span className="text-lg font-bold">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Invoice Type */}
          <div className="space-y-2">
            <Label>Tipo de Comprobante</Label>
            <RadioGroup value={tipoComprobante} onValueChange={(v) => setTipoComprobante(v as 'A' | 'B' | 'C')} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="A" id="factura-a" disabled={condicionIva === 'consumidor_final'} />
                <Label htmlFor="factura-a" className="cursor-pointer">Factura A</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="B" id="factura-b" />
                <Label htmlFor="factura-b" className="cursor-pointer">Factura B</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="C" id="factura-c" />
                <Label htmlFor="factura-c" className="cursor-pointer">Factura C</Label>
              </div>
            </RadioGroup>
          </div>

          {/* IVA Condition */}
          <div className="space-y-2">
            <Label>Condición frente al IVA</Label>
            <Select value={condicionIva} onValueChange={(v) => setCondicionIva(v as CondicionIVA)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar condición" /></SelectTrigger>
              <SelectContent>
                {CONDICION_IVA_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CUIT/DNI */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="cuit">
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
            <Input id="cuit" placeholder="XX-XXXXXXXX-X" value={cuit} onChange={(e) => setCuit(e.target.value)} className={cuitError ? 'border-destructive' : ''} />
            {cuitError && <p className="text-xs text-destructive">{cuitError}</p>}
          </div>

          {/* Name / Razón Social */}
          <div className="space-y-2">
            <Label htmlFor="nombre">Razón Social / Nombre <span className="text-destructive">*</span></Label>
            <Input id="nombre" placeholder="Nombre completo o razón social" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="domicilio">Domicilio Fiscal (opcional)</Label>
            <Input id="domicilio" placeholder="Dirección completa" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={() => emitirFacturaMutation.mutate()}
            disabled={emitirFacturaMutation.isPending || !nombre.trim() || (requiresCuit && !cuit.trim()) || !!cuitError}
          >
            {emitirFacturaMutation.isPending ? (
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
