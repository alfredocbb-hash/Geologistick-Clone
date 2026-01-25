import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MapPin, User, Package, DollarSign } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Order {
  id: string;
  external_order_id: string;
  external_order_number: string | null;
  seller_id: string;
  buyer_name: string;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_dni: string | null;
  shipping_address: string;
  shipping_city: string | null;
  shipping_province: string | null;
  shipping_postal_code: string | null;
  shipping_lat: number | null;
  shipping_lng: number | null;
  total: number;
  seller?: {
    id: string;
    nombre: string;
    tarifa_id: string | null;
    sucursal_pickup_id: string | null;
    tiene_cuenta_corriente: boolean;
  };
}

interface CreateShipmentFromOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onSuccess: () => void;
}

export function CreateShipmentFromOrderDialog({ 
  open, 
  onOpenChange, 
  order, 
  onSuccess 
}: CreateShipmentFromOrderDialogProps) {
  const { tenantId } = useTenant();
  const [precio, setPrecio] = useState<number>(0);
  const [sucursalOrigenId, setSucursalOrigenId] = useState<string>('');
  const [cantidadBultos, setCantidadBultos] = useState<number>(1);

  // Fetch seller details
  const { data: seller } = useQuery({
    queryKey: ['seller-details', order.seller_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_sellers')
        .select('id, nombre, tarifa_id, sucursal_pickup_id, tiene_cuenta_corriente, saldo_cuenta_corriente')
        .eq('id', order.seller_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch sucursales
  const { data: sucursales } = useQuery({
    queryKey: ['sucursales-active', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && open,
  });

  // Set default origin branch from seller
  useState(() => {
    if (seller?.sucursal_pickup_id) {
      setSucursalOrigenId(seller.sucursal_pickup_id);
    }
  });

  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      if (!sucursalOrigenId) throw new Error('Selecciona sucursal de origen');
      if (!precio) throw new Error('Ingresa el precio del envío');

      // Get origin branch code for tracking
      const { data: originBranch } = await supabase
        .from('sucursales')
        .select('codigo')
        .eq('id', sucursalOrigenId)
        .single();

      // Generate tracking number
      const { data: trackingData, error: trackingError } = await supabase
        .rpc('generate_tracking_number', { p_sucursal_id: sucursalOrigenId });
      
      if (trackingError) throw trackingError;

      // Create the shipment
      const { data: envio, error: envioError } = await supabase
        .from('envios')
        .insert({
          tenant_id: tenantId,
          tracking_number: trackingData,
          sucursal_origen_id: sucursalOrigenId,
          nombre_remitente: seller?.nombre || 'Seller',
          nombre_destinatario: order.buyer_name,
          direccion_entrega: order.shipping_address,
          ciudad_entrega: order.shipping_city,
          cp_entrega: order.shipping_postal_code,
          provincia: order.shipping_province,
          destinatario_lat: order.shipping_lat,
          destinatario_lng: order.shipping_lng,
          whatsapp_destinatario: order.buyer_phone,
          dni_destinatario: order.buyer_dni,
          cantidad_bultos: cantidadBultos,
          precio_total: precio,
          tipo_pago: seller?.tiene_cuenta_corriente ? 'cuenta_corriente' : 'contado',
          tipo_servicio: 'envio_completo',
          tipo_servicio_detalle: 'domicilio_domicilio',
          estado: 'pendiente',
          codigo_orden_externo: order.external_order_number || order.external_order_id,
        })
        .select()
        .single();

      if (envioError) throw envioError;

      // Update order with envio_id
      const { error: updateOrderError } = await supabase
        .from('ecommerce_orders')
        .update({ 
          envio_id: envio.id,
          fulfillment_status: 'processing',
        })
        .eq('id', order.id);

      if (updateOrderError) throw updateOrderError;

      // If seller has cuenta corriente, register the charge
      if (seller?.tiene_cuenta_corriente) {
        const saldoAnterior = seller.saldo_cuenta_corriente || 0;
        const saldoNuevo = saldoAnterior + precio;

        const { error: ctaCteError } = await supabase
          .from('seller_cuenta_corriente')
          .insert({
            seller_id: seller.id,
            tipo: 'cargo',
            monto: precio,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: saldoNuevo,
            descripcion: `Envío ${trackingData}`,
            envio_id: envio.id,
            order_id: order.id,
          });

        if (ctaCteError) throw ctaCteError;
      }

      return envio;
    },
    onSuccess: (envio) => {
      toast({ 
        title: 'Envío creado correctamente',
        description: `Tracking: ${envio.tracking_number}`,
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error al crear envío', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear Envío desde Pedido</DialogTitle>
          <DialogDescription>
            Pedido #{order.external_order_number || order.external_order_id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resumen del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{order.buyer_name}</p>
                  {order.buyer_phone && <p className="text-muted-foreground">{order.buyer_phone}</p>}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p>{order.shipping_address}</p>
                  <p className="text-muted-foreground">
                    {[order.shipping_city, order.shipping_province, order.shipping_postal_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p>Total pedido: <span className="font-medium">${order.total?.toLocaleString()}</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Shipment Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sucursal de Origen *</Label>
              <Select value={sucursalOrigenId} onValueChange={setSucursalOrigenId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {sucursales?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad de Bultos</Label>
                <Input
                  type="number"
                  min={1}
                  value={cantidadBultos}
                  onChange={(e) => setCantidadBultos(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Precio del Envío *</Label>
                <Input
                  type="number"
                  min={0}
                  value={precio}
                  onChange={(e) => setPrecio(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {seller?.tiene_cuenta_corriente && (
              <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-3 text-sm">
                <p className="text-purple-700 dark:text-purple-300">
                  <strong>Cuenta Corriente:</strong> Se registrará un cargo de ${precio.toLocaleString()} al seller
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => createShipmentMutation.mutate()} 
            disabled={createShipmentMutation.isPending || !sucursalOrigenId || !precio}
          >
            {createShipmentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Envío
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
