import { useState } from 'react';
import { QrCode, Package, Truck, History, CheckCircle2, Scan, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import QRScanner from '@/components/qr/QRScanner';
import PickupConfirmation from '@/components/scan/PickupConfirmation';
import ReceiveShipmentDialog from '@/components/scan/ReceiveShipmentDialog';
import { BranchDeliveryDialog } from '@/components/scan/BranchDeliveryDialog';
import { parseQRCode } from '@/lib/qrParser';

type ScanMode = 'idle' | 'scanning';

interface ScannedShipment {
  id: string;
  tracking_number: string;
  estado: string;
  direccion_entrega: string | null;
  direccion_retiro: string | null;
  ciudad_retiro: string | null;
  destinatario_id: string | null;
  remitente_id: string | null;
  sucursal_destino_id: string | null;
  precio_total: number;
  pago_contra_entrega: boolean | null;
  tipo_pago: string | null;
}

export function MobileScanTab() {
  const { user, hasRole } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  
  const [showScanner, setShowScanner] = useState(false);
  const [scannedShipment, setScannedShipment] = useState<ScannedShipment | null>(null);
  const [showPickupDialog, setShowPickupDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [isPulsing, setIsPulsing] = useState(true);

  // Fetch recent scans
  const { data: recentScans } = useQuery({
    queryKey: ['mobile-recent-scans', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('envio_historial')
        .select(`
          *,
          envio:envios(tracking_number, estado, direccion_entrega)
        `)
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const handleScanClick = () => {
    setIsPulsing(false);
    setShowScanner(true);
  };

  const handleScanResult = async (data: string) => {
    setShowScanner(false);
    
    // Use the centralized QR parser
    const parsed = parseQRCode(data);
    console.log('[MobileScanTab] Parsed QR:', parsed);
    
    if (parsed.type === 'route_sheet') {
      toast.info('Código de hoja de ruta detectado', {
        description: `HR: ${parsed.value}`
      });
      setIsPulsing(true);
      return;
    }
    
    if (parsed.type === 'unknown' || !parsed.value) {
      toast.error('Código QR no reconocido', {
        description: 'No se pudo extraer un número de tracking válido'
      });
      setIsPulsing(true);
      return;
    }
    
    const tracking = parsed.value;
    
    try {
      // Search for shipment by tracking number (case-insensitive)
      const { data: shipment, error } = await supabase
        .from('envios')
        .select('*')
        .ilike('tracking_number', tracking)
        .maybeSingle();
      
      if (error) {
        console.error('[MobileScanTab] Database error:', error);
        toast.error('Error al buscar envío');
        setIsPulsing(true);
        return;
      }
      
      if (!shipment) {
        toast.error('Envío no encontrado', {
          description: `No se encontró un envío con el código: ${tracking}`
        });
        setIsPulsing(true);
        return;
      }
      
      // Play success sound and vibrate
      playBeepSound();
      vibrateDevice();
      
      // Save scanned shipment
      setScannedShipment(shipment);
      
      // Determine which dialog to show based on PERMISSIONS and shipment status
      const canPickup = hasPermission('shipments.scan') || hasPermission('route.start');
      const canDeliver = hasPermission('delivery.confirm');
      const canReceive = hasPermission('route_sheets.view');
      
      if (hasRole('chofer')) {
        if ((shipment.estado === 'pendiente' || shipment.estado === 'en_bodega') && canPickup) {
          setShowPickupDialog(true);
        } else if (canDeliver) {
          setShowDeliveryDialog(true);
        } else if (canPickup) {
          setShowPickupDialog(true);
        }
      } else if (hasRole('operador') || hasRole('bodega')) {
        if (canReceive) {
          setShowReceiveDialog(true);
        }
      } else if (hasRole('sucursal') || hasRole('despachador')) {
        if (shipment.estado === 'en_transito' && canReceive) {
          setShowReceiveDialog(true);
        } else if (canDeliver) {
          setShowDeliveryDialog(true);
        }
      } else if (canDeliver) {
        setShowDeliveryDialog(true);
      } else if (canReceive) {
        setShowReceiveDialog(true);
      }
      
      toast.success('Envío encontrado', {
        description: `Tracking: ${shipment.tracking_number}`
      });
      
    } catch (err) {
      console.error('Error searching shipment:', err);
      toast.error('Error al buscar envío');
      setIsPulsing(true);
    }
  };

  const playBeepSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 1200;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (err) {
      // Ignore audio errors
    }
  };

  const vibrateDevice = () => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    } catch (err) {
      // Ignore vibration errors
    }
  };

  const handleDialogClose = () => {
    setShowPickupDialog(false);
    setShowReceiveDialog(false);
    setShowDeliveryDialog(false);
    setScannedShipment(null);
    setIsPulsing(true);
    
    // Refresh recent scans
    queryClient.invalidateQueries({ queryKey: ['mobile-recent-scans'] });
  };

  const handleDialogSuccess = () => {
    handleDialogClose();
    toast.success('Operación completada');
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'entregado':
        return 'text-emerald-400';
      case 'en_transito':
      case 'en_reparto':
        return 'text-blue-400';
      case 'recogido':
      case 'en_bodega':
        return 'text-amber-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusLabel = (estado: string) => {
    switch (estado) {
      case 'entregado':
        return 'Entregado';
      case 'en_transito':
        return 'En tránsito';
      case 'en_reparto':
        return 'En reparto';
      case 'recogido':
        return 'Recogido';
      case 'en_bodega':
        return 'En bodega';
      case 'cancelado':
        return 'Cancelado';
      case 'devuelto':
        return 'Devuelto';
      default:
        return estado;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Escanear</h1>

      {/* Main Scan Button - Hero Style */}
      <div className="flex flex-col items-center py-8">
        <div className="relative">
          {/* Outer glow rings */}
          {isPulsing && (
            <>
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute -inset-4 rounded-full bg-primary/10 animate-pulse" />
            </>
          )}
          
          {/* Main button */}
          <button
            onClick={handleScanClick}
            className="relative w-44 h-44 rounded-full bg-gradient-to-br from-primary via-primary to-emerald-500 flex items-center justify-center shadow-2xl shadow-primary/40 hover:scale-105 transition-all duration-300 active:scale-95"
          >
            {/* Inner decorative ring */}
            <div className="absolute inset-3 rounded-full border-2 border-dashed border-white/20 animate-[spin_20s_linear_infinite]" />
            
            {/* Content */}
            <div className="flex flex-col items-center z-10">
              <Scan className="h-16 w-16 text-white" strokeWidth={1.5} />
              <span className="text-white font-bold text-lg mt-2 tracking-wide">ESCANEAR</span>
            </div>
          </button>
        </div>
        
        <p className="text-slate-400 mt-6 text-center text-sm">
          Escanea el código QR o de barras del envío
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card 
          className="bg-slate-900/60 border-slate-800/50 cursor-pointer hover:border-blue-500/50 transition-all active:scale-[0.98]"
          onClick={handleScanClick}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
                <Truck className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Colectar</p>
                <p className="text-xs text-slate-400">Escanear retiro</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 absolute top-4 right-4" />
          </CardContent>
        </Card>

        <Card 
          className="bg-slate-900/60 border-slate-800/50 cursor-pointer hover:border-emerald-500/50 transition-all active:scale-[0.98]"
          onClick={handleScanClick}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Entregar</p>
                <p className="text-xs text-slate-400">Escanear entrega</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 absolute top-4 right-4" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Scans */}
      {recentScans && recentScans.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-400" />
            <h2 className="font-semibold text-white">Últimos escaneos</h2>
          </div>

          <div className="space-y-2">
            {recentScans.map((scan) => (
              <Card key={scan.id} className="bg-slate-900/40 border-slate-800/30">
                <CardContent className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      scan.envio?.estado === 'entregado' 
                        ? 'bg-emerald-500/20' 
                        : 'bg-slate-800/60'
                    }`}>
                      <CheckCircle2 className={`h-5 w-5 ${getStatusColor(scan.envio?.estado || '')}`} />
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">
                        {scan.envio?.tracking_number}
                      </p>
                      <p className="text-xs text-slate-400 truncate max-w-[180px]">
                        {scan.envio?.direccion_entrega}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium capitalize ${getStatusColor(scan.envio?.estado || '')}`}>
                    {getStatusLabel(scan.estado_nuevo)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* QR Scanner Overlay */}
      {showScanner && (
        <QRScanner
          onScan={handleScanResult}
          onClose={() => {
            setShowScanner(false);
            setIsPulsing(true);
          }}
        />
      )}

      {/* Pickup Confirmation Dialog */}
      {scannedShipment && showPickupDialog && (
        <PickupConfirmation
          shipment={scannedShipment}
          onClose={handleDialogClose}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Receive Shipment Dialog */}
      {scannedShipment && showReceiveDialog && (
        <ReceiveShipmentDialog
          shipment={scannedShipment}
          type={hasRole('operador') || hasRole('bodega') ? 'center' : 'branch'}
          onClose={handleDialogClose}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Branch Delivery Dialog */}
      {scannedShipment && showDeliveryDialog && (
        <BranchDeliveryDialog
          open={showDeliveryDialog}
          shipment={scannedShipment}
          onClose={handleDialogClose}
          onSuccess={handleDialogSuccess}
        />
      )}
    </div>
  );
}
