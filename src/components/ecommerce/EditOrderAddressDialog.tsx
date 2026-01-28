import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { AddressAutocomplete, AddressDetails } from '@/components/maps/AddressAutocomplete';
import { GoogleMapsProvider } from '@/components/maps/GoogleMapsProvider';

interface Order {
  id: string;
  external_order_number: string | null;
  external_order_id: string;
  buyer_name: string;
  buyer_phone: string | null;
  shipping_address: string;
  shipping_city: string | null;
  shipping_province: string | null;
  shipping_postal_code: string | null;
  shipping_lat: number | null;
  shipping_lng: number | null;
}

interface EditOrderAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onSuccess: () => void;
}

export function EditOrderAddressDialog({
  open,
  onOpenChange,
  order,
  onSuccess,
}: EditOrderAddressDialogProps) {
  const queryClient = useQueryClient();
  
  const [address, setAddress] = useState(order.shipping_address || '');
  const [city, setCity] = useState(order.shipping_city || '');
  const [province, setProvince] = useState(order.shipping_province || '');
  const [postalCode, setPostalCode] = useState(order.shipping_postal_code || '');
  const [phone, setPhone] = useState(order.buyer_phone || '');
  const [lat, setLat] = useState<number | null>(order.shipping_lat);
  const [lng, setLng] = useState<number | null>(order.shipping_lng);

  // Reset form when order changes
  useEffect(() => {
    setAddress(order.shipping_address || '');
    setCity(order.shipping_city || '');
    setProvince(order.shipping_province || '');
    setPostalCode(order.shipping_postal_code || '');
    setPhone(order.buyer_phone || '');
    setLat(order.shipping_lat);
    setLng(order.shipping_lng);
  }, [order]);

  const handleAddressSelect = (details: AddressDetails) => {
    setAddress(details.address || details.formattedAddress);
    setCity(details.city);
    setProvince(details.province);
    setPostalCode(details.postalCode);
    setLat(details.lat);
    setLng(details.lng);
  };

  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      if (!address.trim()) {
        throw new Error('La dirección es requerida');
      }

      const { error } = await supabase
        .from('ecommerce_orders')
        .update({
          shipping_address: address.trim(),
          shipping_city: city || null,
          shipping_province: province || null,
          shipping_postal_code: postalCode || null,
          shipping_lat: lat,
          shipping_lng: lng,
          buyer_phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Pedido actualizado',
        description: 'La dirección se guardó correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['ecommerce-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-envio-check', order.id] });
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error al actualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrderMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Pedido</DialogTitle>
          <DialogDescription>
            #{order.external_order_number || order.external_order_id} - {order.buyer_name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <GoogleMapsProvider>
            <AddressAutocomplete
              label="Dirección de Entrega"
              value={address}
              onChange={setAddress}
              onSelect={handleAddressSelect}
              placeholder="Buscar dirección..."
              required
            />
          </GoogleMapsProvider>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ciudad"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="province">Provincia</Label>
              <Input
                id="province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="Provincia"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postalCode">Código Postal</Label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="CP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 11 1234-5678"
              />
            </div>
          </div>

          {lat && lng && (
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-300">
              ✓ Coordenadas capturadas: {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateOrderMutation.isPending || !address.trim()}>
              {updateOrderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
