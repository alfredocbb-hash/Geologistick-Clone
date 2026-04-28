import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileMinus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: any;
  environment?: 'sandbox' | 'production';
  onSuccess: () => void;
}

const formatComprobante = (pv?: number, nro?: number) =>
  pv && nro ? `${String(pv).padStart(4, '0')}-${String(nro).padStart(8, '0')}` : '—';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

export function CreditNoteDialog({ open, onOpenChange, factura, environment = 'production', onSuccess }: Props) {
  const [tipo, setTipo] = useState<'total' | 'parcial'>('total');
  const [importe, setImporte] = useState<string>('0');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && factura) {
      setTipo('total');
      setImporte(String(factura.importe_total || 0));
      setMotivo('');
    }
  }, [open, factura]);

  useEffect(() => {
    if (tipo === 'total' && factura) {
      setImporte(String(factura.importe_total || 0));
    }
  }, [tipo, factura]);

  const handleEmit = async () => {
    const monto = parseFloat(importe);
    if (!monto || monto <= 0) {
      toast.error('Ingrese un importe válido');
      return;
    }
    if (monto > (factura.importe_total || 0) + 0.01) {
      toast.error('El importe no puede superar el total de la factura origen');
      return;
    }
    if (!motivo.trim()) {
      toast.error('Indique el motivo de la Nota de Crédito');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('arca-factura', {
      body: {
        action: 'emitir_nota_credito',
        factura_origen_id: factura.id,
        importe_total: monto,
        motivo,
        total: tipo === 'total',
        environment,
      },
    });
    setLoading(false);
    if (error || !data?.success) {
      toast.error('Error al emitir Nota de Crédito', {
        description: data?.error || error?.message || 'Error desconocido',
      });
      return;
    }
    toast.success(`NC emitida: ${data.numero_comprobante}`, {
      description: `CAE: ${data.cae}`,
    });
    onOpenChange(false);
    onSuccess();
  };

  if (!factura) return null;

  const tipoLetra = factura.tipo_comprobante || 'B';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileMinus className="h-5 w-5" />
            Emitir Nota de Crédito {tipoLetra}
          </DialogTitle>
          <DialogDescription>
            Genera una NC asociada a la factura ante AFIP/ARCA con su CAE correspondiente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Factura origen:</span>
              <span className="font-mono">{formatComprobante(factura.punto_venta, factura.numero_comprobante)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receptor:</span>
              <span className="truncate max-w-[60%]">{factura.receptor_nombre}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total facturado:</span>
              <span className="font-medium">{formatCurrency(factura.importe_total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Tipo NC:</span>
              <Badge variant="outline">NC {tipoLetra}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Nota de Crédito</Label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as 'total' | 'parcial')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="total" id="nc-total" />
                <Label htmlFor="nc-total" className="font-normal cursor-pointer">
                  Anulación Total — {formatCurrency(factura.importe_total)}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="parcial" id="nc-parcial" />
                <Label htmlFor="nc-parcial" className="font-normal cursor-pointer">
                  Ajuste Parcial
                </Label>
              </div>
            </RadioGroup>
          </div>

          {tipo === 'parcial' && (
            <div>
              <Label>Importe a acreditar</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={factura.importe_total}
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Neto: {formatCurrency((parseFloat(importe) || 0) / 1.21)} · IVA 21%: {formatCurrency((parseFloat(importe) || 0) - (parseFloat(importe) || 0) / 1.21)}
              </p>
            </div>
          )}

          <div>
            <Label>Motivo *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Devolución de mercadería, error de facturación, descuento posterior..."
              rows={3}
            />
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              Una vez confirmada, la NC se emite ante AFIP con CAE y queda vinculada a la factura origen. Si es total, la factura origen se marcará como "Anulada por NC".
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleEmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Emitir NC en ARCA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
