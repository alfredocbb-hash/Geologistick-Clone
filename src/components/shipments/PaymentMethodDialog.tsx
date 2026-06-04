import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { DollarSign, Banknote, CreditCard, Building2, Smartphone, Loader2, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useMercadoPagoConfig } from '@/hooks/useIntegrationConfig';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

type PaymentMethod = 'efectivo' | 'mercado_pago' | 'transferencia' | 'tarjeta';

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingNumber: string;
  amount: number;
  envioId?: string;
  onConfirm: (method: PaymentMethod, reference: string) => Promise<void>;
  isLoading?: boolean;
}

interface MercadoPagoPayment {
  preference_id: string;
  init_point: string;
  sandbox_init_point: string;
}

export function PaymentMethodDialog({
  open,
  onOpenChange,
  trackingNumber,
  amount,
  envioId,
  onConfirm,
  isLoading = false,
}: PaymentMethodDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('efectivo');
  const [reference, setReference] = useState('');
  const [isCreatingMpPayment, setIsCreatingMpPayment] = useState(false);
  const [mpPayment, setMpPayment] = useState<MercadoPagoPayment | null>(null);
  const [isWaitingForPayment, setIsWaitingForPayment] = useState(false);
  const [mpEstado, setMpEstado] = useState<'pendiente' | 'pagado' | 'fallido' | 'reembolsado' | null>(null);
  const [isCheckingMp, setIsCheckingMp] = useState(false);

  const { isConfigured: isMpConfigured, isLoading: isMpLoading, environment: mpEnvironment } = useMercadoPagoConfig();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setMpPayment(null);
      setIsWaitingForPayment(false);
      setIsCreatingMpPayment(false);
      setMpEstado(null);
    }
  }, [open]);

  // Poll Mercado Pago status while waiting for payment
  const checkMpStatus = async (silent = false) => {
    if (!envioId) return;
    if (!silent) setIsCheckingMp(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-check-status', {
        body: { envio_id: envioId },
      });
      if (error) throw error;
      const estado = data?.estado as typeof mpEstado;
      if (estado) setMpEstado(estado);
      return estado;
    } catch (err) {
      console.error('Error checking MP status:', err);
    } finally {
      if (!silent) setIsCheckingMp(false);
    }
  };

  useEffect(() => {
    if (!open || !mpPayment || !envioId) return;
    if (mpEstado === 'pagado' || mpEstado === 'fallido') return;
    const interval = setInterval(() => { checkMpStatus(true); }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mpPayment, envioId, mpEstado]);

  const handleCreateMercadoPagoPayment = async () => {
    if (!envioId) {
      toast.error('ID de envío no disponible');
      return;
    }

    setIsCreatingMpPayment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            envio_id: envioId,
            tracking_number: trackingNumber,
            amount: amount,
            description: `Envío ${trackingNumber}`,
            environment: mpEnvironment,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'MP_NOT_CONFIGURED') {
          toast.error('Mercado Pago no está configurado. Contacte al administrador.');
        } else {
          toast.error(data.error || 'Error al crear pago de Mercado Pago');
        }
        return;
      }

      setMpPayment(data);
      setIsWaitingForPayment(true);
      toast.success('Link de pago creado');
    } catch (error) {
      console.error('Error creating MP payment:', error);
      toast.error('Error al conectar con Mercado Pago');
    } finally {
      setIsCreatingMpPayment(false);
    }
  };

  const handleOpenPaymentLink = () => {
    if (mpPayment) {
      const url = mpEnvironment === 'sandbox' ? mpPayment.sandbox_init_point : mpPayment.init_point;
      window.open(url, '_blank');
    }
  };

  const handleConfirmMercadoPago = async () => {
    if (!mpPayment) return;
    // Re-verificar pago en MP antes de confirmar
    const estado = await checkMpStatus();
    if (estado !== 'pagado') {
      toast.error('El pago aún no fue acreditado en Mercado Pago. Esperá a la confirmación o cambiá de método.');
      return;
    }
    await onConfirm('mercado_pago', mpPayment.preference_id);
  };

  const handleConfirm = async () => {
    if (selectedMethod === 'mercado_pago' && !mpPayment) {
      await handleCreateMercadoPagoPayment();
    } else if (selectedMethod === 'mercado_pago' && mpPayment) {
      await handleConfirmMercadoPago();
    } else {
      await onConfirm(selectedMethod, reference);
    }
  };

  const handleCancelMpPayment = async () => {
    if (mpPayment) {
      // Mark the MP preference as cancelled in the database
      try {
        await supabase
          .from('pagos')
          .update({ estado: 'fallido' })
          .eq('mercado_pago_id', mpPayment.preference_id);
      } catch (error) {
        console.error('Error cancelling MP payment:', error);
      }
    }
    // Reset MP state and go back to method selection
    setMpPayment(null);
    setIsWaitingForPayment(false);
    setIsCreatingMpPayment(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode; description: string; disabled?: boolean; disabledReason?: string }[] = [
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
      description: isMpConfigured ? 'QR, enlace de pago o transferencia MP' : 'No configurado',
      disabled: !isMpConfigured && !isMpLoading,
      disabledReason: 'Integración no configurada',
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

          {/* Mercado Pago Payment Flow */}
          {selectedMethod === 'mercado_pago' && mpPayment && (
            <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                <span className="font-medium">Link de pago generado</span>
                {mpEnvironment === 'sandbox' && (
                  <Badge variant="outline" className="text-xs">Sandbox</Badge>
                )}
              </div>

              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG
                  value={mpEnvironment === 'sandbox' ? mpPayment.sandbox_init_point : mpPayment.init_point}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
              
              <Button 
                onClick={handleOpenPaymentLink} 
                className="w-full"
                variant="default"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Link de Pago
              </Button>

              {/* Estado en vivo del pago */}
              <div className="rounded-lg border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Estado del pago</span>
                  {mpEstado === 'pagado' ? (
                    <Badge className="bg-green-500 hover:bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Aprobado
                    </Badge>
                  ) : mpEstado === 'fallido' ? (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Rechazado
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Esperando pago…
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => checkMpStatus()}
                  disabled={isCheckingMp}
                >
                  {isCheckingMp ? (
                    <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Verificando…</>
                  ) : (
                    'Verificar pago ahora'
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  La verificación se actualiza automáticamente cada 5 segundos. Solo se podrá confirmar cuando MP acredite el pago.
                </p>
              </div>
            </div>
          )}

          {/* Payment method selector */}
          {!mpPayment && (
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
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      method.disabled 
                        ? 'opacity-50 cursor-not-allowed bg-muted/30' 
                        : 'hover:bg-muted/50'
                    } ${
                      selectedMethod === method.value && !method.disabled
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                    onClick={(e) => method.disabled && e.preventDefault()}
                  >
                    <RadioGroupItem 
                      value={method.value} 
                      className="sr-only" 
                      disabled={method.disabled}
                    />
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        selectedMethod === method.value && !method.disabled
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {method.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{method.label}</p>
                        {method.disabled && (
                          <Badge variant="secondary" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {method.disabledReason}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                    {selectedMethod === method.value && !method.disabled && (
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
          )}

          {/* Reference field - hide for MP when payment link exists */}
          {!(selectedMethod === 'mercado_pago' && mpPayment) && (
            <div className="space-y-2">
              <Label htmlFor="reference">Información adicional (opcional)</Label>
              <Input
                id="reference"
                placeholder="Nro. de operación, referencia, etc."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {selectedMethod === 'mercado_pago' && mpPayment ? (
            <>
              <Button variant="outline" onClick={handleCancelMpPayment} disabled={isLoading}>
                Cambiar método de pago
              </Button>
              <Button onClick={handleConfirmMercadoPago} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Confirmar Pago'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isLoading || isCreatingMpPayment}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={isLoading || isCreatingMpPayment || (selectedMethod === 'mercado_pago' && !isMpConfigured)}
              >
                {isLoading || isCreatingMpPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isCreatingMpPayment ? 'Generando link...' : 'Procesando...'}
                  </>
                ) : selectedMethod === 'mercado_pago' ? (
                  'Generar Link de Pago'
                ) : (
                  'Confirmar Pago'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
