import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  QrCode, 
  Map, 
  Play, 
  Trash2, 
  X, 
  Package,
  MapPin,
  Loader2,
  Users,
  Navigation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlexPackages } from '@/hooks/useFlexPackages';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import QRScanner from '@/components/qr/QRScanner';
import { MLRegisterDialog } from '@/components/scan/MLRegisterDialog';
import { FlexMapPreview } from './FlexMapPreview';
import { TransferFlexPackagesDialog } from '@/components/scan/TransferFlexPackagesDialog';
import { parseQRCode } from '@/lib/qrParser';
import { useNavigate } from 'react-router-dom';
import type { FlexPackage } from '@/hooks/useFlexPackages';

export function FlexScanScreen() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { hasPermission } = usePermissions();
  
  const [showScanner, setShowScanner] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [mlRegisterData, setMlRegisterData] = useState<{ shipmentId: string; senderId?: string } | null>(null);
  const [scanSessionCount, setScanSessionCount] = useState(0);
  
  const {
    packages,
    isLoading,
    addPackageByTracking,
    addPackage,
    removePackage,
    clearPackages,
    optimizeRoute,
    createRoute,
    hasPackages,
    packagesWithCoords,
  } = useFlexPackages();
  
  const { location, startTracking, isTracking } = useGeolocation({ enabled: false });
  
  // Start GPS tracking when user first interacts
  const ensureGpsTracking = useCallback(() => {
    if (!isTracking) {
      startTracking();
    }
  }, [isTracking, startTracking]);

  // Handle QR code scanned
  const handleQRScanned = useCallback(async (result: string) => {
    ensureGpsTracking();
    
    const parsed = parseQRCode(result);
    let added = false;
    
    if (parsed.type === 'ml_shipment') {
      const mlTracking = `ML-${parsed.value}`;
      const pkg = await addPackageByTracking(mlTracking);
      added = !!pkg;
      
      if (!added) {
        // In continuous mode, just show toast; user can register after closing scanner
        toast.warning(`ML-${parsed.value}: no encontrado, escanea otro o cierra para registrar`);
      }
    } else if (parsed.type === 'tracking') {
      const trackingNumber = parsed.value;
      const pkg = await addPackageByTracking(trackingNumber);
      added = !!pkg;
      
      if (!added) {
        toast.warning(`${trackingNumber}: no encontrado`);
      }
    }
    
    if (added) {
      setScanSessionCount(prev => prev + 1);
    }
  }, [addPackageByTracking, ensureGpsTracking]);

  // Handle ML registration success
  const handleMLRegistered = useCallback(async (envio: any) => {
    await addPackage(envio.id);
    setMlRegisterData(null);
  }, [addPackage]);

  // Handle optimize route
  const handleOptimize = useCallback(() => {
    if (location) {
      optimizeRoute({ lat: location.lat, lng: location.lng });
    }
  }, [location, optimizeRoute]);

  // Handle start delivery
  const handleStartDelivery = useCallback(async () => {
    const routeId = await createRoute();
    if (routeId) {
      navigate(`/active-route?id=${routeId}&type=planificada`);
    }
  }, [createRoute, navigate]);

  // Check if user can transfer packages (operator/admin)
  const canTransfer = hasRole('operador') || hasRole('admin') || hasRole('bodega');

  return (
    <div className="flex flex-col h-full">
      {/* Header Stats */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Modo Flex</h1>
          <p className="text-sm text-slate-400">
            {packages.length} paquete{packages.length !== 1 ? 's' : ''} escaneado{packages.length !== 1 ? 's' : ''}
          </p>
        </div>
        {hasPackages && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearPackages}
            className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Big Scan Button */}
      <Button
        onClick={() => {
          ensureGpsTracking();
          setShowScanner(true);
        }}
        className="w-full h-20 text-lg font-semibold gap-3 bg-gradient-to-br from-primary via-primary to-emerald-500 hover:opacity-90 shadow-xl shadow-primary/30 mb-4"
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : (
          <QrCode className="h-8 w-8" />
        )}
        ESCANEAR PAQUETE
      </Button>

      {/* Package List */}
      {hasPackages ? (
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-2">
              {packages.map((pkg, index) => (
                <PackageCard
                  key={pkg.id}
                  package={pkg}
                  index={index + 1}
                  onRemove={() => removePackage(pkg.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
            <Package className="h-10 w-10 text-slate-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            Sin paquetes
          </h3>
          <p className="text-sm text-slate-500 max-w-xs">
            Escanea los códigos QR de los paquetes que vas a entregar. 
            Se acumularán aquí antes de iniciar el reparto.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {hasPackages && (
        <div className="mt-4 space-y-3">
          {/* Map & Transfer Row */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowMap(true)}
              className="flex-1 gap-2 bg-slate-900 border-slate-700 text-white hover:bg-slate-800"
              disabled={packagesWithCoords.length === 0}
            >
              <Map className="h-4 w-4" />
              Ver Mapa
              {packagesWithCoords.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {packagesWithCoords.length}
                </Badge>
              )}
            </Button>
            
            {canTransfer && (
              <Button
                variant="outline"
                onClick={() => setShowTransferDialog(true)}
                className="flex-1 gap-2 bg-slate-900 border-slate-700 text-white hover:bg-slate-800"
              >
                <Users className="h-4 w-4" />
                Asignar
              </Button>
            )}
          </div>

          {/* Start Delivery Button */}
          <Button
            onClick={handleStartDelivery}
            disabled={isLoading}
            className="w-full h-14 text-lg font-semibold gap-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/30"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            INICIAR REPARTO
          </Button>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black">
          <QRScanner
            onScan={handleQRScanned}
            onClose={() => {
              setShowScanner(false);
              setScanSessionCount(0);
            }}
            continuousMode
            scannedCount={scanSessionCount}
          />
        </div>
      )}

      {/* Map Preview */}
      {showMap && (
        <FlexMapPreview
          packages={packages}
          currentLocation={location ? { lat: location.lat, lng: location.lng } : null}
          onClose={() => setShowMap(false)}
          onOptimize={handleOptimize}
        />
      )}

      {/* ML Register Dialog */}
      {mlRegisterData && (
        <MLRegisterDialog
          open={true}
          mlShipmentId={mlRegisterData.shipmentId}
          mlSenderId={mlRegisterData.senderId}
          userId={user?.id}
          onClose={() => setMlRegisterData(null)}
          onSuccess={handleMLRegistered}
        />
      )}

      {/* Transfer Dialog */}
      <TransferFlexPackagesDialog
        open={showTransferDialog}
        packages={packages}
        onClose={() => setShowTransferDialog(false)}
        onSuccess={() => {
          clearPackages();
          setShowTransferDialog(false);
        }}
      />
    </div>
  );
}

// Package Card Component
interface PackageCardProps {
  package: FlexPackage;
  index: number;
  onRemove: () => void;
}

function PackageCard({ package: pkg, index, onRemove }: PackageCardProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border transition-all",
      pkg.wasTransferred 
        ? "bg-amber-950/30 border-amber-800/50" 
        : "bg-slate-900/50 border-slate-800"
    )}>
      {/* Index Badge */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center">
        {index}
      </div>
      
      {/* Package Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-white truncate">
            {pkg.tracking_number}
          </span>
          {pkg.wasTransferred && (
            <Badge variant="outline" className="text-[10px] border-amber-600 text-amber-400">
              Transferido
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3 text-slate-500" />
          <span className="text-xs text-slate-400 truncate">
            {pkg.direccion_entrega || 'Sin dirección'}
          </span>
        </div>
        {pkg.nombre_destinatario && (
          <span className="text-xs text-slate-500 truncate block">
            {pkg.nombre_destinatario}
          </span>
        )}
      </div>

      {/* Location indicator */}
      {pkg.entrega_lat && pkg.entrega_lng ? (
        <Navigation className="h-4 w-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <MapPin className="h-4 w-4 text-slate-600 flex-shrink-0" />
      )}
      
      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-950/30 flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
