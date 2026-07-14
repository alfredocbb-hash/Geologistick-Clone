import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MapPin, User, Package, DollarSign, Printer, CheckCircle, XCircle, AlertTriangle, Edit } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { EditOrderAddressDialog } from './EditOrderAddressDialog';

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
  envio_id?: string | null;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [precio, setPrecio] = useState<number>(0);
  const [sucursalOrigenId, setSucursalOrigenId] = useState<string>('');
  const [cantidadBultos, setCantidadBultos] = useState<number>(1);
  const [createdEnvio, setCreatedEnvio] = useState<any>(null);
  const [showEditAddress, setShowEditAddress] = useState(false);

  // Check if order already has a shipment and get fresh address data
  const { data: orderStatus, isLoading: checkingOrder, refetch: refetchOrderStatus } = useQuery({
    queryKey: ['order-envio-check', order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select('envio_id, shipping_address, shipping_lat, shipping_lng')
        .eq('id', order.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const alreadyHasShipment = !!orderStatus?.envio_id;
  const hasValidAddress = !!(orderStatus?.shipping_address?.trim());

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
    enabled: open && !alreadyHasShipment,
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
    enabled: !!tenantId && open && !alreadyHasShipment,
  });

  // Fetch exclusive seller tarifas first, fallback to seller.tarifa_id
  const { data: sellerTarifas } = useQuery({
    queryKey: ['seller-exclusive-tarifas', seller?.id],
    queryFn: async () => {
      if (!seller?.id) return [];
      const { data, error } = await supabase
        .from('tarifas')
        .select('id, nombre, precio_base, zona_destino, tipo_tarifa')
        .eq('seller_exclusivo_id', seller.id)
        .eq('activa', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!seller?.id && open && !alreadyHasShipment,
  });

  // Determine which tarifa to use based on zone matching (CABA-aware por CP)
  const matchedTarifaId = (() => {
    if (!sellerTarifas?.length) return seller?.tarifa_id || null;
    
    const ciudad = order.shipping_city || '';
    const provincia = (order.shipping_province || '').toLowerCase().trim();
    const cp = order.shipping_postal_code || '';
    
    // Try to match by city in zona_destino
    for (const t of sellerTarifas) {
      if (!t.zona_destino) continue;
      const destinos = t.zona_destino.split(',').map((d: string) => d.trim());
      if (destinos.some(d => ciudadMatchPartial(d, ciudad, cp))) return t.id;
    }
    // Try province match
    for (const t of sellerTarifas) {
      if (!t.zona_destino) continue;
      const destinos = t.zona_destino.split(',').map((d: string) => d.trim().toLowerCase());
      if (destinos.some(d => provincia.includes(d) || d.includes(provincia))) return t.id;
    }
    // Fallback to first exclusive tarifa or seller.tarifa_id
    return sellerTarifas[0]?.id || seller?.tarifa_id || null;
  })();

  // Fetch tarifa and calculate price
  const { data: tarifaData } = useQuery({
    queryKey: ['tarifa-precios', matchedTarifaId],
    queryFn: async () => {
      if (!matchedTarifaId) return null;
      
      const { data: tarifa, error: tarifaError } = await supabase
        .from('tarifas')
        .select('id, nombre, precio_base')
        .eq('id', matchedTarifaId)
        .single();
      
      if (tarifaError) throw tarifaError;
      
      const { data: conceptos, error: conceptosError } = await supabase
        .from('tarifa_concepto_precios')
        .select(`
          monto,
          concepto:tarifa_conceptos(codigo, nombre, es_basico)
        `)
        .eq('tarifa_id', matchedTarifaId);
      
      if (conceptosError) throw conceptosError;
      
      return { tarifa, conceptos };
    },
    enabled: !!matchedTarifaId && open && !alreadyHasShipment,
  });

  // Set default origin branch from seller
  useEffect(() => {
    if (seller?.sucursal_pickup_id && !sucursalOrigenId) {
      setSucursalOrigenId(seller.sucursal_pickup_id);
    }
  }, [seller?.sucursal_pickup_id]);

  // Auto-calculate price from tarifa
  useEffect(() => {
    if (tarifaData?.tarifa && precio === 0) {
      let precioCalculado = Number(tarifaData.tarifa.precio_base) || 0;
      
      // Add basic concepts (like "entrega")
      const conceptosBasicos = tarifaData.conceptos?.filter(
        (cp: any) => cp.concepto?.es_basico
      ) || [];
      
      conceptosBasicos.forEach((cp: any) => {
        precioCalculado += Number(cp.monto) || 0;
      });
      
      setPrecio(precioCalculado);
    }
  }, [tarifaData]);

  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      if (!sucursalOrigenId) throw new Error('Selecciona sucursal de origen');
      if (!precio) throw new Error('Ingresa el precio del envío');

      // Double-check: verify order doesn't already have a shipment (prevent race condition)
      const { data: currentOrder } = await supabase
        .from('ecommerce_orders')
        .select('envio_id')
        .eq('id', order.id)
        .single();

      if (currentOrder?.envio_id) {
        throw new Error('Este pedido ya tiene un envío creado');
      }

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
          precio_tarifa_vigente: precio,
          tipo_pago: seller?.tiene_cuenta_corriente ? 'cuenta_corriente' : 'contado',
          tipo_servicio: 'envio_completo',
          tipo_servicio_detalle: 'domicilio_domicilio',
          estado: 'pendiente',
          codigo_orden_externo: order.external_order_number || order.external_order_id,
          fecha_entrega: (order as any).fecha_entrega_estimada || null,
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
      setCreatedEnvio(envio);
      toast({ 
        title: 'Envío creado correctamente',
        description: `Tracking: ${envio.tracking_number}`,
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error al crear envío', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const handleClose = () => {
    const wasCreated = !!createdEnvio;
    setCreatedEnvio(null);
    onOpenChange(false);
    if (wasCreated) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {checkingOrder ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : alreadyHasShipment ? (
          <>
            <DialogHeader>
              <DialogTitle>Envío Ya Existe</DialogTitle>
            </DialogHeader>
            <div className="text-center py-6 space-y-4">
              <div className="flex justify-center">
                <XCircle className="h-16 w-16 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Este pedido ya tiene un envío asociado</h3>
                <p className="text-muted-foreground mt-1">
                  No es posible crear otro envío para este pedido.
                </p>
              </div>
              <Button onClick={handleClose} className="mt-4">
                Cerrar
              </Button>
            </div>
          </>
        ) : !hasValidAddress ? (
          <>
            <DialogHeader>
              <DialogTitle>Dirección Requerida</DialogTitle>
              <DialogDescription>
                Pedido #{order.external_order_number || order.external_order_id}
              </DialogDescription>
            </DialogHeader>
            <div className="text-center py-6 space-y-4">
              <div className="flex justify-center">
                <AlertTriangle className="h-16 w-16 text-yellow-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Este pedido no tiene dirección de entrega</h3>
                <p className="text-muted-foreground mt-1">
                  Debes agregar una dirección antes de crear el envío.
                </p>
              </div>
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={() => setShowEditAddress(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Agregar Dirección
                </Button>
              </div>
            </div>
            <EditOrderAddressDialog
              open={showEditAddress}
              onOpenChange={setShowEditAddress}
              order={order}
              onSuccess={() => {
                refetchOrderStatus();
                queryClient.invalidateQueries({ queryKey: ['ecommerce-orders'] });
              }}
            />
          </>
        ) : createdEnvio ? (
          <>
            <DialogHeader>
              <DialogTitle>Envío Creado Exitosamente</DialogTitle>
            </DialogHeader>
            <div className="text-center py-6 space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">¡Listo!</h3>
                <p className="text-muted-foreground font-mono text-lg mt-1">
                  {createdEnvio.tracking_number}
                </p>
              </div>
              <div className="flex gap-2 justify-center pt-4">
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                >
                  Cerrar
                </Button>
                <Button 
                  onClick={() => navigate(`/print-label?id=${createdEnvio.id}`)}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Etiqueta
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
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

            {tarifaData?.tarifa && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                  Tarifa: {tarifaData.tarifa.nombre}
                </p>
                <div className="text-blue-600 dark:text-blue-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Flete base:</span>
                    <span>${Number(tarifaData.tarifa.precio_base || 0).toLocaleString()}</span>
                  </div>
                  {tarifaData.conceptos?.filter((c: any) => c.concepto?.es_basico).map((cp: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>{cp.concepto?.nombre}:</span>
                      <span>${Number(cp.monto || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              <Button type="button" variant="outline" onClick={handleClose}>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
