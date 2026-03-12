import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, CheckCircle2, Package, MapPin, User, Camera, X, Banknote, Smartphone, Building2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import SignatureCanvas from './SignatureCanvas';
import { QRCodeSVG } from 'qrcode.react';
import { useMercadoPagoConfig } from '@/hooks/useIntegrationConfig';

interface Shipment {
  id: string;
  tracking_number: string;
  estado: string;
  precio_total: number;
  pago_contra_entrega: boolean;
  tipo_pago?: string | null;
  direccion_entrega: string | null;
  ciudad_entrega: string | null;
  destinatario?: {
    nombre: string;
    apellido: string | null;
    telefono: string;
  } | null;
}

interface DeliveryConfirmationProps {
  shipment: Shipment;
  onClose: () => void;
  onSuccess: () => void;
}

type PaymentMethodType = 'efectivo' | 'mercado_pago' | 'transferencia';

interface MpPaymentData {
  preference_id: string;
  init_point: string;
  sandbox_init_point: string;
}

export default function DeliveryConfirmation({ shipment, onClose, onSuccess }: DeliveryConfirmationProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const STORAGE_KEY = `delivery-state-${shipment.id}`;
  
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const requiresPayment = shipment.pago_contra_entrega || shipment.tipo_pago === 'destino';
  
  const [amountCollected, setAmountCollected] = useState(
    requiresPayment ? shipment.precio_total.toString() : ''
  );
  const [notes, setNotes] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('efectivo');
  const [mpPayment, setMpPayment] = useState<MpPaymentData | null>(null);
  const [isCreatingMpPayment, setIsCreatingMpPayment] = useState(false);

  const { isConfigured: isMpConfigured, environment: mpEnvironment } = useMercadoPagoConfig();

  // Restore state from sessionStorage (survives WebView reloads on Android)
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.photoPreview) setPhotoPreview(parsed.photoPreview);
        if (parsed.signature) setSignature(parsed.signature);
        if (parsed.notes) setNotes(parsed.notes);
        if (parsed.amountCollected) setAmountCollected(parsed.amountCollected);
      } catch (e) {
        console.error('Error restoring delivery state:', e);
      }
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Capture GPS location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDeliveryLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('GPS no disponible:', error.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  // Handle photo selection - persist to sessionStorage
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        setPhotoPreview(preview);
        // Persist to survive WebView reload
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
            photoPreview: preview,
            signature,
            notes,
            amountCollected,
          }));
        } catch (e) {
          console.warn('Could not persist photo to sessionStorage:', e);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save state before opening camera (Android WebView may reload)
  const handleOpenCamera = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        photoPreview,
        signature,
        notes,
        amountCollected,
      }));
    } catch (e) {}
    // Reset input value so onChange fires even if user picks the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  // Remove photo
  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Clean up and close
  const handleClose = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    onClose();
  };

  // Upload file to Supabase Storage
  const uploadFile = async (file: File | Blob, path: string): Promise<string | null> => {
    // Try upload with one automatic retry
    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase.storage
        .from('delivery-photos')
        .upload(path, file, { upsert: true });

      if (error) {
        console.error(`Upload error (attempt ${attempt + 1}):`, error);
        lastError = error;
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 1500)); // wait before retry
          continue;
        }
        return null;
      }

      const { data: urlData } = await supabase.storage
        .from('delivery-photos')
        .createSignedUrl(data.path, 60 * 60 * 24 * 365); // 1 year

      return urlData?.signedUrl || null;
    }
    console.error('Upload failed after 2 attempts:', lastError);
    return null;
  };

  // Convert data URL to Blob
  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }

      const timestamp = Date.now();
      
      // Upload photo (from File or restored dataURL) and signature in parallel
      const [photoUrl, signatureUrl] = await Promise.all([
        photo 
          ? uploadFile(photo, `deliveries/${shipment.id}/photo_${timestamp}.jpg`)
          : photoPreview
            ? uploadFile(dataURLtoBlob(photoPreview), `deliveries/${shipment.id}/photo_${timestamp}.jpg`)
            : Promise.resolve(null),
        signature
          ? uploadFile(dataURLtoBlob(signature), `deliveries/${shipment.id}/signature_${timestamp}.png`)
          : Promise.resolve(null),
      ]);

      // Update shipment with GPS coordinates
      const updateData: Record<string, unknown> = {
        estado: 'entregado',
        fecha_entrega: new Date().toISOString(),
        entrega_lat: deliveryLocation?.lat || null,
        entrega_lng: deliveryLocation?.lng || null,
      };

      if (photoUrl) updateData.foto_entrega = photoUrl;
      if (signatureUrl) updateData.firma_destinatario = signatureUrl;

      const { error: updateError } = await supabase
        .from('envios')
        .update(updateData)
        .eq('id', shipment.id);

      if (updateError) throw updateError;

      // Calculate commission (history is auto-created by DB trigger)
      const commissionPromise = (async () => {
        if (!user?.id) return;
        
        const { data: driverProfile } = await supabase
          .from('profiles')
          .select('comision_tipo, comision_porcentaje, comision_fija')
          .eq('user_id', user.id)
          .single();

        const { data: envioData } = await supabase
          .from('envios')
          .select(`
            id,
            precio_total,
            tarifa_id,
            requiere_retiro,
            chofer_id,
            tarifas:tarifas(comision_chofer_porcentaje, comision_chofer_fija)
          `)
          .eq('id', shipment.id)
          .single();

        if (!envioData) return;

        let montoTotal = 0;
        let porcentajeAplicado = 0;
        let montoFijoAplicado = 0;

        const comisionTipo = driverProfile?.comision_tipo || 'tarifa';

        if (comisionTipo === 'tarifa' && envioData.tarifas) {
          const tarifa = envioData.tarifas as { comision_chofer_porcentaje: number | null; comision_chofer_fija: number | null };
          porcentajeAplicado = tarifa.comision_chofer_porcentaje || 0;
          montoFijoAplicado = tarifa.comision_chofer_fija || 0;
          const comisionPorcentaje = (envioData.precio_total * porcentajeAplicado) / 100;
          montoTotal = comisionPorcentaje + montoFijoAplicado;
        } else if (comisionTipo === 'porcentaje') {
          porcentajeAplicado = driverProfile?.comision_porcentaje || 0;
          montoTotal = (envioData.precio_total * porcentajeAplicado) / 100;
        } else if (comisionTipo === 'fija') {
          montoFijoAplicado = driverProfile?.comision_fija || 0;
          montoTotal = montoFijoAplicado;
        } else if (comisionTipo === 'mixta') {
          porcentajeAplicado = driverProfile?.comision_porcentaje || 0;
          montoFijoAplicado = driverProfile?.comision_fija || 0;
          montoTotal = (envioData.precio_total * porcentajeAplicado) / 100 + montoFijoAplicado;
        }

        if (montoTotal > 0) {
          const { data: existingCommission } = await supabase
            .from('comisiones')
            .select('id')
            .eq('envio_id', shipment.id)
            .eq('chofer_id', user.id)
            .eq('tipo', 'entrega')
            .maybeSingle();

          if (!existingCommission) {
            await supabase.from('comisiones').insert({
              chofer_id: user.id,
              envio_id: shipment.id,
              monto: montoTotal,
              porcentaje_aplicado: porcentajeAplicado,
              monto_fijo_aplicado: montoFijoAplicado,
              tenant_id: profile?.tenant_id,
              tipo: 'entrega',
            });
          }
        }

        // Check if there was a pickup by a different driver
        if (envioData.requiere_retiro && envioData.chofer_id && envioData.chofer_id !== user.id) {
          const pickupDriverId = envioData.chofer_id;
          
          const { data: pickupDriverProfile } = await supabase
            .from('profiles')
            .select('comision_retiro_tipo, comision_retiro_porcentaje, comision_retiro_fija')
            .eq('user_id', pickupDriverId)
            .single();

          if (pickupDriverProfile && pickupDriverProfile.comision_retiro_tipo !== 'ninguna') {
            let montoRetiro = 0;
            let porcentajeRetiro = 0;
            let fijoRetiro = 0;

            if (pickupDriverProfile.comision_retiro_tipo === 'porcentaje') {
              porcentajeRetiro = pickupDriverProfile.comision_retiro_porcentaje || 0;
              montoRetiro = (envioData.precio_total * porcentajeRetiro) / 100;
            } else if (pickupDriverProfile.comision_retiro_tipo === 'fija') {
              fijoRetiro = pickupDriverProfile.comision_retiro_fija || 0;
              montoRetiro = fijoRetiro;
            } else if (pickupDriverProfile.comision_retiro_tipo === 'mixta') {
              porcentajeRetiro = pickupDriverProfile.comision_retiro_porcentaje || 0;
              fijoRetiro = pickupDriverProfile.comision_retiro_fija || 0;
              montoRetiro = (envioData.precio_total * porcentajeRetiro) / 100 + fijoRetiro;
            }

            if (montoRetiro > 0) {
              const { data: existingPickupCommission } = await supabase
                .from('comisiones')
                .select('id')
                .eq('envio_id', shipment.id)
                .eq('chofer_id', pickupDriverId)
                .eq('tipo', 'retiro')
                .maybeSingle();

              if (!existingPickupCommission) {
                await supabase.from('comisiones').insert({
                  chofer_id: pickupDriverId,
                  envio_id: shipment.id,
                  monto: montoRetiro,
                  porcentaje_aplicado: porcentajeRetiro,
                  monto_fijo_aplicado: fijoRetiro,
                  tenant_id: profile?.tenant_id,
                  tipo: 'retiro',
                });
              }
            }
          }
        }
      })();

      await commissionPromise;

      // Register COD payment if applicable
      if (requiresPayment && amountCollected && parseFloat(amountCollected) > 0) {
        try {
          if (paymentMethod === 'mercado_pago') {
            // MP payment is already registered as "pendiente" by the edge function
            // The webhook will update it when payment completes
            console.log('MP payment already registered, skipping COD registration');
          } else {
            const { data: codResult, error: codError } = await supabase.rpc('register_cod_payment', {
              p_envio_id: shipment.id,
              p_monto: parseFloat(amountCollected),
              p_metodo: paymentMethod as any,
            });
            if (codError) {
              console.error('Error registering COD payment:', codError);
            } else {
              console.log('COD payment registered:', codResult);
            }
          }
        } catch (e) {
          console.error('Error in COD payment registration:', e);
        }
      }
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['my-active-route-paradas'] });
      await queryClient.cancelQueries({ queryKey: ['my-active-route-envios-hoja'] });
      
      // Use fuzzy matching to find and update all route queries (key includes routeId)
      const paradasSnapshot = queryClient.getQueriesData<any[]>({ queryKey: ['my-active-route-paradas'] });
      const enviosHojaSnapshot = queryClient.getQueriesData<any[]>({ queryKey: ['my-active-route-envios-hoja'] });
      
      for (const [key, data] of paradasSnapshot) {
        if (!data) continue;
        queryClient.setQueryData(key, data.map((p: any) => 
          p.envio?.id === shipment.id 
            ? { ...p, envio: { ...p.envio, estado: 'entregado' } }
            : p
        ));
      }
      
      for (const [key, data] of enviosHojaSnapshot) {
        if (!data) continue;
        queryClient.setQueryData(key, data.map((e: any) => 
          e.envio?.id === shipment.id 
            ? { ...e, envio: { ...e.envio, estado: 'entregado' } }
            : e
        ));
      }
      
      return { paradasSnapshot, enviosHojaSnapshot };
    },
    onSuccess: () => {
      // Play success sound
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdGWEjJCLhX51aV1RR0BGUFxnc36IkJaZl5GIe21fTj45Njg+R1FdaXeCjpeepKaknZOGdmNQPjEqKS00P0xbaoKSnaewtLKsoJF+aVQ/Ly');
      audio.play().catch(() => {});
      
      // Clear persisted state
      sessionStorage.removeItem(STORAGE_KEY);
      
      // Invalidate to ensure we have fresh data
      queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-envios-hoja'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-hoja'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-planificada'] });

      // Fire-and-forget: send email notification for delivery
      if (profile?.tenant_id) {
        (async () => {
          try {
            const { data: envio } = await supabase
              .from('envios')
              .select('email_destinatario, tracking_number, nombre_destinatario, direccion_entrega, tenant_id, pago_contra_entrega, precio_total')
              .eq('id', shipment.id)
              .single();
            if (envio?.email_destinatario && envio?.tenant_id) {
              const { sendShipmentEmail } = await import('@/lib/emailNotifications');
              sendShipmentEmail({
                tenant_id: envio.tenant_id,
                to: envio.email_destinatario,
                template: 'status_change',
                data: {
                  tracking_number: envio.tracking_number,
                  estado_nuevo: 'entregado',
                  nombre_destinatario: envio.nombre_destinatario || '',
                  direccion_entrega: envio.direccion_entrega || '',
                  pago_contra_entrega: envio.pago_contra_entrega || false,
                  precio_total: envio.precio_total,
                  tracking_url: `${window.location.origin}/tracking?q=${envio.tracking_number}`,
                },
              });
            }
          } catch (e) {
            console.error('[DeliveryConfirmation] Email notification error:', e);
          }
        })();
      }
      
      toast.success('¡Entrega confirmada exitosamente!');
      onSuccess();
      onClose();
    },
    onError: (error, _, context) => {
      // Rollback using snapshots
      if (context?.paradasSnapshot) {
        for (const [key, data] of context.paradasSnapshot) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.enviosHojaSnapshot) {
        for (const [key, data] of context.enviosHojaSnapshot) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error('Error al confirmar entrega: ' + error.message);
    },
  });

  const canSubmit = (!requiresPayment || (amountCollected && parseFloat(amountCollected) > 0)) && 
    (paymentMethod !== 'mercado_pago' || mpPayment !== null);

  const handleCreateMpPayment = async () => {
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
            envio_id: shipment.id,
            tracking_number: shipment.tracking_number,
            amount: parseFloat(amountCollected) || shipment.precio_total,
            description: `Envío ${shipment.tracking_number}`,
            environment: mpEnvironment,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Error al crear pago de Mercado Pago');
        return;
      }
      setMpPayment(data);
      toast.success('QR de pago generado');
    } catch (error) {
      console.error('Error creating MP payment:', error);
      toast.error('Error al conectar con Mercado Pago');
    } finally {
      setIsCreatingMpPayment(false);
    }
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Confirmar Entrega
          </DialogTitle>
          <DialogDescription>
            Captura la evidencia de entrega
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tracking */}
          <div className="text-center">
            <Badge variant="outline" className="font-mono text-lg px-4 py-2">
              {shipment.tracking_number}
            </Badge>
          </div>

          {/* Destinatario info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {shipment.destinatario 
                  ? `${shipment.destinatario.nombre} ${shipment.destinatario.apellido || ''}`
                  : 'Sin destinatario'}
              </span>
            </div>
            
            {shipment.direccion_entrega && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm">
                  {shipment.direccion_entrega}
                  {shipment.ciudad_entrega && `, ${shipment.ciudad_entrega}`}
                </span>
              </div>
            )}
          </div>

          {/* Photo capture - OPCIONAL */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">📸 Foto de Entrega (Opcional)</Label>
             <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            
            {photoPreview ? (
              <div className="relative">
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-lg border-2 border-success"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={removePhoto}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full h-24 flex flex-col items-center justify-center gap-2 border-muted-foreground"
                onClick={handleOpenCamera}
              >
                <Camera className="h-8 w-8 text-muted-foreground" />
                <span className="text-muted-foreground">Tomar Foto</span>
              </Button>
            )}
          </div>

          {/* Signature */}
          <div className="space-y-2">
            <Label>✍️ Firma del Destinatario</Label>
            <SignatureCanvas onSignatureChange={setSignature} />
          </div>

          {/* Amount collected (if COD or pago en destino) */}
          {requiresPayment && (
            <div className="space-y-3">
              <Label htmlFor="amount" className="text-destructive font-medium">💵 Monto a Cobrar *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amountCollected}
                  onChange={(e) => setAmountCollected(e.target.value)}
                  className="pl-8 border-destructive"
                  placeholder={shipment.precio_total.toFixed(2)}
                />
              </div>
              <p className="text-sm text-destructive font-medium">
                ⚠️ COBRAR AL DESTINATARIO: ${shipment.precio_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>

              {/* Payment method selector */}
              <Label>Método de Cobro</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => { setPaymentMethod(v as PaymentMethodType); setMpPayment(null); }}
                className="grid gap-2"
              >
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${paymentMethod === 'efectivo' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <RadioGroupItem value="efectivo" className="sr-only" />
                  <Banknote className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-sm">Efectivo</span>
                </label>
                {isMpConfigured && (
                  <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${paymentMethod === 'mercado_pago' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                    <RadioGroupItem value="mercado_pago" className="sr-only" />
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium text-sm">Mercado Pago</span>
                  </label>
                )}
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${paymentMethod === 'transferencia' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <RadioGroupItem value="transferencia" className="sr-only" />
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-sm">Transferencia</span>
                </label>
              </RadioGroup>

              {/* MP QR Section */}
              {paymentMethod === 'mercado_pago' && !mpPayment && (
                <Button
                  type="button"
                  onClick={handleCreateMpPayment}
                  disabled={isCreatingMpPayment || !amountCollected || parseFloat(amountCollected) <= 0}
                  className="w-full"
                >
                  {isCreatingMpPayment ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando QR...</>
                  ) : (
                    <><Smartphone className="h-4 w-4 mr-2" /> Generar QR de Pago</>
                  )}
                </Button>
              )}

              {paymentMethod === 'mercado_pago' && mpPayment && (
                <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 space-y-3">
                  <div className="flex justify-center p-3 bg-white rounded-lg">
                    <QRCodeSVG
                      value={mpEnvironment === 'sandbox' ? mpPayment.sandbox_init_point : mpPayment.init_point}
                      size={180}
                      level="M"
                      includeMargin
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const url = mpEnvironment === 'sandbox' ? mpPayment.sandbox_init_point : mpPayment.init_point;
                      window.open(url, '_blank');
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" /> Abrir Link
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Muestre el QR al destinatario. El pago se registra automáticamente.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Observaciones de la entrega..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending || !canSubmit}
            className="gap-2 bg-success hover:bg-success/90"
          >
            {confirmMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirmar Entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
