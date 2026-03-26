import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Store, AlertTriangle, CheckCircle2, MapPin, Truck } from 'lucide-react';
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
}

interface SellerInfo {
  id: string;
  nombre: string;
  store_id: string;
}

interface LogisticsAccountInfo {
  id: string;
  nombre: string;
}

export function MLRegisterDialog({
  open,
  mlShipmentId,
  mlSenderId,
  userId,
  onClose,
  onSuccess,
}: MLRegisterDialogProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isLookingUpSeller, setIsLookingUpSeller] = useState(false);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [logisticsAccount, setLogisticsAccount] = useState<LogisticsAccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registeredEnvio, setRegisteredEnvio] = useState<any>(null);

  // Look up seller when dialog opens
  useEffect(() => {
    if (open) {
      lookupSeller();
      setRegisteredEnvio(null);
      setError(null);
      setLogisticsAccount(null);
    }
  }, [open, mlSenderId]);

  const lookupSeller = async () => {
    setIsLookingUpSeller(true);
    setSeller(null);
    try {
      // If we have a sender ID, try direct seller first
      if (mlSenderId) {
        const { data, error } = await supabase
          .from('ecommerce_sellers')
          .select('id, nombre, store_id')
          .eq('store_id', mlSenderId)
          .eq('plataforma', 'mercadolibre')
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setSeller(data);
          setIsLookingUpSeller(false);
          return;
        }
      }
      
      // No direct seller (or no sender ID) — check for logistics account
      await lookupLogisticsAccount();
    } catch (err) {
      console.error('Error looking up seller:', err);
    } finally {
      setIsLookingUpSeller(false);
    }
  };

  const lookupLogisticsAccount = async () => {
    if (!userId) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', userId)
        .single();

      if (!profile?.tenant_id) return;

      const { data: logSeller } = await supabase
        .from('ecommerce_sellers')
        .select('id, nombre')
        .eq('tenant_id', profile.tenant_id)
        .eq('es_cuenta_logistica', true)
        .eq('plataforma', 'mercadolibre')
        .eq('activo', true)
        .limit(1)
        .maybeSingle();

      if (logSeller) {
        setLogisticsAccount(logSeller);
      }
    } catch (err) {
      console.error('Error looking up logistics account:', err);
    }
  };

  const handleRegister = async () => {
    const useLogisticsAccount = !seller && !!logisticsAccount;

    if (!seller && !logisticsAccount) {
      setError('No hay seller directo ni cuenta logística configurada');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('register-ml-shipment', {
        body: {
          ml_shipment_id: mlShipmentId,
          sender_id: mlSenderId || '',
          user_id: userId,
          use_logistics_account: useLogisticsAccount,
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
            <Button onClick={handleGoToPlanner} className="w-full sm:w-auto gap-2">
              <MapPin className="h-4 w-4" />
              Ir al Planificador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const canRegister = !!seller || !!logisticsAccount;

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

          {/* Logistics Account Info - shown when no direct seller but logistics account exists */}
          {!isLookingUpSeller && !seller && logisticsAccount && (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
              <Truck className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                Se usará la cuenta logística <strong>{logisticsAccount.nombre}</strong> para obtener los datos del envío desde MercadoLibre.
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Warning if no seller and no logistics account */}
          {!isLookingUpSeller && !seller && !logisticsAccount && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                El seller con store_id {mlSenderId} no está registrado y no hay una cuenta logística configurada.
                Configure una cuenta logística en E-commerce → Sellers para poder registrar envíos de sellers no autorizados.
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
            disabled={isLoading || !canRegister}
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
