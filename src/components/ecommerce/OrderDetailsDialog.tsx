import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, User, MapPin, Package, DollarSign, Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderItem {
  sku?: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  external_order_id: string;
  external_order_number: string | null;
  plataforma: string;
  order_status: string;
  fulfillment_status: string;
  buyer_name: string;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_dni: string | null;
  shipping_address: string;
  shipping_city: string | null;
  shipping_province: string | null;
  shipping_postal_code: string | null;
  shipping_notes: string | null;
  items: OrderItem[] | null;
  subtotal: number;
  shipping_cost: number;
  total: number;
  envio_id: string | null;
  created_at: string;
  seller?: {
    nombre: string;
  };
}

interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-yellow-500/10 text-yellow-600' },
  paid: { label: 'Pagado', className: 'bg-green-500/10 text-green-600' },
  shipped: { label: 'Enviado', className: 'bg-blue-500/10 text-blue-600' },
  delivered: { label: 'Entregado', className: 'bg-purple-500/10 text-purple-600' },
  cancelled: { label: 'Cancelado', className: 'bg-red-500/10 text-red-600' },
};

const FULFILLMENT_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Sin Preparar', className: 'bg-gray-500/10 text-gray-600' },
  processing: { label: 'En Preparación', className: 'bg-yellow-500/10 text-yellow-600' },
  shipped: { label: 'Enviado', className: 'bg-blue-500/10 text-blue-600' },
  delivered: { label: 'Entregado', className: 'bg-green-500/10 text-green-600' },
};

export function OrderDetailsDialog({ open, onOpenChange, order }: OrderDetailsDialogProps) {
  const status = STATUS_LABELS[order.order_status] || STATUS_LABELS.pending;
  const fulfillment = FULFILLMENT_LABELS[order.fulfillment_status] || FULFILLMENT_LABELS.pending;
  const items = order.items as OrderItem[] || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Pedido #{order.external_order_number || order.external_order_id}
          </DialogTitle>
          <DialogDescription>
            {order.seller?.nombre} • {format(new Date(order.created_at), "dd 'de' MMMM, yyyy HH:mm", { locale: es })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
            <Badge variant="outline" className={fulfillment.className}>
              {fulfillment.label}
            </Badge>
            <Badge variant="outline">
              {order.plataforma}
            </Badge>
            {order.envio_id && (
              <Badge variant="default">Envío Creado</Badge>
            )}
          </div>

          {/* Buyer Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Comprador
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{order.buyer_name}</p>
              {order.buyer_email && <p className="text-muted-foreground">{order.buyer_email}</p>}
              {order.buyer_phone && <p className="text-muted-foreground">{order.buyer_phone}</p>}
              {order.buyer_dni && <p className="text-muted-foreground">DNI: {order.buyer_dni}</p>}
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Dirección de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>{order.shipping_address}</p>
              <p className="text-muted-foreground">
                {[order.shipping_city, order.shipping_province, order.shipping_postal_code]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {order.shipping_notes && (
                <p className="text-muted-foreground italic">Nota: {order.shipping_notes}</p>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          {items.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Productos ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{item.quantity} x ${item.price?.toLocaleString()}</p>
                        <p className="text-sm font-medium">${(item.quantity * item.price)?.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Totals */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${order.subtotal?.toLocaleString() || '0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Envío</span>
                  <span>${order.shipping_cost?.toLocaleString() || '0'}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>${order.total?.toLocaleString() || '0'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
            </div>
            <div className="flex items-center gap-1">
              <ExternalLink className="h-4 w-4" />
              <span>ID: {order.external_order_id}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
