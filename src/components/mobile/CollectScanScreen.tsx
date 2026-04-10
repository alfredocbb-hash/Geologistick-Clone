import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  QrCode,
  Trash2,
  X,
  Package,
  MapPin,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useCollectPackages } from '@/hooks/useCollectPackages';
import { BulkOCRScreen } from '@/components/mobile/BulkOCRScreen';
import QRScanner from '@/components/qr/QRScanner';
import { MLRegisterDialog } from '@/components/scan/MLRegisterDialog';
import { MLNotFoundChoiceDialog } from '@/components/scan/MLNotFoundChoiceDialog';
import { OCRCaptureDialog } from '@/components/mobile/OCRCaptureDialog';
import { parseQRCode } from '@/lib/qrParser';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import type { CollectPackage } from '@/hooks/useCollectPackages';

interface CollectScanScreenProps {
  onClose: () => void;
}

export function CollectScanScreen({ onClose }: CollectScanScreenProps) {
  const { user } = useAuth();
  const [showScanner, setShowScanner] = useState(false);
  const [scanSessionCount, setScanSessionCount] = useState(0);
  const [mlRegisterData, setMlRegisterData] = useState<{ shipmentId: string; senderId?: string } | null>(null);
  const [showMLChoiceDialog, setShowMLChoiceDialog] = useState(false);
  const [pendingMLShipmentId, setPendingMLShipmentId] = useState<string | null>(null);
  const [showOCRCapture, setShowOCRCapture] = useState(false);
  const [showBulkOCR, setShowBulkOCR] = useState(false);

  const {
    packages,
    isLoading,
    addPackageByTracking,
    removePackage,
    clearPackages,
    confirmCollection,
    hasPackages,
  } = useCollectPackages();

  const handleQRScanned = useCallback(async (result: string) => {
    const parsed = parseQRCode(result);
    // Increment counter immediately so the badge updates instantly
    setScanSessionCount(prev => prev + 1);

    if (parsed.type === 'ml_shipment') {
      const mlTracking = `ML-${parsed.value}`;
      const pkg = await addPackageByTracking(mlTracking);
      if (!pkg) {
        // ML not found — show choice dialog
        setPendingMLShipmentId(parsed.value);
        setShowMLChoiceDialog(true);
      }
    } else if (parsed.type === 'tracking') {
      const pkg = await addPackageByTracking(parsed.value);
      if (!pkg) {
        toast.warning(`${parsed.value}: no encontrado`);
      }
    }
  }, [addPackageByTracking]);

  const handleConfirm = useCallback(async () => {
    const success = await confirmCollection();
    if (success) {
      onClose();
    }
  }, [confirmCollection, onClose]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Colecta Rápida</h1>
          <p className="text-sm text-slate-400">
            {packages.length} paquete{packages.length !== 1 ? 's' : ''} escaneado{packages.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Big Scan Button */}
      <Button
        onClick={() => setShowScanner(true)}
        className="w-full h-20 text-lg font-semibold gap-3 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 hover:opacity-90 shadow-xl shadow-blue-500/30 mb-4"
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
                <CollectPackageCard
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
            Escanea los códigos QR de los paquetes que vas a colectar.
            Se acumularán aquí antes de confirmar la colecta.
          </p>
        </div>
      )}

      {/* Confirm Collection Button */}
      {hasPackages && (
        <div className="mt-4">
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="w-full h-14 text-lg font-semibold gap-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/30"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
            CONFIRMAR COLECTA ({packages.length})
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

      {/* ML Not Found Choice Dialog */}
      {showMLChoiceDialog && pendingMLShipmentId && (
        <MLNotFoundChoiceDialog
          open={showMLChoiceDialog}
          mlShipmentId={pendingMLShipmentId}
          onClose={() => {
            setShowMLChoiceDialog(false);
            setPendingMLShipmentId(null);
          }}
          onChooseManual={() => {
            setShowMLChoiceDialog(false);
            setMlRegisterData({ shipmentId: pendingMLShipmentId });
            setPendingMLShipmentId(null);
          }}
          onChooseOCR={() => {
            setShowMLChoiceDialog(false);
            setShowOCRCapture(true);
          }}
          onChooseBulkOCR={() => {
            setShowMLChoiceDialog(false);
            setPendingMLShipmentId(null);
            setShowBulkOCR(true);
          }}
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
          onSuccess={async (envio: any) => {
            setMlRegisterData(null);
            if (envio?.tracking_number) {
              await addPackageByTracking(envio.tracking_number);
            }
          }}
          onFallbackOCR={() => {
            const mlId = mlRegisterData.shipmentId;
            setMlRegisterData(null);
            setPendingMLShipmentId(mlId);
            setShowOCRCapture(true);
          }}
        />
      )}

      {/* OCR Capture Dialog */}
      <OCRCaptureDialog
        open={showOCRCapture}
        mlShipmentId={pendingMLShipmentId || undefined}
        onClose={() => {
          setShowOCRCapture(false);
          setPendingMLShipmentId(null);
        }}
        onConfirm={async (data) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id, sucursal_id')
            .eq('user_id', user!.id)
            .single();

          const trackingNumber = `OCR-${Date.now()}`;
          const { data: envio, error } = await supabase
            .from('envios')
            .insert({
              tracking_number: trackingNumber,
              direccion_entrega: data.direccion,
              ciudad_entrega: data.localidad,
              cp_entrega: data.codigoPostal,
              nombre_destinatario: data.nombreDestinatario || null,
              notas: data.referencia || null,
              estado: 'pendiente',
              precio_total: 0,
              is_manual_entry: true,
              source_module: 'mobile_collect',
              tenant_id: profile?.tenant_id,
              sucursal_origen_id: profile?.sucursal_id || null,
              sucursal_entrega_id: profile?.sucursal_id || null,
              ml_shipment_id: data.mlShipmentId ? parseInt(data.mlShipmentId) : null,
              created_by: user?.id,
            })
            .select()
            .single();

          if (error) throw error;

          // Add to collect list
          if (trackingNumber) {
            await addPackageByTracking(trackingNumber);
          }
          setPendingMLShipmentId(null);
          return trackingNumber;
        }}
      />

      {/* Bulk OCR Screen */}
      {showBulkOCR && (
        <div className="fixed inset-0 z-50 bg-slate-950 p-4 overflow-auto">
          <BulkOCRScreen
            onClose={() => setShowBulkOCR(false)}
            onPackagesReady={async (ids: string[]) => {
              setShowBulkOCR(false);
              for (const id of ids) {
                const { data } = await supabase
                  .from('envios')
                  .select('tracking_number')
                  .eq('id', id)
                  .single();
                if (data?.tracking_number) {
                  await addPackageByTracking(data.tracking_number);
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

// Package Card for collection
interface CollectPackageCardProps {
  package: CollectPackage;
  index: number;
  onRemove: () => void;
}

function CollectPackageCard({ package: pkg, index, onRemove }: CollectPackageCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-slate-900/50 border-slate-800">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold text-sm flex items-center justify-center">
        {index}
      </div>

      <div className="flex-1 min-w-0">
        <span className="font-mono text-sm text-white truncate block">
          {pkg.tracking_number}
        </span>
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
