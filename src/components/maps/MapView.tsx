import { GoogleMap, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { useState, useCallback, useEffect, memo } from 'react';
import { useGoogleMaps } from './GoogleMapsProvider';
import { Card } from '@/components/ui/card';
import { Loader2, AlertTriangle } from 'lucide-react';
import { GradientPolyline } from './GradientPolyline';
import { DeliveryStopMarker } from './DeliveryStopMarker';
import { DriverMarker, type DriverMarkerData } from './DriverMarker';

export interface MarkerInfo {
  position: { lat: number; lng: number };
  title?: string;
  icon?: 'origin' | 'destination' | 'branch' | 'current' | 'warning' | 'driver';
  id?: string;
  type?: 'envio' | 'sucursal' | 'origin' | 'driver';
  data?: any;
  onClick?: () => void;
}

export interface DeliveryStop {
  position: { lat: number; lng: number };
  time: string;
  trackingNumber: string;
  order: number;
}

interface MapViewProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MarkerInfo[];
  showRoute?: boolean;
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  polylinePath?: { lat: number; lng: number }[];
  secondaryPolylinePath?: { lat: number; lng: number }[];
  useGradient?: boolean;
  deliveryStops?: DeliveryStop[];
  height?: string;
  className?: string;
  onMarkerClick?: (marker: MarkerInfo) => void;
}

const defaultCenter = { lat: -34.6037, lng: -58.3816 }; // Buenos Aires

const containerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

const getMarkerIcon = (type?: MarkerInfo['icon']): string => {
  const icons = {
    origin: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
    destination: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
    branch: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
    current: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
    warning: 'https://maps.google.com/mapfiles/ms/icons/grey-dot.png',
    driver: 'https://maps.google.com/mapfiles/kml/shapes/cabs.png',
  };
  return icons[type || 'branch'] || icons.branch;
};

function MapViewComponent({
  center,
  zoom = 12,
  markers = [],
  showRoute = false,
  origin,
  destination,
  polylinePath = [],
  secondaryPolylinePath = [],
  useGradient = false,
  deliveryStops = [],
  height = '300px',
  className = '',
  onMarkerClick,
}: MapViewProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Calculate route when origin and destination are provided
  useEffect(() => {
    if (!showRoute || !origin || !destination || !window.google?.maps) {
      setDirections(null);
      return;
    }

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        } else {
          console.error('Directions request failed:', status);
          setDirections(null);
        }
      }
    );
  }, [showRoute, origin, destination]);

  // Fit bounds to markers and polyline
  useEffect(() => {
    if (!map) return;
    
    const hasMarkers = markers.length > 0;
    const hasPolyline = polylinePath.length > 0;
    
    if (!hasMarkers && !hasPolyline) return;

    const bounds = new google.maps.LatLngBounds();
    
    // Include markers in bounds
    markers.forEach((marker) => {
      bounds.extend(marker.position);
    });
    
    // Include polyline points in bounds
    polylinePath.forEach((point) => {
      bounds.extend(point);
    });

    // If only 1 point total, center and zoom
    if (markers.length <= 1 && polylinePath.length <= 1) {
      const singlePoint = markers[0]?.position || polylinePath[0];
      if (singlePoint) {
        map.setCenter(singlePoint);
        map.setZoom(zoom);
      }
    } else {
      // Fit to all points with padding
      map.fitBounds(bounds, 50);
    }
  }, [map, markers, polylinePath, zoom]);

  if (loadError) {
    return (
      <Card className={`flex items-center justify-center bg-muted ${className}`} style={{ height }}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <AlertTriangle className="h-6 w-6 text-yellow-500" />
          <span className="text-sm">Error al cargar el mapa</span>
          <span className="text-xs max-w-xs text-center">{loadError}</span>
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
        center={center || (markers[0]?.position) || defaultCenter}
        zoom={zoom}
        options={mapOptions}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* Render markers if not showing route */}
        {!directions && markers.map((marker, index) => (
          marker.icon === 'driver' ? (
            <DriverMarker
              key={marker.id || `driver-${index}`}
              position={marker.position}
              data={marker.data as DriverMarkerData}
              onClick={() => {
                if (marker.onClick) {
                  marker.onClick();
                } else if (onMarkerClick) {
                  onMarkerClick(marker);
                }
              }}
            />
          ) : (
            <Marker
              key={marker.id || index}
              position={marker.position}
              title={marker.title}
              icon={getMarkerIcon(marker.icon)}
              onClick={() => {
                if (marker.onClick) {
                  marker.onClick();
                } else if (onMarkerClick) {
                  onMarkerClick(marker);
                }
              }}
            />
          )
        ))}

        {/* Render directions */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: false,
              polylineOptions: {
                strokeColor: 'hsl(var(--primary))',
                strokeWeight: 4,
                strokeOpacity: 0.8,
              },
            }}
          />
        )}

        {/* Render polyline path - gradient or standard */}
        {polylinePath.length > 1 && !directions && (
          useGradient ? (
            <GradientPolyline
              path={polylinePath}
              segments={10}
              showArrows={true}
              showStartMarker={false}
              showEndMarker={false}
            />
          ) : (
            <>
              {/* Shadow/outline polyline for better visibility */}
              <Polyline
                path={polylinePath}
                options={{
                  strokeColor: '#1e3a5f',
                  strokeWeight: 7,
                  strokeOpacity: 0.4,
                  geodesic: true,
                }}
              />
              {/* Main route polyline */}
              <Polyline
                path={polylinePath}
                options={{
                  strokeColor: '#4285F4',
                  strokeWeight: 5,
                  strokeOpacity: 0.95,
                  geodesic: true,
                  icons: [{
                    icon: {
                      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                      scale: 2.5,
                      strokeColor: '#ffffff',
                      strokeWeight: 1,
                      fillColor: '#4285F4',
                      fillOpacity: 1,
                    },
                    repeat: '150px',
                  }],
                }}
              />
            </>
          )
        )}

        {/* Render delivery stop markers */}
        {deliveryStops.map((stop) => (
          <DeliveryStopMarker
            key={`stop-${stop.order}-${stop.trackingNumber}`}
            position={stop.position}
            time={stop.time}
            trackingNumber={stop.trackingNumber}
            order={stop.order}
          />
        ))}

        {/* Render secondary polyline (planned route) - dashed style */}
        {secondaryPolylinePath.length > 1 && (
          <>
            <Polyline
              path={secondaryPolylinePath}
              options={{
                strokeColor: '#42A5F5',
                strokeWeight: 4,
                strokeOpacity: 0,
                geodesic: true,
                icons: [{
                  icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 0.7,
                    strokeColor: '#42A5F5',
                    strokeWeight: 4,
                    scale: 3,
                  },
                  offset: '0',
                  repeat: '20px',
                }],
              }}
            />
          </>
        )}
      </GoogleMap>
    </div>
  );
}

export const MapView = memo(MapViewComponent);
export default MapView;
