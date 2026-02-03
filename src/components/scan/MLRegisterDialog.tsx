import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Store, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MLRegisterDialogProps {
  open: boolean;
  mlShipmentId: string;
  mlSenderId?: string;
  onClose: () => void;
  onSuccess: (envio: any) => void;
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
  onClose,
  onSuccess,
}: MLRegisterDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLookingUpSeller, setIsLookingUpSeller] = useState(false);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Look up seller when dialog opens
  useEffect(() => {
    if (open && mlSenderId) {
      lookupSeller();
    }
  }, [open, mlSenderId]);

  const lookupSeller = async () => {
    if (!mlSenderId) return;
    
    setIsLookingUpSeller(true);
    try {
      const { data, error } = await supabase
        .from('ecommerce_sellers')
        .select('id, nombre, store_id')
        .eq('store_id', mlSenderId)
        .eq('plataforma', 'mercadolibre')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSeller(data);
      }
    } catch (err) {
      console.error('Error looking up seller:', err);
    } finally {
      setIsLookingUpSeller(false);
    }
  };

  const handleRegister = async () => {
    if (!mlSenderId) {
      setError('No se pudo identificar el seller desde el código QR');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('register-ml-shipment', {
        body: {
          ml_shipment_id: mlShipmentId,
          sender_id: mlSenderId,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Error al registrar envío');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('Envío registrado exitosamente', {
        description: `Tracking: ${data.envio.tracking_number}`,
      });

      onSuccess(data.envio);
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
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">
                  ID: {mlSenderId} (no registrado)
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No detectado</span>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Warning if seller not found */}
          {!isLookingUpSeller && !seller && mlSenderId && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                El seller con store_id {mlSenderId} no está registrado en el sistema. 
                Debe agregarlo primero en la sección de E-commerce → Sellers.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleRegister} 
            disabled={isLoading || !seller}
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
