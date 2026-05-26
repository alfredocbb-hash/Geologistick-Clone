import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Store, AlertTriangle, CheckCircle2, MapPin, Truck, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface MLRegisterDialogProps {
  open: boolean;
  mlShipmentId: string;
  mlSenderId?: string;
  userId?: string;
  onClose: () => void;
  onSuccess: (envio: any) => void;
  onFallbackOCR?: () => void;
}

interface SellerInfo {
  id: string;
  nombre: string;
  store_id: string;
}

export function MLRegisterDialog({
  open,
  mlShipmentId,
  mlSenderId,
  userId,
  onClose,
  onSuccess,
  onFallbackOCR,
}: MLRegisterDialogProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isLookingUpSeller, setIsLookingUpSeller] = useState(false);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registeredEnvio, setRegisteredEnvio] = useState<any>(null);

  // Look up seller when dialog opens — if not found and OCR fallback available, skip to OCR
  useEffect(() => {
    if (open) {
      setRegisteredEnvio(null);
      setError(null);
      setSeller(null);
      if (mlSenderId) {
        lookupSellerAndMaybeRedirect();
      } else if (onFallbackOCR) {
        // No sender info at all → go straight to OCR
        onFallbackOCR();
        onClose();
      }
    }
  }, [open, mlSenderId]);

  const lookupSellerAndMaybeRedirect = async () => {
    setIsLookingUpSeller(true);
    try {
      const { data } = await supabase
        .from('ecommerce_sellers')
        .select('id, nombre, store_id')
        .eq('store_id', mlSenderId!)
        .eq('plataforma', 'mercadolibre')
        .eq('activo', true)
        .maybeSingle();

      if (data) {
        setSeller(data);
      } else if (onFallbackOCR) {
        // Seller not registered → skip API call that would 401, go straight to OCR
        onFallbackOCR();
        onClose();
      }
    } catch (err) {
      console.error('Error looking up seller:', err);
    } finally {
      setIsLookingUpSeller(false);
    }
  };

  const handleRegister = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('register-ml-shipment', {
        body: {
          ml_shipment_id: mlShipmentId,
          sender_id: mlSenderId || '',
          user_id: userId,
        },
      });

      if (fnError) {
        let errorMessage = 'Error al registrar envío';
        try {
          const errorBody = await fnError.context?.json?.();
          if (errorBody?.error) errorMessage = errorBody.error;
          else if (errorBody?.message) errorMessage = errorBody.message;
        } catch {
          errorMessage = fnError.message || errorMessage;
        }
        throw new Error(errorMessage);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('Envío registrado exitosamente', {
        description: `Tracking: ${data.envio.tracking_number}`,
      });

      setRegisteredEnvio(data.envio);
    } catch (err: any) {
      console.error('Error registering ML shipment:', err);
      setError(err.message || 'Error al registrar el envío');
      toast.error('Error al registrar envío', {
        description: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToPlanner = () => {
    onClose();
    navigate('/route-planner');
  };

  const handleContinueScanning = () => {
    if (registeredEnvio) {
      onSuccess(registeredEnvio);
    }
    onClose();
  };

  // Success state after registration
  if (registeredEnvio) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Envío Registrado
            </DialogTitle>
            <DialogDescription>
              El envío ha sido registrado correctamente y está listo para ser planificado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <span className="text-sm text-muted-foreground">Tracking:</span>
              <Badge variant="secondary" className="font-mono text-base">
                {registeredEnvio.tracking_number}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">ML Shipment ID:</span>
              <Badge variant="outline" className="font-mono">
                {mlShipmentId}
              </Badge>
            </div>

            {registeredEnvio.direccion_entrega && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <MapPin className="h-4 w-4" />
                  Destino:
                </div>
                <p className="text-sm font-medium">{registeredEnvio.direccion_entrega}</p>
                {registeredEnvio.ciudad_entrega && (
                  <p className="text-xs text-muted-foreground">{registeredEnvio.ciudad_entrega}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleContinueScanning} className="w-full sm:w-auto">
              Seguir Escaneando
            </Button>
            {planificadorEnabled && (
              <Button onClick={handleGoToPlanner} className="w-full sm:w-auto gap-2">
                <MapPin className="h-4 w-4" />
                Ir al Planificador
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-500" />
            Envío ML no registrado
          </DialogTitle>
          <DialogDescription>
            Este envío de MercadoLibre Flex no está en el sistema. ¿Desea registrarlo ahora?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Shipment ID */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Shipment ID:</span>
            <Badge variant="secondary" className="font-mono text-base">
              {mlShipmentId}
            </Badge>
          </div>

          {/* Seller Info */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Seller:</span>
            </div>
            {isLookingUpSeller ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : seller ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">{seller.nombre}</span>
              </div>
            ) : mlSenderId ? (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">
                  Cuenta logística
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Cuenta logística</span>
              </div>
            )}
          </div>

          {/* Info: backend will resolve seller/logistics account */}
          {!seller && !isLookingUpSeller && (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
              <Truck className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                Se usará la cuenta logística del tenant para obtener los datos del envío desde MercadoLibre.
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              {onFallbackOCR && (
                <Button
                  variant="outline"
                  onClick={onFallbackOCR}
                  className="w-full gap-2 border-amber-600 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Camera className="h-4 w-4" />
                  Usar OCR (foto de etiqueta)
                </Button>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleRegister} 
            disabled={isLoading || isLookingUpSeller}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Package className="h-4 w-4" />
                Registrar Envío
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}