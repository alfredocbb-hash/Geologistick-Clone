import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Package, Search, MapPin, Clock, CheckCircle, Truck, AlertCircle, Loader2, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type ShipmentStatus = 'pendiente' | 'recogido' | 'en_sucursal' | 'en_transito' | 'en_reparto' | 'entregado' | 'devuelto' | 'cancelado' | 'primera_visita' | 'segunda_visita' | 'reprogramado';

interface TrackingResponse {
  tracking_number: string;
  estado: ShipmentStatus;
  estado_retiro: string;
  created_at: string;
  updated_at: string;
  fecha_entrega: string | null;
  origen: {
    ciudad: string | null;
    direccion: string | null;
    sucursal: string | null;
  };
  destino: {
    ciudad: string | null;
    direccion: string | null;
    sucursal: string | null;
  };
  detalles: {
    bultos: number | null;
    peso_kg: number | null;
    descripcion: string | null;
  };
  remitente: {
    nombre: string;
    ciudad: string | null;
  } | null;
  destinatario: {
    nombre: string;
    ciudad: string | null;
  } | null;
  branding: {
    nombre_app: string | null;
    logo: string | null;
    color_primario: string | null;
  } | null;
  // New fields for branch information
  sucursal_actual: string | null;
  entregado_en_sucursal: boolean;
  historial: Array<{
    id: string;
    estado_anterior: string | null;
    estado_nuevo: string;
    notas: string | null;
    ubicacion: string | null;
    fecha: string;
  }>;
  error?: string;
}

const statusConfig: Record<ShipmentStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pendiente: { label: 'Pendiente', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock },
  recogido: { label: 'Recogido', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Package },
  en_sucursal: { label: 'En Sucursal', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Package },
  en_transito: { label: 'En Tránsito', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Truck },
  en_reparto: { label: 'En Reparto', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: Truck },
  entregado: { label: 'Entregado', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle },
  devuelto: { label: 'Devuelto', color: 'text-red-600', bgColor: 'bg-red-100', icon: AlertCircle },
  cancelado: { label: 'Cancelado', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: AlertCircle },
  primera_visita: { label: '1a Visita', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: AlertCircle },
  segunda_visita: { label: '2a Visita', color: 'text-red-500', bgColor: 'bg-red-100', icon: AlertCircle },
  reprogramado: { label: 'Reprogramado', color: 'text-indigo-600', bgColor: 'bg-indigo-100', icon: CalendarClock },
};

const statusOrder: ShipmentStatus[] = ['pendiente', 'recogido', 'en_sucursal', 'en_transito', 'en_reparto', 'entregado'];

