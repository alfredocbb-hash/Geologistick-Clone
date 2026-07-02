import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liquidacion: any | null;
  onSuccess?: () => void;
}

export function RegistrarMovimientoDialog({ open, onOpenChange, liquidacion, onSuccess }: Props) {
  const qc = useQueryClient();
  const [metodo, setMetodo] = useState<string>('efectivo');
  const [referencia, setReferencia] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  if (!liquidacion) return null;
  const monto = Number(liquidacion.monto);
  const esPago = monto > 0;
  const montoAbs = Math.abs(monto);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc('registrar_movimiento_liquidacion_manual', {
        p_id: liquidacion.id,
        p_metodo: metodo,
        p_referencia: referencia || null,
        p_fecha: fecha ? new Date(fecha).toISOString() : null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Error');
      toast.success(esPago ? 'Pago registrado en caja' : 'Cobro registrado en caja');
      qc.invalidateQueries({ queryKey: ['liquidaciones-manuales'] });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Error al registrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar {esPago ? 'pago' : 'cobro'}</DialogTitle>
          <DialogDescription>
            Liquidación <span className="font-mono">#{liquidacion.numero}</span> — genera un movimiento en la caja abierta de tu sucursal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Monto</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">${montoAbs.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <Badge className={esPago ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}>
                {esPago ? 'PAGO (egreso)' : 'COBRO (ingreso)'}
              </Badge>
            </div>
          </div>

          <div>
            <Label>Método de pago *</Label>
            <Select value={metodo} onValueChange={setMetodo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Referencia</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="N° operación, comprobante, etc." maxLength={200} />
          </div>

          <div>
            <Label>Fecha</Label>
            <Input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
