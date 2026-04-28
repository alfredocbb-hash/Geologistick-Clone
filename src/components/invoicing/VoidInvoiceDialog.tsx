import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: any;
  onSuccess: () => void;
}

export function VoidInvoiceDialog({ open, onOpenChange, factura, onSuccess }: Props) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVoid = async () => {
    if (!motivo.trim()) {
      toast.error('Indique un motivo de anulación');
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('facturas').update({
      estado: 'anulada',
      anulada_at: new Date().toISOString(),
      anulada_por: user?.id,
      motivo_anulacion: motivo,
    }).eq('id', factura.id);
    setLoading(false);
    if (error) {
      toast.error('Error al anular', { description: error.message });
      return;
    }
    toast.success('Factura anulada correctamente');
    onOpenChange(false);
    setMotivo('');
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular Factura</DialogTitle>
          <DialogDescription>
            Esta acción anula localmente la factura. Solo aplicable a comprobantes sin CAE.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              La factura será marcada como anulada y no podrá utilizarse. Si tiene CAE,
              debe emitir una Nota de Crédito en lugar de anular.
            </AlertDescription>
          </Alert>
          <div>
            <Label>Motivo *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Indique el motivo de la anulación"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button variant="destructive" onClick={handleVoid} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Anulación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
