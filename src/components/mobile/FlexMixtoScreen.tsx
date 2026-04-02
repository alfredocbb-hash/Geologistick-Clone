import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  QrCode, Map, Play, Trash2, X, Package, MapPin, Loader2,
  Users, Navigation, FileText, CheckCircle2, Clock, ScanSearch, Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlexPackages } from '@/hooks/useFlexPackages';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import QRScanner from '@/components/qr/QRScanner';
import { MLRegisterDialog } from '@/components/scan/MLRegisterDialog';
import { FlexMapPreview } from './FlexMapPreview';
import { TransferFlexPackagesDialog } from '@/components/scan/TransferFlexPackagesDialog';
import { CreateRouteSheetDialog } from '@/components/scan/CreateRouteSheetDialog';
import { OCRCaptureDialog } from './OCRCaptureDialog';
import { BulkOCRScreen } from './BulkOCRScreen';
import { parseQRCode } from '@/lib/qrParser';
import { useNavigate } from 'react-router-dom';
import type { FlexPackage } from '@/hooks/useFlexPackages';

export function FlexMixtoScreen() {
  const navigate = useNavigate();
  const { user, hasRole, profile } = useAuth();
  const { hasPermission } = usePermissions();
  
  const [showScanner, setShowScanner] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showRouteSheetDialog, setShowRouteSheetDialog] = useState(false);
  const [mlRegisterData, setMlRegisterData] = useState<{ shipmentId: string; senderId?: string } | null>(null);
  const [scanSessionCount, setScanSessionCount] = useState(0);
  const [isCollecting, setIsCollecting] = useState(false);
  
  // OCR Fallback state
  const [showOCRCapture, setShowOCRCapture] = useState(false);
  const [pendingMLShipmentId, setPendingMLShipmentId] = useState<string | undefined>();
  const [showBulkOCR, setShowBulkOCR] = useState(false);
  
  const {
    packages, isLoading, addPackageByTracking, addPackage,
    removePackage, clearPackages, optimizeRoute, createRoute,
    createRouteSheet, hasPackages, packagesWithCoords, addManualPackage,
  } = useFlexPackages();
  
  const { location, startTracking, isTracking } = useGeolocation({ enabled: false });
  
  const ensureGpsTracking = useCallback(() => {
    if (!isTracking) startTracking();
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
        // Close scanner and open MLRegisterDialog first
        setShowScanner(false);
        setPendingMLShipmentId(parsed.value);
        setMlRegisterData({
          shipmentId: parsed.value,
          senderId: parsed.mlSenderId,
        });
        return;
      }
    } else if (parsed.type === 'tracking') {
      const pkg = await addPackageByTracking(parsed.value);
      added = !!pkg;
      if (!added) {
        toast.warning(`${parsed.value}: no encontrado`);
      }
    }
    
    if (added) {
      setScanSessionCount(prev => prev + 1);
      toast.success('📦 Paquete escaneado', {
        description: `Total: ${packages.length + 1} paquete${packages.length !== 0 ? 's' : ''}`,
        duration: 1500,
      });
    }
  }, [addPackageByTracking, ensureGpsTracking, packages.length]);

  // Handle ML registration success
  const handleMLRegistered = useCallback(async (envio: any) => {
    await addPackage(envio.id);
    setMlRegisterData(null);
    setPendingMLShipmentId(undefined);
  }, [addPackage]);

  // Handle ML registration failure → trigger OCR fallback
  const handleMLRegisterClose = useCallback(() => {
    setMlRegisterData(null);
    setPendingMLShipmentId(undefined);
  }, []);

  // Explicit OCR fallback from MLRegisterDialog error state
  const handleFallbackOCR = useCallback(() => {
    setMlRegisterData(null);
    setShowOCRCapture(true);
  }, []);

  // Handle OCR confirm → create manual shipment
  const handleOCRConfirm = useCallback(async (data: {
    direccion: string;
    localidad: string;
    codigoPostal: string;
    nombreDestinatario: string;
    mlShipmentId?: string;
  }) => {
    if (!addManualPackage) return;
    
    const pkg = await addManualPackage({
      direccion: data.direccion,
      ciudad: data.localidad,
      codigoPostal: data.codigoPostal,
      nombreDestinatario: data.nombreDestinatario,
      mlShipmentId: data.mlShipmentId,
    });
    
    if (pkg) {
      setShowOCRCapture(false);
      setPendingMLShipmentId(undefined);
      toast.success('📦 Paquete agregado manualmente (OCR)', {
        description: pkg.tracking_number,
      });
    }
  }, [addManualPackage]);

  const handleOptimize = useCallback(() => {
    if (location) optimizeRoute({ lat: location.lat, lng: location.lng });
  }, [location, optimizeRoute]);

  const handleStartDelivery = useCallback(async () => {
    const routeId = await createRoute();
    if (routeId) navigate(`/active-route?id=${routeId}&type=planificada`);
  }, [createRoute, navigate]);

  const handleRouteSheetSuccess = useCallback((hojaId: string) => {
    setShowRouteSheetDialog(false);
    clearPackages();
    navigate(`/active-route?id=${hojaId}&type=hoja_ruta`);
  }, [navigate, clearPackages]);

  const handleCollectAll = useCallback(async () => {
    if (!user?.id || packages.length === 0) return;
    setIsCollecting(true);
    try {
      const envioIds = packages.map(p => p.id);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('envios')
        .update({
          estado: 'recogido' as any,
          estado_retiro: 'retirado',
          fecha_recogida: now,
          chofer_id: user.id,
          updated_at: now,
        })
        .in('id', envioIds);
      if (error) {
        toast.error('Error al colectar', { description: error.message });
      } else {
        const count = packages.length;
        clearPackages();
        toast.success(`Colecta confirmada: ${count} paquete${count !== 1 ? 's' : ''}`, {
          description: 'Estado actualizado a recogido',
        });
      }
    } catch (e: any) {
      toast.error('Error al colectar', { description: e.message });
    } finally {
      setIsCollecting(false);
    }
  }, [user?.id, packages, clearPackages]);

  const canTransfer = hasRole('operador') || hasRole('admin') || hasRole('bodega');
  const hasBranch = !!(profile as any)?.sucursal_id;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Flex Mixto</h1>
            <Badge variant="outline" className="text-[10px] border-amber-600 text-amber-400">
              <ScanSearch className="h-3 w-3 mr-1" />
              OCR
            </Badge>
          </div>
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

      {/* Scan Buttons */}
      <div className="flex gap-3 mb-4">
        <Button
          onClick={() => { ensureGpsTracking(); setShowScanner(true); }}
          className="flex-1 h-20 text-lg font-semibold gap-3 bg-gradient-to-br from-primary via-primary to-amber-500 hover:opacity-90 shadow-xl shadow-primary/30"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : <QrCode className="h-8 w-8" />}
          ESCANEAR
        </Button>
        <Button
          onClick={() => setShowBulkOCR(true)}
          className="h-20 px-5 text-sm font-semibold gap-2 bg-gradient-to-br from-amber-600 to-orange-500 hover:opacity-90 shadow-xl shadow-amber-500/30 flex flex-col"
        >
          <Camera className="h-7 w-7" />
          <span>OCR MASIVO</span>
        </Button>
      </div>

      {/* Package Counter */}
      {hasPackages && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 mb-3">
          <Package className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-primary">
            {packages.length} paquete{packages.length !== 1 ? 's' : ''} listo{packages.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Package List */}
      {hasPackages ? (
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-2">
              {packages.map((pkg, index) => (
                <PackageCard key={pkg.id} package={pkg} index={index + 1} onRemove={() => removePackage(pkg.id)} />
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
            <Package className="h-10 w-10 text-slate-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">Sin paquetes</h3>
          <p className="text-sm text-slate-500 max-w-xs">
            Escanea los códigos QR de los paquetes. Si el seller no está autorizado, 
            se activará la captura OCR de la etiqueta.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {hasPackages && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowMap(true)}
              className="flex-1 gap-2 bg-slate-900 border-slate-700 text-white hover:bg-slate-800"
              disabled={packagesWithCoords.length === 0}
            >
              <Map className="h-4 w-4" />
              Mapa
              {packagesWithCoords.length > 0 && (
                <Badge variant="secondary" className="ml-1">{packagesWithCoords.length}</Badge>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleOptimize}
              className="flex-1 gap-2 bg-slate-900 border-amber-700 text-amber-400 hover:bg-amber-950/40"
              disabled={packagesWithCoords.length < 2 || !location}
            >
              <Navigation className="h-4 w-4" />
              Optimizar
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

          <Button
            onClick={handleCollectAll}
            disabled={isLoading || isCollecting}
            className="w-full h-14 text-lg font-semibold gap-3 bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 shadow-lg shadow-cyan-500/30"
          >
            {isCollecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            COLECTAR TODOS ({packages.length})
          </Button>

          <Button
            onClick={handleStartDelivery}
            disabled={isLoading}
            className="w-full h-14 text-lg font-semibold gap-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/30"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
            INICIAR REPARTO
          </Button>

          {hasBranch && (
            <Button
              onClick={() => setShowRouteSheetDialog(true)}
              disabled={isLoading}
              variant="outline"
              className="w-full h-12 text-base font-semibold gap-3 border-blue-600 bg-blue-950/30 text-blue-400 hover:bg-blue-900/40 hover:text-blue-300"
            >
              <FileText className="h-5 w-5" />
              HOJA DE RUTA
            </Button>
          )}
        </div>
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black">
          <QRScanner
            onScan={handleQRScanned}
            onClose={() => { setShowScanner(false); setScanSessionCount(0); }}
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

      {/* ML Register Dialog – on close triggers OCR fallback */}
      {mlRegisterData && (
        <MLRegisterDialog
          open={true}
          mlShipmentId={mlRegisterData.shipmentId}
          mlSenderId={mlRegisterData.senderId}
          userId={user?.id}
          onClose={handleMLRegisterClose}
          onSuccess={handleMLRegistered}
          onFallbackOCR={handleFallbackOCR}
        />
      )}

      {/* OCR Capture Dialog (Fallback) */}
      <OCRCaptureDialog
        open={showOCRCapture}
        mlShipmentId={pendingMLShipmentId}
        onClose={() => { setShowOCRCapture(false); setPendingMLShipmentId(undefined); }}
        onConfirm={handleOCRConfirm}
      />

      {/* Transfer Dialog */}
      <TransferFlexPackagesDialog
        open={showTransferDialog}
        packages={packages}
        onClose={() => setShowTransferDialog(false)}
        onSuccess={() => { clearPackages(); setShowTransferDialog(false); }}
      />

      {/* Route Sheet Dialog */}
      <CreateRouteSheetDialog
        open={showRouteSheetDialog}
        packagesCount={packages.length}
        packageIds={packages.map(p => p.id)}
        onClose={() => setShowRouteSheetDialog(false)}
        onSuccess={handleRouteSheetSuccess}
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
  const isManual = pkg.isManualEntry;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border transition-all",
      isManual
        ? "bg-amber-950/20 border-amber-800/40"
        : pkg.wasTransferred
          ? "bg-amber-950/30 border-amber-800/50"
          : "bg-slate-900/50 border-slate-800"
    )}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center">
        {index}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-white truncate">{pkg.tracking_number}</span>
          {isManual && (
            <Badge variant="outline" className="text-[10px] border-amber-600 text-amber-400">OCR</Badge>
          )}
          {pkg.wasTransferred && (
            <Badge variant="outline" className="text-[10px] border-amber-600 text-amber-400">Transferido</Badge>
          )}
          <HorarioBadge horario={pkg.horario_preferido_entrega} />
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3 text-slate-500" />
          <span className="text-xs text-slate-400 truncate">
            {pkg.direccion_entrega || 'Sin dirección'}
          </span>
        </div>
        {pkg.nombre_destinatario && (
          <span className="text-xs text-slate-500 truncate block">{pkg.nombre_destinatario}</span>
        )}
      </div>
      {pkg.entrega_lat && pkg.entrega_lng ? (
        <Navigation className="h-4 w-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <MapPin className="h-4 w-4 text-slate-600 flex-shrink-0" />
      )}
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

function HorarioBadge({ horario }: { horario: string | null }) {
  if (!horario || horario === 'cualquier_hora') return null;
  const config: Record<string, { label: string; className: string }> = {
    manana: { label: 'AM', className: 'border-yellow-600 text-yellow-400' },
    tarde: { label: 'PM', className: 'border-orange-600 text-orange-400' },
    noche: { label: 'Noche', className: 'border-indigo-600 text-indigo-400' },
  };
  const c = config[horario];
  if (!c) return null;
  return (
    <Badge variant="outline" className={cn("text-[10px] gap-0.5", c.className)}>
      <Clock className="h-2.5 w-2.5" />{c.label}
    </Badge>
  );
}
