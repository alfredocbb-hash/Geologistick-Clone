import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { MapView } from '@/components/maps/MapView';
import { X, Route, Loader2 } from 'lucide-react';
import type { FlexPackage } from '@/hooks/useFlexPackages';
import type { MarkerInfo } from '@/components/maps/MapView';

interface FlexMapPreviewProps {
  packages: FlexPackage[];
  currentLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onOptimize: () => void;
  isOptimizing?: boolean;
}

export function FlexMapPreview({
  packages,
  currentLocation,
  onClose,
  onOptimize,
  isOptimizing = false,
}: FlexMapPreviewProps) {
  // Convert packages to markers for MapView
  const markers: MarkerInfo[] = useMemo(() => {
    const packageMarkers: MarkerInfo[] = packages
      .filter(pkg => pkg.entrega_lat && pkg.entrega_lng)
      .map((pkg, index) => ({
        id: pkg.id,
        position: { lat: pkg.entrega_lat!, lng: pkg.entrega_lng! },
        title: `${index + 1}. ${pkg.nombre_destinatario || pkg.tracking_number}`,
        type: 'envio' as const,
        icon: 'destination' as const,
      }));

    // Add current location marker if available
    if (currentLocation) {
      packageMarkers.unshift({
        id: 'current-location',
        position: currentLocation,
        title: 'Tu ubicación',
        type: 'origin' as const,
        icon: 'current' as const,
      });
    }

    return packageMarkers;
  }, [packages, currentLocation]);

  // Calculate center of the map
  const center = useMemo(() => {
    if (currentLocation) return currentLocation;
    
    const validPackages = packages.filter(p => p.entrega_lat && p.entrega_lng);
    if (validPackages.length === 0) return { lat: -34.6037, lng: -58.3816 }; // Buenos Aires default
    
    const avgLat = validPackages.reduce((sum, p) => sum + p.entrega_lat!, 0) / validPackages.length;
    const avgLng = validPackages.reduce((sum, p) => sum + p.entrega_lng!, 0) / validPackages.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [packages, currentLocation]);

  const packagesWithCoords = packages.filter(p => p.entrega_lat && p.entrega_lng).length;
  const packagesWithoutCoords = packages.length - packagesWithCoords;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950">
      {/* Header */}
      <div 
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 bg-slate-950/90 backdrop-blur-lg border-b border-slate-800"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)', paddingBottom: '0.5rem' }}
      >
        <div>
          <h2 className="text-lg font-semibold text-white">Vista Previa</h2>
          <p className="text-xs text-slate-400">
            {packagesWithCoords} paradas en el mapa
            {packagesWithoutCoords > 0 && ` (${packagesWithoutCoords} sin ubicación)`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Map */}
      <div className="h-full pt-20 pb-24">
        <MapView
          center={center}
          zoom={12}
          markers={markers}
          showRoute={true}
          className="h-full w-full"
        />
      </div>

      {/* Bottom Actions */}
      <div 
        className="absolute bottom-0 left-0 right-0 z-10 flex gap-3 px-4 py-4 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <Button
          variant="outline"
          onClick={onOptimize}
          disabled={isOptimizing || packagesWithCoords < 2 || !currentLocation}
          className="flex-1 gap-2 bg-slate-900 border-slate-700 text-white hover:bg-slate-800"
        >
          {isOptimizing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Route className="h-4 w-4" />
          )}
          Optimizar Ruta
        </Button>
        
        <Button
          onClick={onClose}
          className="flex-1 gap-2"
        >
          Confirmar
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-28 left-4 right-4 z-10">
        <div className="flex flex-wrap gap-3 justify-center">
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-full border border-slate-700">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-xs text-slate-300">Tu ubicación</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-full border border-slate-700">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-slate-300">Paradas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
