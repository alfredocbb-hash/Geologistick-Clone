import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, Circle, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, MapPin, X, Check } from 'lucide-react';

interface DetectedZone {
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  lat: number;
  lng: number;
}

interface ExistingZone {
  id: string;
  ciudad: string | null;
  provincia: string | null;
  codigo_postal_desde: string | null;
  activa: boolean | null;
  lat: number | null;
  lng: number | null;
}

interface CoverageMapSelectorProps {
  branchLat: number | null;
  branchLng: number | null;
  zones: ExistingZone[];
  onAddZone: (zone: { ciudad: string; provincia: string; codigo_postal_desde: string; lat: number; lng: number }) => void;
  onDeleteZone: (id: string) => void;
  isAdding: boolean;
}

const mapContainerStyle = {
  width: '100%',
  height: '350px',
  borderRadius: '8px',
};

const defaultCenter = { lat: -34.6037, lng: -58.3816 }; // Buenos Aires

const circleOptions = {
  fillColor: '#3b82f6',
  fillOpacity: 0.15,
  strokeColor: '#3b82f6',
  strokeOpacity: 0.5,
  strokeWeight: 1.5,
  clickable: false,
  radius: 5000,
};

export function CoverageMapSelector({
  branchLat,
  branchLng,
  zones,
  onAddZone,
  onDeleteZone,
  isAdding,
}: CoverageMapSelectorProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [pendingZone, setPendingZone] = useState<DetectedZone | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const center = branchLat && branchLng
    ? { lat: branchLat, lng: branchLng }
    : defaultCenter;

  // Initialize geocoder when maps loads
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();
  }, []);

  // Initialize autocomplete on the search input
  useEffect(() => {
    if (!isLoaded || !searchInputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
      types: ['(cities)'],
      componentRestrictions: { country: 'ar' },
      fields: ['geometry', 'address_components', 'name'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place?.geometry?.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Pan map to the selected place
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(12);

      // Extract address components
      const components = place.address_components || [];
      const detected = extractAddressComponents(components, lat, lng);
      setPendingZone(detected);
      setSearchValue('');
    });

    autocompleteRef.current = autocomplete;
  }, [isLoaded]);

  const extractAddressComponents = (
    components: google.maps.GeocoderAddressComponent[],
    lat: number,
    lng: number
  ): DetectedZone => {
    let ciudad = '';
    let provincia = '';
    let codigoPostal = '';

    for (const comp of components) {
      if (comp.types.includes('locality')) {
        ciudad = comp.long_name;
      } else if (comp.types.includes('administrative_area_level_2') && !ciudad) {
        ciudad = comp.long_name;
      } else if (comp.types.includes('administrative_area_level_1')) {
        provincia = comp.long_name;
      } else if (comp.types.includes('postal_code')) {
        codigoPostal = comp.long_name;
      }
    }

    return { ciudad, provincia, codigoPostal, lat, lng };
  };

  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng || !geocoderRef.current) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    setIsGeocoding(true);
    setPendingZone(null);

    try {
      const result = await geocoderRef.current.geocode({ location: { lat, lng } });
      if (result.results && result.results.length > 0) {
        const components = result.results[0].address_components;
        const detected = extractAddressComponents(components, lat, lng);
        setPendingZone(detected);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  const handleConfirmZone = () => {
    if (!pendingZone) return;
    onAddZone({
      ciudad: pendingZone.ciudad,
      provincia: pendingZone.provincia,
      codigo_postal_desde: pendingZone.codigoPostal,
      lat: pendingZone.lat,
      lng: pendingZone.lng,
    });
    setPendingZone(null);
  };

  const activeZones = zones.filter(z => z.activa && z.lat && z.lng);

  if (loadError) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">Error al cargar el mapa: {loadError}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando mapa...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          placeholder="Buscar localidad..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Map */}
      <div className="relative rounded-lg overflow-hidden border">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={10}
          onClick={handleMapClick}
          onLoad={onMapLoad}
          options={{
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false,
          }}
        >
          {/* Existing zones as circles */}
          {activeZones.map(zone => (
            <Circle
              key={zone.id}
              center={{ lat: zone.lat!, lng: zone.lng! }}
              options={circleOptions}
            />
          ))}

          {/* Pending zone InfoWindow */}
          {pendingZone && (
            <InfoWindow
              position={{ lat: pendingZone.lat, lng: pendingZone.lng }}
              onCloseClick={() => setPendingZone(null)}
            >
              <div className="p-1 min-w-[200px]">
                <p className="font-semibold text-sm text-gray-900 mb-1">
                  ¿Agregar esta zona?
                </p>
                <div className="text-xs text-gray-600 space-y-0.5 mb-2">
                  {pendingZone.ciudad && (
                    <p><span className="font-medium">Ciudad:</span> {pendingZone.ciudad}</p>
                  )}
                  {pendingZone.provincia && (
                    <p><span className="font-medium">Provincia:</span> {pendingZone.provincia}</p>
                  )}
                  {pendingZone.codigoPostal && (
                    <p><span className="font-medium">CP:</span> {pendingZone.codigoPostal}</p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleConfirmZone}
                    disabled={isAdding}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isAdding ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Confirmar
                  </button>
                  <button
                    onClick={() => setPendingZone(null)}
                    className="flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* Geocoding spinner overlay */}
        {isGeocoding && (
          <div className="absolute inset-0 bg-background/30 flex items-center justify-center pointer-events-none">
            <div className="bg-background rounded-lg px-3 py-2 shadow-md flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Detectando localidad...</span>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 inline mr-1" />
        Hacé clic en el mapa para agregar una zona, o usá el buscador
      </p>

      {/* Zone chips */}
      {zones.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Zonas configuradas:</p>
          <div className="flex flex-wrap gap-1.5">
            {zones.map(zone => {
              const label = [zone.ciudad, zone.provincia].filter(Boolean).join(', ') || 
                `CP ${zone.codigo_postal_desde}`;
              return (
                <Badge
                  key={zone.id}
                  variant={zone.activa ? 'default' : 'secondary'}
                  className="gap-1 pr-1"
                >
                  {label}
                  <button
                    onClick={() => onDeleteZone(zone.id)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-background/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
