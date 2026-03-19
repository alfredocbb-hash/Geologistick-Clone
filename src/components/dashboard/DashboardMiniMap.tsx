import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider';
import { GoogleMap, Marker } from '@react-google-maps/api';

interface Props {
  tenantId: string | null;
}

const mapContainerStyle = { width: '100%', height: '250px' };
const defaultCenter = { lat: -34.6037, lng: -58.3816 }; // Buenos Aires

export default function DashboardMiniMap({ tenantId }: Props) {
  const { isLoaded } = useGoogleMaps();
  const mapRef = useRef<google.maps.Map | null>(null);

  const { data: sucursales, isLoading } = useQuery({
    queryKey: ['dashboard-map-sucursales', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre, direccion, ciudad, lat, lng')
        .eq('tenant_id', tenantId!)
        .eq('activa', true);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const activeSucursales = sucursales?.filter(s => s.lat && s.lng) || [];

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current || activeSucursales.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    activeSucursales.forEach(s => bounds.extend({ lat: s.lat!, lng: s.lng! }));
    mapRef.current.fitBounds(bounds);
    if (activeSucursales.length === 1) {
      mapRef.current.setZoom(14);
    }
  }, [activeSucursales]);

  if (isLoading) return <Skeleton className="h-[300px]" />;

  const displaySucursales = sucursales?.filter(s => s.direccion && s.direccion !== 'Por configurar') || [];
  if (displaySucursales.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Sucursales
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={activeSucursales.length > 0 ? { lat: activeSucursales[0].lat!, lng: activeSucursales[0].lng! } : defaultCenter}
              zoom={12}
              onLoad={onLoad}
              options={{ disableDefaultUI: true, zoomControl: true }}
            >
              {activeSucursales.map(s => (
                <Marker key={s.id} position={{ lat: s.lat!, lng: s.lng! }} title={s.nombre} />
              ))}
            </GoogleMap>
          ) : (
            <div className="h-[250px] flex items-center justify-center bg-muted text-muted-foreground text-sm">
              Cargando mapa...
            </div>
          )}
        </div>
        <div className="p-3 space-y-1.5">
          {displaySucursales.slice(0, 4).map(s => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              <span className="font-medium truncate">{s.nombre}</span>
              <span className="text-muted-foreground truncate text-xs ml-auto">{s.ciudad || s.direccion}</span>
            </div>
          ))}
          {displaySucursales.length > 4 && (
            <p className="text-xs text-muted-foreground">+{displaySucursales.length - 4} más</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
