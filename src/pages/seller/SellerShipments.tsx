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
import { Search, Eye, MapPin, Truck, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  retirado: { label: 'Retirado', color: 'bg-blue-100 text-blue-800' },
  en_transito: { label: 'En Tránsito', color: 'bg-indigo-100 text-indigo-800' },
  en_sucursal: { label: 'En Sucursal', color: 'bg-cyan-100 text-cyan-800' },
  en_reparto: { label: 'En Reparto', color: 'bg-purple-100 text-purple-800' },
  entregado: { label: 'Entregado', color: 'bg-green-100 text-green-800' },
  devuelto: { label: 'Devuelto', color: 'bg-red-100 text-red-800' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' },
};

export default function SellerShipments() {
  const { seller, isLoading: sellerLoading } = useSellerData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: shipments, isLoading } = useQuery({
    queryKey: ['seller-shipments', seller?.id],
    queryFn: async () => {
      if (!seller?.id) return [];
      
      // First get envio_ids from ecommerce_orders linked to this seller
      const { data: orders, error: ordersError } = await supabase
        .from('ecommerce_orders')
        .select('envio_id')
        .eq('seller_id', seller.id)
        .not('envio_id', 'is', null);
      
      if (ordersError) throw ordersError;
      
      const envioIds = orders?.map(o => o.envio_id).filter(Boolean) as string[];
      
      if (envioIds.length === 0) return [];
      
      // Now fetch only the shipments linked to this seller's orders
      const { data, error } = await supabase
        .from('envios')
        .select(`
          id,
          tracking_number,
          nombre_destinatario,
          direccion_entrega,
          ciudad_entrega,
          estado,
          precio_total,
          created_at,
          fecha_entrega
        `)
        .in('id', envioIds)
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

  const filteredShipments = shipments?.filter((shipment) => {
    const matchesSearch = 
      shipment.tracking_number?.toLowerCase().includes(search.toLowerCase()) ||
      shipment.nombre_destinatario?.toLowerCase().includes(search.toLowerCase()) ||
      shipment.ciudad_entrega?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || shipment.estado === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (sellerLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Envíos</h1>
        <p className="text-muted-foreground">
          Seguimiento de tus envíos logísticos
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div>
              <CardTitle>Listado de Envíos</CardTitle>
              <CardDescription>
                {filteredShipments?.length || 0} envíos encontrados
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tracking o destino..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_transito">En Tránsito</SelectItem>
                  <SelectItem value="en_reparto">En Reparto</SelectItem>
                  <SelectItem value="entregado">Entregado</SelectItem>
                  <SelectItem value="devuelto">Devuelto</SelectItem>
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
          ) : filteredShipments && filteredShipments.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShipments.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell className="font-mono text-sm">
                        {shipment.tracking_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {shipment.nombre_destinatario}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{shipment.ciudad_entrega}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_CONFIG[shipment.estado || 'pendiente']?.color}>
                          {STATUS_CONFIG[shipment.estado || 'pendiente']?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(shipment.precio_total)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {format(new Date(shipment.created_at), 'dd/MM/yy', { locale: es })}
                          </p>
                          {shipment.fecha_entrega && (
                            <p className="text-xs text-muted-foreground">
                              Entregado: {format(new Date(shipment.fecha_entrega), 'dd/MM', { locale: es })}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Ver detalle">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Rastrear">
                            <Truck className="h-4 w-4" />
                          </Button>
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
              <p>No hay envíos que mostrar</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
