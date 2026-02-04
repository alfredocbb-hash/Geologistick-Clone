import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Loader2, MapPin, Save } from 'lucide-react';
import { toast } from 'sonner';
import AddressAutocomplete from '@/components/maps/AddressAutocomplete';

interface EditAddressDialogProps {
  envioId: string;
  currentAddress: string;
  currentCity: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditAddressDialog({
  envioId,
  currentAddress,
  currentCity,
  onClose,
  onSuccess,
}: EditAddressDialogProps) {
  const [address, setAddress] = useState(currentAddress);
  const [city, setCity] = useState(currentCity);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!address.trim()) throw new Error('La dirección es requerida');

      const updateData: Record<string, unknown> = {
        direccion_entrega: address,
        ciudad_entrega: city || null,
      };

      // Only update coordinates if we have them
      if (lat !== null && lng !== null) {
        updateData.entrega_lat = lat;
        updateData.entrega_lng = lng;
        updateData.destinatario_lat = lat;
        updateData.destinatario_lng = lng;
      }

      const { error } = await supabase
        .from('envios')
        .update(updateData)
        .eq('id', envioId);

      if (error) throw error;
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error('Error al actualizar dirección: ' + error.message);
    },
  });

  const handleAddressSelect = (place: { 
    address: string; 
    lat: number; 
    lng: number;
    city?: string;
  }) => {
    setAddress(place.address);
    setLat(place.lat);
    setLng(place.lng);
    if (place.city) {
      setCity(place.city);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Corregir Dirección
          </DialogTitle>
          <DialogDescription>
            Actualiza la dirección de entrega del envío
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Address */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Dirección actual:</p>
            <p className="text-sm font-medium">{currentAddress}</p>
            {currentCity && (
              <p className="text-sm text-muted-foreground">{currentCity}</p>
            )}
          </div>

          {/* New Address */}
          <div className="space-y-2">
            <Label htmlFor="new-address">Nueva dirección *</Label>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              onSelect={handleAddressSelect}
              placeholder="Escribir nueva dirección..."
            />
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label htmlFor="city">Ciudad</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ciudad"
            />
          </div>

          {/* Coordinates indicator */}
          {lat !== null && lng !== null && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <MapPin className="h-3 w-3" />
              Coordenadas actualizadas automáticamente
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !address.trim()}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar y Resolver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