export default function Tracking() {
  const { code: codeFromPath } = useParams();
  const [searchParams] = useSearchParams();
  const codeFromQuery = searchParams.get('code');
  
  const [trackingNumber, setTrackingNumber] = useState('');
  const [searchedTracking, setSearchedTracking] = useState('');

  // Initialize search from URL path or query parameter
  useEffect(() => {
    const initialCode = codeFromPath || codeFromQuery;
    if (initialCode) {
      const normalizedCode = initialCode.toUpperCase();
      setTrackingNumber(normalizedCode);
      setSearchedTracking(normalizedCode);
    }
  }, [codeFromPath, codeFromQuery]);

  // Fetch tracking via Edge Function
  // Short codes (< 15 chars) are searched by suffix in the Edge Function
  const { data: envio, isLoading, error } = useQuery({
    queryKey: ['tracking', searchedTracking],
    queryFn: async (): Promise<TrackingResponse | null> => {
      if (!searchedTracking) return null;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-tracking?code=${encodeURIComponent(searchedTracking)}`
      );
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        return null;
      }
      
      return data;
    },
    enabled: !!searchedTracking,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchedTracking(trackingNumber.trim().toUpperCase());
  };

  const getStatusIndex = (status: ShipmentStatus) => {
    return statusOrder.indexOf(status);
  };

  const currentStatusIndex = envio?.estado ? getStatusIndex(envio.estado) : -1;

  // Dynamic branding styles
  const primaryColor = envio?.branding?.color_primario;
  const buttonStyle = primaryColor ? { backgroundColor: primaryColor, borderColor: primaryColor } : {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        {/* Header with dynamic branding */}
        <div className="text-center space-y-4">
          {envio?.branding?.logo ? (
            <img 
              src={envio.branding.logo} 
              alt={envio.branding.nombre_app || 'Logo'}
              className="h-16 mx-auto object-contain"
            />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-colored">
              <MapPin className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-4xl font-bold tracking-tight">
            {envio?.branding?.nombre_app || 'Rastrea tu Envío'}
          </h1>
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
              <Button 
                type="submit" 
                size="lg" 
                className="gradient-primary px-8"
                style={buttonStyle}
              >
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
              <div className={`h-2 ${statusConfig[envio.estado]?.bgColor?.replace('bg-', 'bg-') || 'bg-gray-100'}`} 
                   style={{ background: primaryColor 
                     ? `linear-gradient(to right, ${primaryColor} ${((currentStatusIndex + 1) / statusOrder.length) * 100}%, hsl(var(--muted)) 0%)`
                     : `linear-gradient(to right, hsl(var(--primary)) ${((currentStatusIndex + 1) / statusOrder.length) * 100}%, hsl(var(--muted)) 0%)` 
                   }} 
              />
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-mono">{envio.tracking_number}</CardTitle>
                    <CardDescription className="mt-1">
                      {envio.detalles?.descripcion || 'Paquete estándar'}
                    </CardDescription>
                  </div>
                  <Badge className={`${statusConfig[envio.estado]?.bgColor} ${statusConfig[envio.estado]?.color} text-sm px-4 py-1.5`}>
                    {(() => {
                      const Icon = statusConfig[envio.estado]?.icon;
                      return Icon ? <Icon className="mr-2 h-4 w-4" /> : null;
                    })()}
                    {envio.estado === 'en_sucursal' && envio.sucursal_actual
                      ? `En Sucursal (${envio.sucursal_actual})`
                      : envio.estado === 'entregado' && envio.entregado_en_sucursal && envio.sucursal_actual
                        ? `Entregado en Sucursal (${envio.sucursal_actual})`
                        : statusConfig[envio.estado]?.label || envio.estado}
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
                          <div 
                            className={`
                              w-10 h-10 rounded-full flex items-center justify-center transition-all
                              ${isCompleted ? 'text-white shadow-lg' : 'bg-muted text-muted-foreground'}
                              ${isCurrent ? 'ring-4 ring-primary/30 scale-110' : ''}
                            `}
                            style={isCompleted ? { backgroundColor: primaryColor || 'hsl(var(--primary))' } : {}}
                          >
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
                      className="h-full transition-all duration-500"
                      style={{ 
                        width: `${(currentStatusIndex / (statusOrder.length - 1)) * 100}%`,
                        backgroundColor: primaryColor || 'hsl(var(--primary))'
                      }}
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
                    {envio.remitente?.nombre || 'Sin remitente'}
                  </p>
                  <p className="text-sm text-muted-foreground">{envio.remitente?.ciudad || '-'}</p>
                  {envio.origen?.sucursal && (
                    <Badge variant="outline">{envio.origen.sucursal}</Badge>
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
                    {envio.destinatario?.nombre || 'Sin destinatario'}
                  </p>
                  <p className="text-sm text-muted-foreground">{envio.destino?.direccion}</p>
                  <p className="text-sm text-muted-foreground">{envio.destino?.ciudad}</p>
                </CardContent>
              </Card>
            </div>

            {/* History */}
            {envio.historial && envio.historial.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Historial de Movimientos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {envio.historial.map((item, index) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div 
                            className={`w-3 h-3 rounded-full`}
                            style={{ backgroundColor: index === 0 ? (primaryColor || 'hsl(var(--primary))') : 'hsl(var(--muted-foreground) / 0.3)' }}
                          />
                          {index < envio.historial.length - 1 && <div className="w-0.5 h-full bg-muted" />}
                        </div>
                        <div className="flex-1 pb-4">
                          {/* Descriptive Note (primary) or Status Badge (fallback) */}
                          {item.notas ? (
                            <p className="font-medium text-sm">{item.notas}</p>
                          ) : (
                            <Badge variant="outline">
                              {statusConfig[item.estado_nuevo as ShipmentStatus]?.label || item.estado_nuevo}
                            </Badge>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {item.notas && (
                              <Badge variant="outline" className="text-xs">
                                {statusConfig[item.estado_nuevo as ShipmentStatus]?.label || item.estado_nuevo}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {item.fecha && format(new Date(item.fecha), "dd MMM yyyy, HH:mm", { locale: es })}
                            </span>
                          </div>
                          {item.ubicacion && <p className="text-xs text-muted-foreground mt-1">{item.ubicacion}</p>}
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
          © {new Date().getFullYear()} {envio?.branding?.nombre_app || 'Geologistick'}. Sistema de Gestión Logística.
        </p>
      </div>
    </div>
  );
}
