import { GoogleMap } from '@react-google-maps/api';
import { useState, useCallback, useEffect, memo } from 'react';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Card } from '@/components/ui/card';
import { Loader2, AlertTriangle } from 'lucide-react';

interface HeatmapPoint {
  lat: number;
  lng: number;
  weight?: number;
}

interface HeatmapMapViewProps {
  points: HeatmapPoint[];
  height?: string;
  className?: string;
  radius?: number;
}

const containerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: -34.6037, lng: -58.3816 };

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
};

function HeatmapMapViewComponent({ points, height = '500px', className = '', radius = 30 }: HeatmapMapViewProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => setMap(map), []);
  const onUnmount = useCallback(() => setMap(null), []);

  // Manage heatmap layer
  useEffect(() => {
    if (!map || !window.google?.maps?.visualization || points.length === 0) return;

    const data = points.map(p => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      weight: p.weight || 1,
    }));

    const heatmap = new google.maps.visualization.HeatmapLayer({
      data,
      map,
      radius,
      opacity: 0.7,
      gradient: [
        'rgba(0, 255, 0, 0)',
        'rgba(0, 255, 0, 1)',
        'rgba(255, 255, 0, 1)',
        'rgba(255, 165, 0, 1)',
        'rgba(255, 0, 0, 1)',
      ],
    });

    // Fit bounds
    if (points.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
      map.fitBounds(bounds, 50);
    } else if (points.length === 1) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng });
      map.setZoom(13);
    }

    return () => { heatmap.setMap(null); };
  }, [map, points, radius]);

  if (loadError) {
    return (
      <Card className={`flex items-center justify-center bg-muted ${className}`} style={{ height }}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <AlertTriangle className="h-6 w-6 text-yellow-500" />
          <span className="text-sm">Error al cargar el mapa</span>
        </div>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className={`flex items-center justify-center bg-muted ${className}`} style={{ height }}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Cargando mapa...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden ${className}`} style={{ height }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={points.length > 0 ? { lat: points[0].lat, lng: points[0].lng } : defaultCenter}
        zoom={11}
        options={mapOptions}
        onLoad={onLoad}
        onUnmount={onUnmount}
      />
    </div>
  );
}

export const HeatmapMapView = memo(HeatmapMapViewComponent);
export default HeatmapMapView;
