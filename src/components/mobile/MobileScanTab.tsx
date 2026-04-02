import { useState } from 'react';
import { QrCode, Package, Truck, History, CheckCircle2, Scan, ArrowRight, Building2 } from 'lucide-react';
import { CollectScanScreen } from './CollectScanScreen';
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
import { UltimaMillaDialog } from '@/components/scan/UltimaMillaDialog';
import { MLDeliveryDialog } from '@/components/scan/MLDeliveryDialog';
import { MLRegisterDialog } from '@/components/scan/MLRegisterDialog';
import { MLNotFoundChoiceDialog } from '@/components/scan/MLNotFoundChoiceDialog';
import { OCRCaptureDialog } from '@/components/mobile/OCRCaptureDialog';
import { ReceiveRouteSheetDialog } from '@/components/scan/ReceiveRouteSheetDialog';
import { CollectRouteSheetDialog } from '@/components/scan/CollectRouteSheetDialog';
import { parseQRCode } from '@/lib/qrParser';
import { useTenant } from '@/hooks/useTenant';

type ScanMode = 'idle' | 'scanning';

interface ScannedShipment {
  id: string;
  tracking_number: string;
  estado: string;
  direccion_entrega: string | null;
  direccion_retiro: string | null;
  ciudad_retiro: string | null;
  ciudad_entrega?: string | null;
  destinatario_id: string | null;
  remitente_id: string | null;
  sucursal_destino_id: string | null;
  precio_total: number;
  pago_contra_entrega: boolean | null;
  tipo_pago: string | null;
  chofer_id?: string | null;
  ml_shipment_id?: number | null;
  ml_order_id?: number | null;
  ml_sync_status?: string | null;
  nombre_destinatario?: string | null;
  whatsapp_destinatario?: string | null;
  tipo_servicio_detalle?: string | null;
  destinatario?: {
    nombre: string;
    apellido: string | null;
    telefono?: string;
  } | null;
}

