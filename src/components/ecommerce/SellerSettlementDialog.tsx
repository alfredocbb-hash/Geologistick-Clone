import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, DollarSign } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Seller {
  id: string;
  nombre: string;
  saldo_cuenta_corriente: number;
}

interface SellerSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller: Seller;
}

export function SellerSettlementDialog({ open, onOpenChange, seller }: SellerSettlementDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [tipo, setTipo] = useState<'pago' | 'ajuste'>('pago');
  const [monto, setMonto] = useState<number>(0);
  const [descripcion, setDescripcion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [metodoPago, setMetodoPago] = useState<string>('efectivo');

  const createMovementMutation = useMutation({
    mutationFn: async () => {
      if (!monto || monto <= 0) throw new Error('Ingresa un monto válido');

      const saldoAnterior = seller.saldo_cuenta_corriente || 0;
      // Pagos y ajustes negativos reducen el saldo
      const saldoNuevo = tipo === 'pago' 
        ? saldoAnterior - monto 
        : saldoAnterior + monto; // Ajuste puede ser + o -

      const { error } = await supabase
        .from('seller_cuenta_corriente')
        .insert({
          seller_id: seller.id,
          tipo,
          monto: tipo === 'pago' ? -monto : monto, // Pagos son negativos
          saldo_anterior: saldoAnterior,
          saldo_nuevo: saldoNuevo,
          descripcion: descripcion || (tipo === 'pago' ? 'Pago registrado' : 'Ajuste de saldo'),
          referencia,
          metodo_pago: tipo === 'pago' ? metodoPago : null,
          created_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: tipo === 'pago' ? 'Pago registrado' : 'Ajuste registrado' });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers-cta-cte'] });
      queryClient.invalidateQueries({ queryKey: ['seller-movements'] });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-sellers'] });
      setMonto(0);
      setDescripcion('');
      setReferencia('');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento</DialogTitle>
          <DialogDescription>
            {seller.nombre} • Saldo actual: 
            <span className={`ml-1 font-medium ${seller.saldo_cuenta_corriente > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              ${seller.saldo_cuenta_corriente?.toLocaleString() || '0'}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Movimiento</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as 'pago' | 'ajuste')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pago">Pago (reduce saldo)</SelectItem>
                <SelectItem value="ajuste">Ajuste (puede aumentar o reducir)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Monto *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                value={monto}
                onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
                className="pl-9"
                placeholder="0.00"
              />
            </div>
          </div>

          {tipo === 'pago' && (
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="mercadopago">MercadoPago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Referencia</Label>
            <Input
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Nro. de transferencia, cheque, etc."
            />
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Notas adicionales..."
              rows={2}
            />
          </div>

          {monto > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p>
                <strong>Nuevo saldo:</strong>{' '}
                <span className={tipo === 'pago' ? 'text-green-600' : ''}>
                  ${(seller.saldo_cuenta_corriente - (tipo === 'pago' ? monto : -monto)).toLocaleString()}
                </span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => createMovementMutation.mutate()} 
            disabled={createMovementMutation.isPending || !monto}
          >
            {createMovementMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
