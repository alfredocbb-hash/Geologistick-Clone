import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Package, Search, MapPin, Clock, CheckCircle, Truck, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type ShipmentStatus = Database['public']['Enums']['shipment_status'];

const statusConfig: Record<ShipmentStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock },
  recogido: { label: 'Recogido', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Package },
  en_bodega: { label: 'En Bodega', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Package },
  en_transito: { label: 'En Tránsito', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Truck },
  en_reparto: { label: 'En Reparto', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: Truck },
  entregado: { label: 'Entregado', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle },
  devuelto: { label: 'Devuelto', color: 'text-red-600', bgColor: 'bg-red-100', icon: AlertCircle },
  cancelado: { label: 'Cancelado', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: AlertCircle },
};

const statusOrder: ShipmentStatus[] = ['pendiente', 'recogido', 'en_bodega', 'en_transito', 'en_reparto', 'entregado'];

export default function Tracking() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [searchedTracking, setSearchedTracking] = useState('');

  const { data: envio, isLoading, error } = useQuery({
    queryKey: ['tracking', searchedTracking],
    queryFn: async () => {
      if (!searchedTracking) return null;
      
      const { data, error } = await supabase
        .from('envios')
        .select(`
          *,
          sucursal_origen:sucursales!envios_sucursal_origen_id_fkey(nombre, direccion),
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre, direccion),
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, ciudad),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, ciudad, direccion)
        `)
        .eq('tracking_number', searchedTracking)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!searchedTracking,
  });

  const { data: historial } = useQuery({
    queryKey: ['tracking-historial', envio?.id],
    queryFn: async () => {
      if (!envio?.id) return [];
      
      const { data, error } = await supabase
        .from('envio_historial')
        .select('*')
        .eq('envio_id', envio.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!envio?.id,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchedTracking(trackingNumber.trim().toUpperCase());
  };

  const getStatusIndex = (status: ShipmentStatus) => {
    return statusOrder.indexOf(status);
  };

  const currentStatusIndex = envio?.estado ? getStatusIndex(envio.estado as ShipmentStatus) : -1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-colored">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Rastrea tu Envío</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Ingresa tu número de tracking para conocer el estado de tu paquete
          </p>
        </div>

        {/* Search Form */}
        <Card className="shadow-xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Ej: ENV-20240115-A1B2C3"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="pl-11 h-12 text-lg"
                />
              </div>
              <Button type="submit" size="lg" className="gradient-primary px-8">
                Buscar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Buscando envío...</p>
            </CardContent>
          </Card>
        )}

        {/* Not Found */}
        {searchedTracking && !isLoading && !envio && (
          <Card className="border-destructive/50">
            <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="text-lg font-semibold">Envío no encontrado</h3>
                <p className="text-muted-foreground">
                  No encontramos un envío con el tracking: <span className="font-mono">{searchedTracking}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {envio && (
          <div className="space-y-6 animate-fade-in">
            {/* Status Card */}
            <Card className="overflow-hidden">
              <div className={`h-2 ${statusConfig[envio.estado as ShipmentStatus]?.bgColor?.replace('bg-', 'bg-') || 'bg-gray-100'}`} 
                   style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${((currentStatusIndex + 1) / statusOrder.length) * 100}%, hsl(var(--muted)) 0%)` }} 
              />
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-mono">{envio.tracking_number}</CardTitle>
                    <CardDescription className="mt-1">
                      {envio.descripcion || 'Paquete estándar'}
                    </CardDescription>
                  </div>
                  <Badge className={`${statusConfig[envio.estado as ShipmentStatus]?.bgColor} ${statusConfig[envio.estado as ShipmentStatus]?.color} text-sm px-4 py-1.5`}>
                    {(() => {
                      const Icon = statusConfig[envio.estado as ShipmentStatus]?.icon;
                      return Icon ? <Icon className="mr-2 h-4 w-4" /> : null;
                    })()}
                    {statusConfig[envio.estado as ShipmentStatus]?.label || envio.estado}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Progress Steps */}
                <div className="relative mt-4">
                  <div className="flex justify-between relative z-10">
                    {statusOrder.map((status, index) => {
                      const isCompleted = index <= currentStatusIndex;
                      const isCurrent = index === currentStatusIndex;
                      const config = statusConfig[status];
                      const Icon = config.icon;
                      
                      return (
                        <div key={status} className="flex flex-col items-center">
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center transition-all
                            ${isCompleted ? 'gradient-primary text-white shadow-lg' : 'bg-muted text-muted-foreground'}
                            ${isCurrent ? 'ring-4 ring-primary/30 scale-110' : ''}
                          `}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className={`text-xs mt-2 text-center ${isCompleted ? 'font-medium' : 'text-muted-foreground'}`}>
                            {config.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Progress Line */}
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-0">
                    <div 
                      className="h-full gradient-primary transition-all duration-500"
                      style={{ width: `${(currentStatusIndex / (statusOrder.length - 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Details */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Origin */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Origen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-semibold">
                    {envio.remitente?.nombre} {envio.remitente?.apellido}
                  </p>
                  <p className="text-sm text-muted-foreground">{envio.remitente?.ciudad}</p>
                  {envio.sucursal_origen && (
                    <Badge variant="outline">{envio.sucursal_origen.nombre}</Badge>
                  )}
                </CardContent>
              </Card>

              {/* Destination */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Destino</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-semibold">
                    {envio.destinatario?.nombre} {envio.destinatario?.apellido}
                  </p>
                  <p className="text-sm text-muted-foreground">{envio.destinatario?.direccion}</p>
                  <p className="text-sm text-muted-foreground">{envio.destinatario?.ciudad}</p>
                </CardContent>
              </Card>
            </div>

            {/* History */}
            {historial && historial.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Historial de Movimientos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {historial.map((item, index) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                          {index < historial.length - 1 && <div className="w-0.5 h-full bg-muted" />}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {statusConfig[item.estado_nuevo as ShipmentStatus]?.label || item.estado_nuevo}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {item.created_at && format(new Date(item.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                            </span>
                          </div>
                          {item.notas && <p className="text-sm mt-1">{item.notas}</p>}
                          {item.ubicacion && <p className="text-xs text-muted-foreground">{item.ubicacion}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          © 2024 LogiTrack. Sistema de Gestión Logística.
        </p>
      </div>
    </div>
  );
}
