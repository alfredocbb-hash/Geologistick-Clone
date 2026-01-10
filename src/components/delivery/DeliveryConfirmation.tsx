import { useState, useRef } from 'react';
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [amountCollected, setAmountCollected] = useState(
    shipment.pago_contra_entrega ? shipment.precio_total.toString() : ''
  );
  const [notes, setNotes] = useState('');

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
      let photoUrl: string | null = null;
      let signatureUrl: string | null = null;

      // Upload photo if provided
      if (photo) {
        const photoPath = `deliveries/${shipment.id}/photo_${Date.now()}.jpg`;
        photoUrl = await uploadFile(photo, photoPath);
      }

      // Upload signature if provided
      if (signature) {
        const signatureBlob = dataURLtoBlob(signature);
        const signaturePath = `deliveries/${shipment.id}/signature_${Date.now()}.png`;
        signatureUrl = await uploadFile(signatureBlob, signaturePath);
      }

      // Update shipment
      const updateData: Record<string, unknown> = {
        estado: 'entregado',
        fecha_entrega: new Date().toISOString(),
      };

      if (photoUrl) updateData.foto_entrega = photoUrl;
      if (signatureUrl) updateData.firma_destinatario = signatureUrl;

      const { error: updateError } = await supabase
        .from('envios')
        .update(updateData)
        .eq('id', shipment.id);

      if (updateError) throw updateError;

      // Add history entry
      const { error: historyError } = await supabase
        .from('envio_historial')
        .insert({
          envio_id: shipment.id,
          estado_anterior: shipment.estado as any,
          estado_nuevo: 'entregado',
          notas: notes || 'Entrega confirmada con foto y firma',
          ubicacion: shipment.direccion_entrega || null,
          created_by: user?.id,
        });

      if (historyError) throw historyError;

      // Generate driver commission
      if (user?.id) {
        const { data: envioData } = await supabase
          .from('envios')
          .select(`
            id,
            precio_total,
            tarifa_id,
            tarifas:tarifas(comision_chofer_porcentaje, comision_chofer_fija)
          `)
          .eq('id', shipment.id)
          .single();

        if (envioData && envioData.tarifas) {
          const tarifa = envioData.tarifas as { comision_chofer_porcentaje: number | null; comision_chofer_fija: number | null };
          const porcentaje = tarifa.comision_chofer_porcentaje || 0;
          const montoFijo = tarifa.comision_chofer_fija || 0;
          const comisionPorcentaje = (envioData.precio_total * porcentaje) / 100;
          const montoTotal = comisionPorcentaje + montoFijo;

          if (montoTotal > 0) {
            const { data: existingCommission } = await supabase
              .from('comisiones')
              .select('id')
              .eq('envio_id', shipment.id)
              .eq('chofer_id', user.id)
              .maybeSingle();

            if (!existingCommission) {
              await supabase.from('comisiones').insert({
                chofer_id: user.id,
                envio_id: shipment.id,
                monto: montoTotal,
                porcentaje_aplicado: porcentaje,
                monto_fijo_aplicado: montoFijo,
              });
            }
          }
        }
      }
    },
    onSuccess: () => {
      // Play success sound
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdGWEjJCLhX51aV1RR0BGUFxnc36IkJaZl5GIe21fTj45Njg+R1FdaXeCjpeepKaknZOGdmNQPjEqKS00P0xbaoKSnaewtLKsoJF+aVQ/Ly');
      audio.play().catch(() => {});
      
      queryClient.invalidateQueries({ queryKey: ['my-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route'] });
      toast.success('¡Entrega confirmada exitosamente!');
      onSuccess();
      onClose();
    },
    onError: (error) => {
      toast.error('Error al confirmar entrega: ' + error.message);
    },
  });

  const canSubmit = !shipment.pago_contra_entrega || (amountCollected && parseFloat(amountCollected) > 0);

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

          {/* Amount collected (if COD) */}
          {shipment.pago_contra_entrega && (
            <div className="space-y-2">
              <Label htmlFor="amount">💵 Monto Cobrado *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amountCollected}
                  onChange={(e) => setAmountCollected(e.target.value)}
                  className="pl-8"
                  placeholder={shipment.precio_total.toFixed(2)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Monto esperado: ${shipment.precio_total.toFixed(2)}
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
