import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface LiveTrackingData {
  tracking_number: string;
  estado: string;
  live: boolean;
  message?: string;
  driver?: { lat: number; lng: number; updated_at: string };
  destination?: { lat: number | null; lng: number | null; direccion: string | null; ciudad: string | null };
  maps_api_key?: string | null;
}

interface LiveDriverMapProps {
  trackingNumber: string;
}

export default function LiveDriverMap({ trackingNumber }: LiveDriverMapProps) {
  const { data, isLoading } = useQuery<LiveTrackingData>({
    queryKey: ['live-tracking', trackingNumber],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-tracking-live?code=${encodeURIComponent(trackingNumber)}`
      );
      return res.json();
    },
    refetchInterval: 10000,
    enabled: !!trackingNumber,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Cargando ubicación en vivo...</span>
        </CardContent>
      </Card>
    );
  }

  // Not live yet (driver too far or no location)
  if (!data?.live || !data.driver) {
    if (data?.message) {
      return (
        <Card className="border-muted">
          <CardContent className="py-6 flex items-center justify-center gap-2">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{data.message}</span>
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  const { driver, destination, maps_api_key } = data;
  const lastUpdate = driver.updated_at
    ? formatDistanceToNow(new Date(driver.updated_at), { addSuffix: true, locale: es })
    : null;

  // No API key available – show text-only status
  if (!maps_api_key) {
    return (
      <Card className="border-green-500/30">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-green-600 text-white gap-1.5 px-3 py-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
              En vivo
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            El repartidor está cerca de tu ubicación.
          </p>
          {lastUpdate && (
            <p className="text-xs text-muted-foreground mt-2">Última actualización: {lastUpdate}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Build Google Maps embed with directions
  const mapSrc = `https://www.google.com/maps/embed/v1/directions?key=${maps_api_key}&origin=${driver.lat},${driver.lng}&destination=${
    destination?.lat && destination?.lng
      ? `${destination.lat},${destination.lng}`
      : encodeURIComponent([destination?.direccion, destination?.ciudad, 'Argentina'].filter(Boolean).join(', '))
  }&mode=driving&language=es`;

  return (
    <Card className="overflow-hidden border-green-500/30">
      <CardContent className="p-0">
        <div className="relative">
          {/* Live indicator */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <Badge className="bg-green-600 text-white shadow-lg gap-1.5 px-3 py-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
              En vivo
            </Badge>
          </div>

          {/* Legend */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border text-xs">
            <div className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-blue-600" />
              <span>Repartidor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-red-500" />
              <span>Tu destino</span>
            </div>
          </div>

          <iframe
            title="Ubicación en vivo del repartidor"
            width="100%"
            height="300"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={mapSrc}
          />

          {/* Last update */}
          {lastUpdate && (
            <div className="px-4 py-2 bg-muted/50 text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Última actualización: {lastUpdate}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
