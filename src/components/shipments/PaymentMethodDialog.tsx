import { useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DollarSign, Banknote, CreditCard, Building2, Smartphone, Loader2 } from 'lucide-react';

type PaymentMethod = 'efectivo' | 'mercado_pago' | 'transferencia' | 'tarjeta';

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingNumber: string;
  amount: number;
  onConfirm: (method: PaymentMethod, reference: string) => Promise<void>;
  isLoading?: boolean;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'efectivo',
    label: 'Efectivo',
    icon: <Banknote className="h-5 w-5" />,
    description: 'Pago en efectivo en sucursal',
  },
  {
    value: 'mercado_pago',
    label: 'Mercado Pago',
    icon: <Smartphone className="h-5 w-5" />,
    description: 'QR, enlace de pago o transferencia MP',
  },
  {
    value: 'transferencia',
    label: 'Transferencia',
    icon: <Building2 className="h-5 w-5" />,
    description: 'Transferencia bancaria',
  },
  {
    value: 'tarjeta',
    label: 'Tarjeta',
    icon: <CreditCard className="h-5 w-5" />,
    description: 'Tarjeta de débito o crédito',
  },
];

export function PaymentMethodDialog({
  open,
  onOpenChange,
  trackingNumber,
  amount,
  onConfirm,
  isLoading = false,
}: PaymentMethodDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('efectivo');
  const [reference, setReference] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  const handleConfirm = async () => {
    await onConfirm(selectedMethod, reference);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Procesar Pago
          </DialogTitle>
          <DialogDescription>
            Selecciona el método de pago del remitente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Amount display */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monto a pagar</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(amount)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tracking: <span className="font-mono font-medium">{trackingNumber}</span>
            </p>
          </div>

          {/* Payment method selector */}
          <div className="space-y-3">
            <Label>Método de Pago</Label>
            <RadioGroup
              value={selectedMethod}
              onValueChange={(value) => setSelectedMethod(value as PaymentMethod)}
              className="grid gap-2"
            >
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                    selectedMethod === method.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <RadioGroupItem value={method.value} className="sr-only" />
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      selectedMethod === method.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {method.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{method.label}</p>
                    <p className="text-xs text-muted-foreground">{method.description}</p>
                  </div>
                  {selectedMethod === method.value && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                      </svg>
                    </div>
                  )}
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Reference field */}
          <div className="space-y-2">
            <Label htmlFor="reference">Información adicional (opcional)</Label>
            <Input
              id="reference"
              placeholder="Nro. de operación, referencia, etc."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              'Confirmar Pago'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
