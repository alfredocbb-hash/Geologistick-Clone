import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSellerData } from '@/hooks/useSellerData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Eye, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const FULFILLMENT_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: 'Procesando', className: 'bg-blue-100 text-blue-800' },
  shipped: { label: 'Enviado', className: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'Entregado', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
};

const PAYMENT_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Pagado', className: 'bg-green-100 text-green-800' },
  refunded: { label: 'Reembolsado', className: 'bg-red-100 text-red-800' },
};

export default function SellerOrders() {
  const { seller, isLoading: sellerLoading } = useSellerData();
  const [search, setSearch] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('all');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['seller-orders', seller?.id],
    queryFn: async () => {
      if (!seller?.id) return [];
      
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select('*')
        .eq('seller_id', seller.id)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    enabled: !!seller?.id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch = 
      order.buyer_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.external_order_number?.toLowerCase().includes(search.toLowerCase()) ||
      order.buyer_email?.toLowerCase().includes(search.toLowerCase());
    
    const matchesFulfillment = fulfillmentFilter === 'all' || order.fulfillment_status === fulfillmentFilter;
    
    return matchesSearch && matchesFulfillment;
  });

  if (sellerLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Pedidos</h1>
        <p className="text-muted-foreground">
          Pedidos recibidos en tu tienda
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div>
              <CardTitle>Listado de Pedidos</CardTitle>
              <CardDescription>
                {filteredOrders?.length || 0} pedidos encontrados
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              
              <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="processing">Procesando</SelectItem>
                  <SelectItem value="shipped">Enviado</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredOrders && filteredOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        #{order.external_order_number || order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.buyer_name}</p>
                          <p className="text-xs text-muted-foreground">{order.buyer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(order.total)}</TableCell>
                      <TableCell>
                        <Badge className={FULFILLMENT_CONFIG[order.fulfillment_status || 'pending']?.className}>
                          {FULFILLMENT_CONFIG[order.fulfillment_status || 'pending']?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={PAYMENT_CONFIG[order.payment_status || 'pending']?.className}>
                          {PAYMENT_CONFIG[order.payment_status || 'pending']?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.created_at), 'dd/MM/yy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.envio_id && (
                            <Button variant="ghost" size="icon">
                              <Package className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay pedidos que mostrar</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
