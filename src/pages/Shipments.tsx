import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, PackagePlus, Search, Filter, RefreshCw, Truck, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type ShipmentStatus = Database['public']['Enums']['shipment_status'];

const statusConfig: Record<ShipmentStatus, { label: string; color: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500', icon: Clock },
  recogido: { label: 'Recogido', color: 'bg-blue-500', icon: Package },
  en_bodega: { label: 'En Bodega', color: 'bg-purple-500', icon: Package },
  en_transito: { label: 'En Tránsito', color: 'bg-blue-600', icon: Truck },
  en_reparto: { label: 'En Reparto', color: 'bg-orange-500', icon: Truck },
  entregado: { label: 'Entregado', color: 'bg-green-500', icon: CheckCircle },
  devuelto: { label: 'Devuelto', color: 'bg-red-500', icon: AlertCircle },
  cancelado: { label: 'Cancelado', color: 'bg-gray-500', icon: AlertCircle },
};

export default function Shipments() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: envios, isLoading, refetch } = useQuery({
    queryKey: ['envios', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('envios')
        .select(`
          *,
          sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(nombre),
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre),
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('estado', statusFilter as ShipmentStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['envios-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('envios')
        .select('estado');
      
      if (error) throw error;

      const counts = {
        total: data.length,
        pendiente: data.filter(e => e.estado === 'pendiente').length,
        en_transito: data.filter(e => ['en_transito', 'en_reparto', 'recogido'].includes(e.estado || '')).length,
        entregado: data.filter(e => e.estado === 'entregado').length,
        problemas: data.filter(e => ['devuelto', 'cancelado'].includes(e.estado || '')).length,
      };

      return counts;
    },
  });

  const filteredEnvios = envios?.filter(envio => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      envio.tracking_number?.toLowerCase().includes(searchLower) ||
      envio.remitente?.nombre?.toLowerCase().includes(searchLower) ||
      envio.destinatario?.nombre?.toLowerCase().includes(searchLower)
    );
  });

  const StatusBadge = ({ status }: { status: ShipmentStatus }) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Package className="h-8 w-8 text-shipments" />
            Gestión de Envíos
          </h1>
          <p className="text-muted-foreground mt-1">
            Administra todos los envíos del sistema
          </p>
        </div>
        <Button asChild className="gradient-primary">
          <Link to="/shipments/new">
            <PackagePlus className="mr-2 h-4 w-4" />
            Nuevo Envío
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card className="card-hover border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pendiente || 0}</div>
          </CardContent>
        </Card>
        <Card className="card-hover border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">En Tránsito</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.en_transito || 0}</div>
          </CardContent>
        </Card>
        <Card className="card-hover border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entregados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.entregado || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por tracking, remitente o destinatario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredEnvios && filteredEnvios.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Remitente</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEnvios.map((envio) => (
                  <TableRow key={envio.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-mono font-medium text-primary">
                      {envio.tracking_number}
                    </TableCell>
                    <TableCell>
                      {envio.remitente ? `${envio.remitente.nombre} ${envio.remitente.apellido || ''}` : '-'}
                    </TableCell>
                    <TableCell>
                      {envio.destinatario ? `${envio.destinatario.nombre} ${envio.destinatario.apellido || ''}` : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {envio.sucursal_origen?.nombre || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {envio.sucursal_destino?.nombre || '-'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={envio.estado as ShipmentStatus} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${envio.precio_total?.toLocaleString('es-AR')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {envio.created_at ? format(new Date(envio.created_at), 'dd MMM yyyy', { locale: es }) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">No hay envíos</h3>
              <p className="text-muted-foreground">Crea tu primer envío para comenzar</p>
              <Button asChild className="mt-4">
                <Link to="/shipments/new">
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Crear Envío
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
