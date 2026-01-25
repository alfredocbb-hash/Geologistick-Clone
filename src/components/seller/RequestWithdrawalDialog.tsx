import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSellerData } from '@/hooks/useSellerData';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RequestWithdrawalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestWithdrawalDialog({ open, onOpenChange }: RequestWithdrawalDialogProps) {
  const { seller } = useSellerData();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('transferencia');
  const [datosBancarios, setDatosBancarios] = useState('');

  const availableBalance = seller?.saldo_cuenta_corriente || 0;
  const requestedAmount = parseFloat(monto) || 0;
  const isValidAmount = requestedAmount > 0 && requestedAmount <= availableBalance;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!seller?.id) throw new Error('No seller found');
      if (!isValidAmount) throw new Error('Invalid amount');

      const { error } = await supabase
        .from('seller_cuenta_corriente')
        .insert({
          seller_id: seller.id,
          tipo: 'solicitud_retiro',
          monto: -requestedAmount, // Negative because it's a withdrawal
          saldo_anterior: seller.saldo_cuenta_corriente,
          saldo_nuevo: seller.saldo_cuenta_corriente - requestedAmount,
          descripcion: `Solicitud de retiro - ${metodoPago}`,
          referencia: datosBancarios || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Solicitud enviada',
        description: 'Tu solicitud de retiro ha sido registrada. El equipo de administración la procesará pronto.',
      });
      queryClient.invalidateQueries({ queryKey: ['seller-data'] });
      queryClient.invalidateQueries({ queryKey: ['seller-movements'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setMonto('');
    setMetodoPago('transferencia');
    setDatosBancarios('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Retiro</DialogTitle>
          <DialogDescription>
            Solicita un retiro de tu saldo a favor. El monto será procesado por el equipo de administración.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Saldo disponible</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(availableBalance)}
            </p>
          </div>

          {availableBalance <= 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No tienes saldo disponible para retirar.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="monto">Monto a retirar</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              min="0"
              max={availableBalance}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              disabled={availableBalance <= 0}
            />
            {requestedAmount > availableBalance && (
              <p className="text-sm text-destructive">
                El monto no puede superar el saldo disponible
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="metodo">Método de pago</Label>
            <Select value={metodoPago} onValueChange={setMetodoPago}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia bancaria</SelectItem>
                <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="datos">
              {metodoPago === 'transferencia' ? 'CBU / Alias' : 
               metodoPago === 'mercadopago' ? 'Email o CVU' : 
               'Notas adicionales'}
            </Label>
            <Textarea
              id="datos"
              value={datosBancarios}
              onChange={(e) => setDatosBancarios(e.target.value)}
              placeholder={
                metodoPago === 'transferencia' ? 'Ingresa tu CBU o alias bancario' :
                metodoPago === 'mercadopago' ? 'Ingresa tu email o CVU de Mercado Pago' :
                'Indica cómo prefieres recibir el efectivo'
              }
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!isValidAmount || mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Solicitar Retiro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
