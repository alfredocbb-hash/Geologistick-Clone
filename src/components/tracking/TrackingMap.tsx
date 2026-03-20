import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Loader2 } from 'lucide-react';

interface TrackingMapProps {
  direccion?: string | null;
  ciudad?: string | null;
  estado?: string;
  mapsApiKey?: string | null;
}

export default function TrackingMap({ direccion, ciudad, estado, mapsApiKey }: TrackingMapProps) {
  if (!direccion && !ciudad) return null;

  // No API key available – show a placeholder instead of a broken iframe
  if (!mapsApiKey) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center h-[220px] bg-muted/30 text-muted-foreground gap-2">
            <MapPin className="h-8 w-8" />
            <span className="text-sm">Mapa no disponible</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const query = encodeURIComponent([direccion, ciudad, 'Argentina'].filter(Boolean).join(', '));

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">
              {estado === 'en_reparto' ? 'En camino a destino' : 'Ubicación de destino'}
            </span>
          </div>
          <iframe
            title="Mapa de destino"
            width="100%"
            height="220"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${query}&zoom=14&language=es`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