export function MobileScanTab() {
  const { user, hasRole, isSuperAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const modoFlexMixto = !!(tenant as any)?.modo_flex_mixto;
  
  const [showScanner, setShowScanner] = useState(false);
  const [scannedShipment, setScannedShipment] = useState<ScannedShipment | null>(null);
  const [showPickupDialog, setShowPickupDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showDeliveryDialog, setShowDeliveryDialog] = useState(false);
  const [showBranchDeliveryDialog, setShowBranchDeliveryDialog] = useState(false);
  const [showUltimaMillaDialog, setShowUltimaMillaDialog] = useState(false);
  const [showMLDeliveryDialog, setShowMLDeliveryDialog] = useState(false);
  const [showMLRegisterDialog, setShowMLRegisterDialog] = useState(false);
  const [pendingMLData, setPendingMLData] = useState<{ mlShipmentId: string; mlSenderId?: string } | null>(null);
  const [isPulsing, setIsPulsing] = useState(true);
  const [showCollectScreen, setShowCollectScreen] = useState(false);
  const [showOCRCapture, setShowOCRCapture] = useState(false);
  const [pendingOCRShipmentId, setPendingOCRShipmentId] = useState<string | null>(null);
  
  // Route sheet states
  const [showReceiveRouteSheetDialog, setShowReceiveRouteSheetDialog] = useState(false);
  const [showCollectRouteSheetDialog, setShowCollectRouteSheetDialog] = useState(false);
  const [scannedRouteSheetId, setScannedRouteSheetId] = useState<string | null>(null);

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
      const hojaId = parsed.value;
      
      // Verify route sheet exists
      const { data: hojaRuta, error } = await supabase
        .from('hojas_ruta')
        .select('id, estado, chofer_id')
        .eq('id', hojaId)
        .single();
      
      if (error || !hojaRuta) {
        toast.error('Hoja de ruta no encontrada');
        setIsPulsing(true);
        return;
      }
      
      // Play success sound and vibrate
      playBeepSound();
      vibrateDevice();
      
      setScannedRouteSheetId(hojaId);
      
      // Show different dialogs based on user role
      if (hasRole('chofer')) {
        setShowCollectRouteSheetDialog(true);
        toast.success('Hoja de ruta encontrada', {
          description: `Preparar recolección de envíos`
        });
      } else {
        setShowReceiveRouteSheetDialog(true);
        toast.success('Hoja de ruta encontrada', {
          description: `Proceder con recepción de envíos`
        });
      }
      return;
    }
    
    if (parsed.type === 'unknown' || !parsed.value) {
      toast.error('Código QR no reconocido', {
        description: 'No se pudo extraer un número de tracking válido'
      });
      setIsPulsing(true);
      return;
    }

    // Handle MercadoLibre shipment IDs
    if (parsed.type === 'ml_shipment') {
      try {
        const { data: shipment, error } = await supabase
          .from('envios')
          .select(`
            *,
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono)
          `)
          .eq('ml_shipment_id', parseInt(parsed.value))
          .maybeSingle();

        if (error) {
          console.error('[MobileScanTab] ML shipment lookup error:', error);
          toast.error('Error al buscar envío ML');
          setIsPulsing(true);
          return;
        }

        if (!shipment) {
          // Shipment not found - show registration dialog
          setPendingMLData({ mlShipmentId: parsed.value, mlSenderId: parsed.mlSenderId });
          setShowMLRegisterDialog(true);
          return;
        }

        // Play success sound and vibrate
        playBeepSound();
        vibrateDevice();

        setScannedShipment(shipment);
        setShowMLDeliveryDialog(true);
        
        toast.success('Envío ML encontrado', {
          description: `Tracking: ${shipment.tracking_number}`
        });
        return;
      } catch (err) {
        console.error('Error searching ML shipment:', err);
        toast.error('Error al buscar envío ML');
        setIsPulsing(true);
        return;
      }
    }
    
    const tracking = parsed.value;
    
    try {
      // Search for shipment by tracking number (case-insensitive) with destinatario info
      let { data: shipment, error } = await supabase
        .from('envios')
        .select(`
          *,
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono)
        `)
        .ilike('tracking_number', tracking)
        .maybeSingle();
      
      // If not found, try searching with a partial match (removing potential suffix)
      if (!shipment && !error) {
        const baseTracking = tracking.replace(/-\d{1,2}$/, '');
        if (baseTracking !== tracking) {
          const { data: partialMatch, error: partialError } = await supabase
            .from('envios')
            .select(`
              *,
              destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido, telefono)
            `)
            .ilike('tracking_number', baseTracking)
            .maybeSingle();
          
          if (!partialError && partialMatch) {
            shipment = partialMatch;
          }
        }
      }
      
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
      
      // Block final states (super_admin can bypass 'entregado')
      const isFinalState = ['entregado', 'cancelado'].includes(shipment.estado);
      const canBypass = shipment.estado === 'entregado' && isSuperAdmin();
      if (isFinalState && !canBypass) {
        playWarningSound();
        vibrateDevice();
        setScannedShipment(shipment);
        const label = shipment.estado === 'entregado' ? 'Entregado' : 'Cancelado';
        toast.error(`Este envío ya fue ${label.toLowerCase()}`, {
          description: `Estado actual: ${label}. No se puede realizar ninguna acción.`,
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
      
      // Check if this is a last-mile scenario: shipment is en_transito/en_reparto 
      // and assigned to a DIFFERENT driver
      const isLastMileScenario = hasRole('chofer') && 
        (shipment.estado === 'en_transito' || shipment.estado === 'en_reparto') &&
        shipment.chofer_id && 
        shipment.chofer_id !== user?.id;
      
      if (isLastMileScenario) {
        // Show última milla dialog
        setShowUltimaMillaDialog(true);
      } else if (hasRole('chofer')) {
        if ((shipment.estado === 'pendiente' || shipment.estado === 'en_sucursal') && canPickup) {
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
        // Verificar si es un envío de tipo "retira en sucursal" listo para entregar
        const isPickupAtBranch = 
          shipment.tipo_servicio_detalle === 'sucursal_sucursal' ||
          shipment.tipo_servicio_detalle === 'puerta_sucursal';
        
        const isReadyForBranchDelivery = 
          shipment.estado === 'en_sucursal' && 
          isPickupAtBranch;
        
        if (isReadyForBranchDelivery && canDeliver) {
          // Envío listo para entrega al cliente en sucursal - usar BranchDeliveryDialog
          setShowBranchDeliveryDialog(true);
        } else if (shipment.estado === 'en_transito' && canReceive) {
          // Recepción de envío entrante
          setShowReceiveDialog(true);
        } else if (canDeliver) {
          // Fallback para otros casos de entrega
          setShowDeliveryDialog(true);
        }
      } else if (canDeliver) {
        // Fallback basado en permisos: si tiene delivery.confirm y el envío está en sucursal
        const isPickupAtBranch = 
          shipment.tipo_servicio_detalle === 'sucursal_sucursal' ||
          shipment.tipo_servicio_detalle === 'puerta_sucursal';
        
        if (shipment.estado === 'en_sucursal' && isPickupAtBranch) {
          setShowBranchDeliveryDialog(true);
        } else {
          setShowDeliveryDialog(true);
        }
      } else if (canReceive) {
        setShowReceiveDialog(true);
      } else {
        // Sin acciones disponibles - mostrar mensaje explicativo
        toast.warning('Sin acciones disponibles', {
          description: 'No tienes permisos para operar con este envío en su estado actual'
        });
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

  const playWarningSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 400;
      oscillator.type = 'square';
      gainNode.gain.value = 0.3;
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (err) {}
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
    setShowBranchDeliveryDialog(false);
    setShowUltimaMillaDialog(false);
    setShowMLDeliveryDialog(false);
    setShowMLRegisterDialog(false);
    setShowReceiveRouteSheetDialog(false);
    setShowCollectRouteSheetDialog(false);
    setScannedShipment(null);
    setPendingMLData(null);
    setScannedRouteSheetId(null);
    setIsPulsing(true);
    
    // Refresh recent scans
    queryClient.invalidateQueries({ queryKey: ['mobile-recent-scans'] });
  };

  const handleMLRegisterSuccess = (envio: any) => {
    setShowMLRegisterDialog(false);
    setPendingMLData(null);
    
    // Set the newly registered shipment and show delivery dialog
    setScannedShipment({
      id: envio.id,
      tracking_number: envio.tracking_number,
      estado: envio.estado,
      direccion_entrega: envio.direccion_entrega,
      direccion_retiro: null,
      ciudad_retiro: null,
      ciudad_entrega: envio.ciudad_entrega,
      destinatario_id: null,
      remitente_id: null,
      sucursal_destino_id: null,
      precio_total: envio.precio_total || 0,
      pago_contra_entrega: false,
      tipo_pago: null,
      ml_shipment_id: envio.ml_shipment_id,
      nombre_destinatario: envio.nombre_destinatario,
      whatsapp_destinatario: envio.whatsapp_destinatario,
    });
    
    setShowMLDeliveryDialog(true);
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
      case 'en_sucursal':
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
      case 'en_sucursal':
        return 'En Sucursal';
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
      <div className={`grid gap-3 ${(hasRole('operador') || hasRole('bodega') || hasRole('sucursal') || hasRole('admin')) ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Card 
          className="bg-slate-900/60 border-slate-800/50 cursor-pointer hover:border-blue-500/50 transition-all active:scale-[0.98]"
          onClick={() => setShowCollectScreen(true)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
                <Truck className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Colectar</p>
                <p className="text-xs text-slate-400">Colecta rápida</p>
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

        {/* Third card - Receive Route Sheet (only for admin/operator roles) */}
        {(hasRole('operador') || hasRole('bodega') || hasRole('sucursal') || hasRole('admin')) && (
          <Card 
            className="bg-slate-900/60 border-slate-800/50 cursor-pointer hover:border-purple-500/50 transition-all active:scale-[0.98]"
            onClick={handleScanClick}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">Recibir</p>
                  <p className="text-xs text-slate-400">Hoja de ruta</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 absolute top-4 right-4" />
            </CardContent>
          </Card>
        )}
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

      {/* Branch Delivery Dialog (for branch counter delivery with payment) */}
      {scannedShipment && showBranchDeliveryDialog && (
        <BranchDeliveryDialog
          open={showBranchDeliveryDialog}
          shipment={scannedShipment}
          onClose={handleDialogClose}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Standard Delivery Dialog (for drivers) */}
      {scannedShipment && showDeliveryDialog && (
        <BranchDeliveryDialog
          open={showDeliveryDialog}
          shipment={scannedShipment}
          onClose={handleDialogClose}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Última Milla Dialog */}
      {scannedShipment && showUltimaMillaDialog && (
        <UltimaMillaDialog
          open={showUltimaMillaDialog}
          shipment={scannedShipment}
          onClose={handleDialogClose}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* ML Flex Delivery Dialog */}
      {scannedShipment && showMLDeliveryDialog && (
        <MLDeliveryDialog
          open={showMLDeliveryDialog}
          shipment={scannedShipment}
          onClose={handleDialogClose}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* ML Register Dialog - for unregistered ML shipments */}
      {showMLRegisterDialog && pendingMLData && (
        <MLRegisterDialog
          open={showMLRegisterDialog}
          mlShipmentId={pendingMLData.mlShipmentId}
          mlSenderId={pendingMLData.mlSenderId}
          userId={user?.id}
          onClose={handleDialogClose}
          onSuccess={handleMLRegisterSuccess}
          onFallbackOCR={modoFlexMixto ? () => {
            setPendingOCRShipmentId(pendingMLData.mlShipmentId);
            setShowMLRegisterDialog(false);
            setPendingMLData(null);
            setShowOCRCapture(true);
          } : undefined}
        />
      )}

      {/* OCR Capture Dialog - fallback when ML register fails */}
      <OCRCaptureDialog
        open={showOCRCapture}
        mlShipmentId={pendingOCRShipmentId || undefined}
        onClose={() => {
          setShowOCRCapture(false);
          setPendingOCRShipmentId(null);
          setIsPulsing(true);
        }}
        onConfirm={async (data) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id, sucursal_id')
            .eq('user_id', user!.id)
            .single();

          const trackingNumber = `OCR-${Date.now()}`;
          const { error } = await supabase
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
              source_module: 'mobile_scan',
              tenant_id: profile?.tenant_id,
              sucursal_origen_id: profile?.sucursal_id || null,
              sucursal_entrega_id: profile?.sucursal_id || null,
              ml_shipment_id: data.mlShipmentId ? parseInt(data.mlShipmentId) : null,
              created_by: user?.id,
            })
            .select()
            .single();

          if (error) throw error;

          queryClient.invalidateQueries({ queryKey: ['envios'] });
          queryClient.invalidateQueries({ queryKey: ['mobile-recent-scans'] });
          return trackingNumber;
        }}
      />

      {/* Route Sheet Reception Dialog (for admin/operator roles) */}
      {showReceiveRouteSheetDialog && scannedRouteSheetId && (
        <ReceiveRouteSheetDialog
          hojaRutaId={scannedRouteSheetId}
          onClose={handleDialogClose}
        />
      )}

      {/* Route Sheet Collection Dialog (for drivers) */}
      {showCollectRouteSheetDialog && scannedRouteSheetId && (
        <CollectRouteSheetDialog
          hojaRutaId={scannedRouteSheetId}
          onClose={handleDialogClose}
          onSuccess={handleDialogSuccess}
        />
      )}
      {/* Collect Screen */}
      {showCollectScreen && (
        <div className="fixed inset-0 z-40 bg-slate-950 p-4 overflow-auto">
          <CollectScanScreen onClose={() => setShowCollectScreen(false)} />
        </div>
      )}
    </div>
  );
}
