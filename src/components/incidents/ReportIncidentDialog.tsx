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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Camera, X, UserX, XCircle, MapPinOff, PackageX, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

const INCIDENT_TYPES = [
  { value: 'ausente', label: 'Cliente ausente', icon: UserX },
  { value: 'rechazo', label: 'Rechazó el paquete', icon: XCircle },
  { value: 'direccion_incorrecta', label: 'Dirección incorrecta', icon: MapPinOff },
  { value: 'paquete_dañado', label: 'Paquete dañado', icon: PackageX },
  { value: 'otro', label: 'Otro', icon: HelpCircle },
] as const;

interface Shipment {
  id: string;
  tracking_number: string;
  estado: string;
}

interface ReportIncidentDialogProps {
  shipment: Shipment;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReportIncidentDialog({ shipment, onClose, onSuccess }: ReportIncidentDialogProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const STORAGE_KEY = `incident-state-${shipment.id}`;
  
  const [incidentType, setIncidentType] = useState<string>('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restore state from sessionStorage (survives WebView reloads on Android)
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.photoPreview) setPhotoPreview(parsed.photoPreview);
        if (parsed.incidentType) setIncidentType(parsed.incidentType);
        if (parsed.description) setDescription(parsed.description);
      } catch (e) {
        console.error('Error restoring incident state:', e);
      }
      sessionStorage.removeItem(STORAGE_KEY);
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
            incidentType,
            description,
          }));
        } catch (e) {
          console.warn('Could not persist photo to sessionStorage:', e);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save state before opening file picker (Android WebView may reload)
  const handleOpenCamera = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        photoPreview,
        incidentType,
        description,
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

  // Upload file to storage - accepts File or Blob
  const uploadFile = async (file: File | Blob, path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('delivery-photos')
      .upload(path, file, { upsert: true });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: urlData } = await supabase.storage
      .from('delivery-photos')
      .createSignedUrl(data.path, 60 * 60 * 24 * 365); // 1 year

    return urlData?.signedUrl || null;
  };

  // Convert base64 data URL to Blob (fallback when File is lost after WebView reload)
  const dataURLtoBlob = (dataURL: string): Blob => {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(parts[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  };

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      if (!incidentType) throw new Error('Selecciona un tipo de incidente');

      let photoUrl: string | null = null;

      // Upload photo if provided - use File if available, fallback to base64 Blob
      const fileToUpload = photo || (photoPreview ? dataURLtoBlob(photoPreview) : null);
      if (fileToUpload) {
        const photoPath = `incidents/${shipment.id}/evidence_${Date.now()}.jpg`;
        photoUrl = await uploadFile(fileToUpload, photoPath);
        
        if (!photoUrl) {
          throw new Error('Error al subir la foto de evidencia. Por favor intenta nuevamente.');
        }
      }

      // Create incident record
      const { error: incidentError } = await supabase
        .from('incidentes')
        .insert({
          envio_id: shipment.id,
          chofer_id: user.id,
          tipo: incidentType,
          descripcion: description || null,
          foto_evidencia: photoUrl,
          estado: 'pendiente',
          tenant_id: profile?.tenant_id,
        });

      if (incidentError) throw incidentError;

      // Update shipment status to 'incidencia'
      const { error: updateError } = await supabase
        .from('envios')
        .update({ estado: 'incidencia' })
        .eq('id', shipment.id);

      if (updateError) throw updateError;

      // Add history entry
      const incidentLabel = INCIDENT_TYPES.find(t => t.value === incidentType)?.label || incidentType;
      const { error: historyError } = await supabase
        .from('envio_historial')
        .insert({
          envio_id: shipment.id,
          estado_anterior: shipment.estado as any,
          estado_nuevo: 'incidencia',
          notas: `Incidente reportado: ${incidentLabel}. ${description || ''}`.trim(),
          created_by: user.id,
        });

      if (historyError) throw historyError;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['my-active-route-paradas'] });
      await queryClient.cancelQueries({ queryKey: ['my-active-route-envios-hoja'] });
      
      const previousParadas = queryClient.getQueryData(['my-active-route-paradas']);
      const previousEnviosHoja = queryClient.getQueryData(['my-active-route-envios-hoja']);
      
      queryClient.setQueryData(['my-active-route-paradas'], (old: any) => {
        if (!old) return old;
        return old.map((p: any) => 
          p.envio?.id === shipment.id 
            ? { ...p, envio: { ...p.envio, estado: 'incidencia' } }
            : p
        );
      });
      
      queryClient.setQueryData(['my-active-route-envios-hoja'], (old: any) => {
        if (!old) return old;
        return old.map((e: any) => 
          e.envio?.id === shipment.id 
            ? { ...e, envio: { ...e.envio, estado: 'incidencia' } }
            : e
        );
      });
      
      return { previousParadas, previousEnviosHoja };
    },
    onSuccess: () => {
      // Clean up sessionStorage on success
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}

      // Play warning sound
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1f');
      audio.play().catch(() => {});
      
      queryClient.invalidateQueries({ queryKey: ['my-active-route-paradas'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-envios-hoja'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-hoja'] });
      queryClient.invalidateQueries({ queryKey: ['my-active-route-planificada'] });
      toast.warning('Incidente reportado correctamente');
      onSuccess();
      onClose();
    },
    onError: (error, _, context) => {
      setIsSubmitting(false);
      
      if (context?.previousParadas) {
        queryClient.setQueryData(['my-active-route-paradas'], context.previousParadas);
      }
      if (context?.previousEnviosHoja) {
        queryClient.setQueryData(['my-active-route-envios-hoja'], context.previousEnviosHoja);
      }
      toast.error('Error al reportar incidente: ' + error.message);
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Reportar Problema
          </DialogTitle>
          <DialogDescription>
            Indica el motivo por el que no se pudo completar la entrega
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tracking */}
          <div className="text-center">
            <Badge variant="outline" className="font-mono text-lg px-4 py-2">
              {shipment.tracking_number}
            </Badge>
          </div>

          {/* Incident Type */}
          <div className="space-y-3">
            <Label>Tipo de incidente *</Label>
            <RadioGroup value={incidentType} onValueChange={setIncidentType}>
              {INCIDENT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <div 
                    key={type.value}
                    className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      incidentType === type.value 
                        ? 'border-warning bg-warning/10' 
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => setIncidentType(type.value)}
                  >
                    <RadioGroupItem value={type.value} id={type.value} />
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <Label htmlFor={type.value} className="flex-1 cursor-pointer">
                      {type.label}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Describe lo que sucedió..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Photo evidence */}
          <div className="space-y-2">
            <Label>📸 Foto de Evidencia (opcional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            
            {photoPreview ? (
              <div className="relative">
                <img 
                  src={photoPreview} 
                  alt="Evidencia" 
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
                className="w-full h-20 flex flex-col items-center justify-center gap-2"
                onClick={handleOpenCamera}
              >
                <Camera className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm">Agregar foto de evidencia</span>
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => {
              if (isSubmitting || reportMutation.isPending) return;
              setIsSubmitting(true);
              reportMutation.mutate();
            }}
            disabled={isSubmitting || reportMutation.isPending || !incidentType}
            variant="destructive"
            className="gap-2"
          >
            {(isSubmitting || reportMutation.isPending) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            Reportar Incidente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
