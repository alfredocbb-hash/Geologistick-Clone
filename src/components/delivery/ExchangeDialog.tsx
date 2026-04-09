import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeftRight, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';

interface ExchangeDialogProps {
  open: boolean;
  onClose: () => void;
  shipment: {
    id: string;
    tracking_number: string;
    direccion_entrega: string | null;
    ciudad_entrega: string | null;
    nombre_destinatario: string | null;
    direccion_retiro?: string | null;
    ciudad_retiro?: string | null;
    nombre_remitente?: string | null;
    sucursal_origen_id?: string | null;
    ml_shipment_id?: number | null;
    tenant_id?: string | null;
    remitente_id?: string | null;
    destinatario_id?: string | null;
  };
}

export default function ExchangeDialog({ open, onClose, shipment }: ExchangeDialogProps) {
  const { user, profile } = useAuth();
  const [wantsExchange, setWantsExchange] = useState<boolean | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNoExchange = () => {
    onClose();
  };

  const handleConfirmExchange = async () => {
    if (!user?.id) return;
    setIsSubmitting(true);

    try {
      const tenantId = shipment.tenant_id || (profile as any)?.tenant_id;
      
      // Determine destination based on ML or manual
      let destinoDir = '';
      let destinoCiudad = '';
      let destinoNombre = '';
      let sucursalDestinoId: string | null = null;

      if (shipment.ml_shipment_id) {
        // ML shipment: find seller address
        const { data: order } = await supabase
          .from('ecommerce_orders')
          .select('seller_id')
          .eq('envio_id', shipment.id)
          .maybeSingle();

        if (order?.seller_id) {
          const { data: seller } = await supabase
            .from('ecommerce_sellers')
            .select('nombre, direccion, ciudad, sucursal_pickup_id')
            .eq('id', order.seller_id)
            .maybeSingle();

          if (seller) {
            destinoDir = seller.direccion || '';
            destinoCiudad = seller.ciudad || '';
            destinoNombre = seller.nombre || '';
            sucursalDestinoId = seller.sucursal_pickup_id || null;
          }
        }
      }

      // Manual or fallback: use remitente/origin
      if (!destinoDir) {
        destinoDir = shipment.direccion_retiro || '';
        destinoCiudad = shipment.ciudad_retiro || '';
        destinoNombre = shipment.nombre_remitente || '';
        sucursalDestinoId = shipment.sucursal_origen_id || null;
      }

      // Generate tracking number
      const { data: trackingData } = await supabase.rpc('generate_tracking_number');
      const tracking = trackingData || `ENV-CHG-${Date.now()}`;

      // Create reverse shipment
      const { error: insertError } = await supabase
        .from('envios')
        .insert({
          tracking_number: tracking,
          estado: 'recogido' as any,
          es_cambio: true,
          envio_cambio_id: shipment.id,
          chofer_id: user.id,
          tenant_id: tenantId,
          // Origin = where delivery was made (current recipient address)
          direccion_retiro: shipment.direccion_entrega,
          ciudad_retiro: shipment.ciudad_entrega,
          nombre_remitente: shipment.nombre_destinatario,
          remitente_id: shipment.destinatario_id || null,
          // Destination = seller or original sender
          direccion_entrega: destinoDir,
          ciudad_entrega: destinoCiudad,
          nombre_destinatario: destinoNombre,
          destinatario_id: shipment.remitente_id || null,
          sucursal_origen_id: (profile as any)?.sucursal_id || null,
          sucursal_destino_id: sucursalDestinoId,
          descripcion: description || `Cambio del envío ${shipment.tracking_number}`,
          notas: `Paquete de cambio retirado al entregar ${shipment.tracking_number}`,
          precio_total: 0,
          fecha_recogida: new Date().toISOString(),
          source_module: 'cambio',
        });

      if (insertError) throw insertError;

      toast.success('Cambio registrado', {
        description: `Envío inverso ${tracking} creado como recogido`,
      });
      onClose();
    } catch (error: any) {
      console.error('Error creating exchange shipment:', error);
      toast.error('Error al registrar cambio', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Cambio de paquete
          </DialogTitle>
          <DialogDescription>
            ¿El destinatario devuelve un paquete?
          </DialogDescription>
        </DialogHeader>

        {wantsExchange === null ? (
          <div className="flex flex-col gap-3 py-4">
            <Button
              variant="outline"
              className="h-16 text-lg"
              onClick={() => setWantsExchange(true)}
            >
              <Package className="h-5 w-5 mr-2" />
              Sí, hay un cambio
            </Button>
            <Button
              variant="ghost"
              className="h-12"
              onClick={handleNoExchange}
            >
              No, solo entrega
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label>Descripción del paquete devuelto</Label>
              <Textarea
                placeholder="Ej: Caja con producto para cambio de talle"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
              <p className="font-medium mb-1">Se creará un envío inverso:</p>
              <p>📍 Desde: {shipment.direccion_entrega || 'Dirección de entrega'}</p>
              <p>📦 Hacia: {shipment.ml_shipment_id ? 'Seller (ML)' : (shipment.nombre_remitente || 'Remitente original')}</p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setWantsExchange(null)}>
                Volver
              </Button>
              <Button onClick={handleConfirmExchange} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar cambio
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
