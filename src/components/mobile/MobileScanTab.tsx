import { useState } from 'react';
import { QrCode, Package, Truck, History, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import QRScanner from '@/components/qr/QRScanner';
import PickupConfirmation from '@/components/scan/PickupConfirmation';
import ReceiveShipmentDialog from '@/components/scan/ReceiveShipmentDialog';
import { BranchDeliveryDialog } from '@/components/scan/BranchDeliveryDialog';

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
  const queryClient = useQueryClient();
  
  const [showScanner, setShowScanner] = useState(false);
  const [scannedShipment, setScannedShipment] = useState<ScannedShipment | null>(null);
  const [showPickupDialog, setShowPickupDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);

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
    setShowScanner(true);
  };

  const handleScanResult = async (data: string) => {
    setShowScanner(false);
    
    // Extract tracking number from QR (might be URL or just tracking)
    let tracking = data;
    if (data.includes('/')) {
      const parts = data.split('/');
      tracking = parts[parts.length - 1];
    }
    
    // Clean up tracking number
    tracking = tracking.trim();
    
    try {
      // Search for shipment by tracking number
      const { data: shipment, error } = await supabase
        .from('envios')
        .select('*')
        .eq('tracking_number', tracking)
        .single();
      
      if (error || !shipment) {
        toast.error('Envío no encontrado', {
          description: `No se encontró un envío con el código: ${tracking}`
        });
        return;
      }
      
      // Play success sound
      playBeepSound();
      
      // Save scanned shipment
      setScannedShipment(shipment);
      
      // Determine which dialog to show based on user role and shipment status
      if (hasRole('chofer')) {
        // Driver: pickup or delivery based on status
        if (shipment.estado === 'pendiente' || shipment.estado === 'en_bodega') {
          setShowPickupDialog(true);
        } else {
          setShowDeliveryDialog(true);
        }
      } else if (hasRole('operador') || hasRole('bodega')) {
        // Logistics center: receive shipment
        setShowReceiveDialog(true);
      } else if (hasRole('sucursal') || hasRole('despachador')) {
        // Branch: receive or deliver
        if (shipment.estado === 'en_transito') {
          setShowReceiveDialog(true);
        } else {
          setShowDeliveryDialog(true);
        }
      } else {
        // Default: show delivery dialog
        setShowDeliveryDialog(true);
      }
      
      toast.success('Envío encontrado', {
        description: `Tracking: ${shipment.tracking_number}`
      });
      
    } catch (err) {
      console.error('Error searching shipment:', err);
      toast.error('Error al buscar envío');
    }
  };

  const playBeepSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 1000;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch (err) {
      // Ignore audio errors
    }
  };

  const handleDialogClose = () => {
    setShowPickupDialog(false);
    setShowReceiveDialog(false);
    setShowDeliveryDialog(false);
    setScannedShipment(null);
    
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
        return 'text-green-400';
      case 'en_transito':
      case 'en_reparto':
        return 'text-blue-400';
      case 'recogido':
      case 'en_bodega':
        return 'text-yellow-400';
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

      {/* Main Scan Button */}
      <div className="flex flex-col items-center py-8">
        <button
          onClick={handleScanClick}
          className="relative w-40 h-40 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl shadow-primary/30 hover:scale-105 transition-transform active:scale-95"
        >
          <div className="absolute inset-2 rounded-full border-4 border-dashed border-primary-foreground/30 animate-spin" style={{ animationDuration: '10s' }} />
          <div className="flex flex-col items-center">
            <QrCode className="h-16 w-16 text-primary-foreground" />
            <span className="text-primary-foreground font-semibold mt-2">ESCANEAR</span>
          </div>
        </button>
        <p className="text-slate-400 mt-4 text-center">
          Escanea el código QR del envío
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card 
          className="bg-slate-800/50 border-slate-700 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={handleScanClick}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-white">Colectar</p>
              <p className="text-xs text-slate-400">Escanear retiro</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-slate-800/50 border-slate-700 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={handleScanClick}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Package className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium text-white">Entregar</p>
              <p className="text-xs text-slate-400">Escanear entrega</p>
            </div>
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
              <Card key={scan.id} className="bg-slate-800/30 border-slate-700/50">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className={`h-5 w-5 ${getStatusColor(scan.envio?.estado || '')}`} />
                    <div>
                      <p className="font-medium text-white text-sm">
                        {scan.envio?.tracking_number}
                      </p>
                      <p className="text-xs text-slate-400 truncate max-w-[180px]">
                        {scan.envio?.direccion_entrega}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs capitalize ${getStatusColor(scan.envio?.estado || '')}`}>
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
          onClose={() => setShowScanner(false)}
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
