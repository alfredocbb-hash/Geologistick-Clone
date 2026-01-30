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
import { Loader2, CheckCircle2, Package, MapPin, User, Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import SignatureCanvas from './SignatureCanvas';

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

export default function DeliveryConfirmation({ shipment, onClose, onSuccess }: DeliveryConfirmationProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  // Check if payment is required - either by flag or tipo_pago
  const requiresPayment = shipment.pago_contra_entrega || shipment.tipo_pago === 'destino';
  
  const [amountCollected, setAmountCollected] = useState(
    requiresPayment ? shipment.precio_total.toString() : ''
  );
  const [notes, setNotes] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState<{ lat: number; lng: number } | null>(null);

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

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove photo
  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload file to Supabase Storage
  const uploadFile = async (file: File | Blob, path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('delivery-photos')
      .upload(path, file, { upsert: true });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('delivery-photos')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
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
      // Validar que el usuario esté autenticado
      if (!user?.id) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }

      const timestamp = Date.now();
      
      // Upload photo and signature in parallel
      const [photoUrl, signatureUrl] = await Promise.all([
        photo 
          ? uploadFile(photo, `deliveries/${shipment.id}/photo_${timestamp}.jpg`)
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

      // Add history entry and calculate commission in parallel
      const historyPromise = supabase
        .from('envio_historial')
        .insert({
          envio_id: shipment.id,
          estado_anterior: shipment.estado as any,
          estado_nuevo: 'entregado',
          notas: notes || 'Entrega confirmada con foto y firma',
          ubicacion: shipment.direccion_entrega || null,
          created_by: user.id,
        });

      const commissionPromise = (async () => {
        if (!user?.id) return;
        
        // First get driver's commission config from profile
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

        // Calculate commission based on driver's config or fallback to tariff
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

        // Insert delivery commission
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

        // Check if there was a pickup by a different driver and calculate their commission
        if (envioData.requiere_retiro && envioData.chofer_id && envioData.chofer_id !== user.id) {
          const pickupDriverId = envioData.chofer_id;
          
          // Get pickup driver's commission config
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
              // Check if pickup commission already exists
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

      await Promise.all([historyPromise, commissionPromise]);
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['my-active-route-paradas'] });
      await queryClient.cancelQueries({ queryKey: ['my-active-route-envios-hoja'] });
      
      // Snapshot previous values
      const previousParadas = queryClient.getQueryData(['my-active-route-paradas']);
      const previousEnviosHoja = queryClient.getQueryData(['my-active-route-envios-hoja']);
      
      // Optimistically update paradas
      queryClient.setQueryData(['my-active-route-paradas'], (old: any) => {
        if (!old) return old;
        return old.map((p: any) => 
          p.envio?.id === shipment.id 
            ? { ...p, envio: { ...p.envio, estado: 'entregado' } }
            : p
        );
      });
      
      // Optimistically update envios hoja
      queryClient.setQueryData(['my-active-route-envios-hoja'], (old: any) => {
        if (!old) return old;
        return old.map((e: any) => 
          e.envio?.id === shipment.id 
            ? { ...e, envio: { ...e.envio, estado: 'entregado' } }
            : e
        );
      });
      
      return { previousParadas, previousEnviosHoja };
    },
    onSuccess: () => {
      // Play success sound
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdGWEjJCLhX51aV1RR0BGUFxnc36IkJaZl5GIe21fTj45Njg+R1FdaXeCjpeepKaknZOGdmNQPjEqKS00P0xbaoKSnaewtLKsoJF+aVQ/Ly');
      audio.play().catch(() => {});
      
      // Invalidate to ensure we have fresh data
      queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-envios-hoja'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-hoja'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-planificada'] });
      
      toast.success('¡Entrega confirmada exitosamente!');
      onSuccess();
      onClose();
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousParadas) {
        queryClient.setQueryData(['my-active-route-paradas'], context.previousParadas);
      }
      if (context?.previousEnviosHoja) {
        queryClient.setQueryData(['my-active-route-envios-hoja'], context.previousEnviosHoja);
      }
      toast.error('Error al confirmar entrega: ' + error.message);
    },
  });

  const canSubmit = !requiresPayment || (amountCollected && parseFloat(amountCollected) > 0);

  return (
    <Dialog open onOpenChange={onClose}>
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

          {/* Photo capture */}
          <div className="space-y-2">
            <Label>📸 Foto de Entrega</Label>
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
                  className="w-full h-48 object-cover rounded-lg"
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
                className="w-full h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-8 w-8 text-muted-foreground" />
                <span>Tomar Foto</span>
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
            <div className="space-y-2">
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
          <Button variant="outline" onClick={onClose}>
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
