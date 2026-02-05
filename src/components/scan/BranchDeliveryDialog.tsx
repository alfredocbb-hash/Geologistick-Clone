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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  PackageCheck, 
  User, 
  CreditCard, 
  Check, 
  Loader2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import SignatureCanvas from '@/components/delivery/SignatureCanvas';
import { PaymentMethodDialog } from '@/components/shipments/PaymentMethodDialog';

interface BranchDeliveryDialogProps {
  open: boolean;
  shipment: {
    id: string;
    tracking_number: string;
    tipo_pago?: string | null;
    precio_total: number;
    destinatario?: {
      nombre: string;
      apellido?: string | null;
    } | null;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'destinatario', label: 'Es el destinatario' },
  { value: 'familiar', label: 'Familiar' },
  { value: 'empleado', label: 'Empleado/Representante' },
  { value: 'otro', label: 'Otro' },
];

export function BranchDeliveryDialog({
  open,
  shipment,
  onClose,
  onSuccess,
}: BranchDeliveryDialogProps) {
  const { user, profile } = useAuth();
  
  // Form state
  const [nombreRetira, setNombreRetira] = useState('');
  const [dniRetira, setDniRetira] = useState('');
  const [parentesco, setParentesco] = useState('destinatario');
  const [signature, setSignature] = useState<string | null>(null);
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [facturaTipo, setFacturaTipo] = useState<'A' | 'B' | 'C'>('B');
  
  // Payment state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  
  // UI state
  const [isProcessing, setIsProcessing] = useState(false);

  const isPagoContado = shipment?.tipo_pago === 'contado' || !shipment?.tipo_pago;
  const isPagoDestino = shipment?.tipo_pago === 'destino';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  const handleClose = () => {
    // Reset form
    setNombreRetira('');
    setDniRetira('');
    setParentesco('destinatario');
    setSignature(null);
    setRequiereFactura(false);
    setFacturaTipo('B');
    setPaymentCompleted(false);
    setPaymentMethod(null);
    setPaymentReference(null);
    onClose();
  };

  const handlePaymentConfirm = async (method: string, reference: string) => {
    setPaymentMethod(method);
    setPaymentReference(reference);
    setPaymentCompleted(true);
    setShowPaymentDialog(false);
    toast.success('Pago registrado correctamente');
  };

  const validateForm = () => {
    if (!nombreRetira.trim()) {
      toast.error('Ingresa el nombre de quien retira');
      return false;
    }
    if (!dniRetira.trim()) {
      toast.error('Ingresa el DNI/CUIT de quien retira');
      return false;
    }
    if (!signature) {
      toast.error('Se requiere la firma de quien retira');
      return false;
    }
    if (isPagoDestino && !paymentCompleted) {
      toast.error('Debe procesar el pago antes de entregar');
      return false;
    }
    return true;
  };

  const handleConfirmDelivery = async () => {
    if (!shipment || !validateForm()) return;

    // Validar que el usuario esté autenticado
    if (!user?.id) {
      toast.error('Sesión expirada', {
        description: 'Por favor, inicia sesión nuevamente'
      });
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Update shipment with delivery data
      const { error: updateError } = await supabase
        .from('envios')
        .update({
          estado: 'entregado',
          fecha_entrega: new Date().toISOString(),
          nombre_retira: nombreRetira.trim(),
          dni_retira: dniRetira.trim(),
          parentesco_retira: parentesco,
          retira_firma: signature,
          entregado_en_sucursal: true,
          entregado_por: user.id,
          requiere_factura: requiereFactura,
          factura_tipo: requiereFactura ? facturaTipo : null,
        })
        .eq('id', shipment.id);

      if (updateError) throw updateError;

      // Note: History entry is auto-created by DB trigger log_envio_estado_change

      // 3. Record payment if pago destino
      if (isPagoDestino && paymentCompleted && paymentMethod) {
        // Insert payment record
        await supabase.from('pagos').insert([{
          envio_id: shipment.id,
          monto: shipment.precio_total,
          metodo: paymentMethod as 'efectivo' | 'mercado_pago' | 'transferencia' | 'tarjeta',
          referencia: paymentReference,
          estado: 'pagado',
          created_by: user.id,
        }]);

        // Check for open cash session and add movement
        if (profile?.sucursal_id) {
          const { data: sesionCaja } = await supabase
            .from('sesiones_caja')
            .select('id')
            .eq('sucursal_id', profile.sucursal_id)
            .eq('estado', 'abierta')
            .single();

          if (sesionCaja) {
            await supabase.from('movimientos_caja').insert([{
              sesion_caja_id: sesionCaja.id,
              envio_id: shipment.id,
              monto: shipment.precio_total,
              tipo: 'ingreso',
              concepto: `Cobro envío ${shipment.tracking_number} (destino)`,
              metodo_pago: paymentMethod as 'efectivo' | 'mercado_pago' | 'transferencia' | 'tarjeta',
              referencia: paymentReference,
              created_by: user.id,
            }]);
          }
        }
      }

      toast.success('Entrega confirmada', {
        description: `Envío ${shipment.tracking_number} entregado correctamente`,
      });
      
      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error('Error confirming delivery:', error);
      toast.error('Error al confirmar la entrega', {
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!shipment) return null;

  const destinatarioName = shipment.destinatario 
    ? `${shipment.destinatario.nombre}${shipment.destinatario.apellido ? ` ${shipment.destinatario.apellido}` : ''}`
    : 'Sin destinatario';

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-primary" />
              Entrega en Sucursal
            </DialogTitle>
            <DialogDescription>
              Confirma la entrega del envío al cliente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Shipment Info */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tracking</span>
                <Badge variant="outline" className="font-mono">
                  {shipment.tracking_number}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Destinatario</span>
                <span className="font-medium">{destinatarioName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monto</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(shipment.precio_total)}
                </span>
              </div>
            </div>

            {/* Payment Status */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Estado del Pago</span>
                </div>
                {isPagoContado ? (
                  <Badge className="bg-emerald-100 text-emerald-800">
                    <Check className="h-3 w-3 mr-1" />
                    Pagado en Origen
                  </Badge>
                ) : paymentCompleted ? (
                  <Badge className="bg-emerald-100 text-emerald-800">
                    <Check className="h-3 w-3 mr-1" />
                    Cobrado
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Pendiente de Cobro
                  </Badge>
                )}
              </div>

              {isPagoDestino && !paymentCompleted && (
                <div className="mt-4">
                  <Button 
                    onClick={() => setShowPaymentDialog(true)}
                    className="w-full"
                    variant="default"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Procesar Pago ({formatCurrency(shipment.precio_total)})
                  </Button>
                </div>
              )}
            </div>

            {/* Pickup Person Data */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-medium">Datos de Quien Retira</Label>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombreRetira">Nombre Completo *</Label>
                  <Input
                    id="nombreRetira"
                    placeholder="Nombre y apellido"
                    value={nombreRetira}
                    onChange={(e) => setNombreRetira(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dniRetira">DNI/CUIT *</Label>
                  <Input
                    id="dniRetira"
                    placeholder="Número de documento"
                    value={dniRetira}
                    onChange={(e) => setDniRetira(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parentesco">Relación con el Destinatario</Label>
                  <Select value={parentesco} onValueChange={setParentesco}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIP_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Invoice Request */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-medium">Facturación</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requiereFactura"
                  checked={requiereFactura}
                  onCheckedChange={(checked) => setRequiereFactura(checked === true)}
                />
                <Label htmlFor="requiereFactura" className="cursor-pointer">
                  El cliente solicita factura
                </Label>
              </div>

              {requiereFactura && (
                <div className="pl-6">
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    Tipo de Factura
                  </Label>
                  <RadioGroup
                    value={facturaTipo}
                    onValueChange={(val) => setFacturaTipo(val as 'A' | 'B' | 'C')}
                    className="flex gap-4"
                  >
                    {['A', 'B', 'C'].map((tipo) => (
                      <div key={tipo} className="flex items-center space-x-2">
                        <RadioGroupItem value={tipo} id={`factura-${tipo}`} />
                        <Label htmlFor={`factura-${tipo}`} className="cursor-pointer">
                          Factura {tipo}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground mt-2">
                    La factura será generada posteriormente y enviada al cliente
                  </p>
                </div>
              )}
            </div>

            {/* Signature */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span>Firma de Quien Retira *</span>
              </Label>
              <SignatureCanvas
                onSignatureChange={setSignature}
                width={400}
                height={150}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDelivery}
              disabled={isProcessing || (isPagoDestino && !paymentCompleted)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Confirmar Entrega
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      {shipment && (
        <PaymentMethodDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          trackingNumber={shipment.tracking_number}
          amount={shipment.precio_total}
          envioId={shipment.id}
          onConfirm={handlePaymentConfirm}
        />
      )}
    </>
  );
}
