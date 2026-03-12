import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  QrCode, 
  Search, 
  Package, 
  Building2, 
  Loader2,
  AlertTriangle,
  Store,
  Truck,
  FileText,
  PackageCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import QRScanner from '@/components/qr/QRScanner';
import PickupConfirmation from '@/components/scan/PickupConfirmation';
import ReceiveShipmentDialog from '@/components/scan/ReceiveShipmentDialog';
import { BranchDeliveryDialog } from '@/components/scan/BranchDeliveryDialog';
import { ReceiveRouteSheetDialog } from '@/components/scan/ReceiveRouteSheetDialog';
import { MLDeliveryDialog } from '@/components/scan/MLDeliveryDialog';
import { MLRegisterDialog } from '@/components/scan/MLRegisterDialog';
import { parseQRCode, ParsedQR } from '@/lib/qrParser';
import { CollectScanScreen } from '@/components/mobile/CollectScanScreen';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-orange-100 text-orange-800' },
  recogido: { label: 'Recogido', color: 'bg-green-100 text-green-800' },
  en_sucursal: { label: 'En Sucursal', color: 'bg-indigo-100 text-indigo-800' },
  en_transito: { label: 'En Tránsito', color: 'bg-cyan-100 text-cyan-800' },
  en_reparto: { label: 'En Reparto', color: 'bg-amber-100 text-amber-800' },
  entregado: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800' },
  devuelto: { label: 'Devuelto', color: 'bg-red-100 text-red-800' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
};

type ScanMode = 'pickup' | 'receive_center' | 'receive_branch' | 'receive_route_sheet' | 'branch_delivery' | null;

interface ScannedShipment {
  id: string;
  tracking_number: string;
  estado: string;
  requiere_retiro: boolean | null;
  direccion_retiro: string | null;
  ciudad_retiro: string | null;
  tipo_pago?: string | null;
  precio_total?: number;
  remitente?: {
    nombre: string;
    apellido: string | null;
    telefono: string;
  } | null;
  destinatario?: {
    nombre: string;
    apellido: string | null;
  } | null;
  sucursal_destino?: {
    nombre: string;
    ciudad: string | null;
  } | null;
  // ML Flex fields
  ml_shipment_id?: number | null;
  ml_order_id?: number | null;
  ml_sync_status?: string | null;
  nombre_destinatario?: string | null;
  direccion_entrega?: string | null;
  ciudad_entrega?: string | null;
  whatsapp_destinatario?: string | null;
  pago_contra_entrega?: boolean | null;
}

export default function ScanQR() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuth();

  const [manualTracking, setManualTracking] = useState('');
  const [scannedShipment, setScannedShipment] = useState<ScannedShipment | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>(null);
  const [showPickupConfirmation, setShowPickupConfirmation] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showBranchDeliveryDialog, setShowBranchDeliveryDialog] = useState(false);
  const [receiveType, setReceiveType] = useState<'center' | 'branch'>('center');
  const [duplicateShipment, setDuplicateShipment] = useState<ScannedShipment | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [routeSheetId, setRouteSheetId] = useState<string | null>(null);
  const [showMLDeliveryDialog, setShowMLDeliveryDialog] = useState(false);
  const [showMLRegisterDialog, setShowMLRegisterDialog] = useState(false);
  const [pendingMLData, setPendingMLData] = useState<{ mlShipmentId: string; mlSenderId?: string } | null>(null);
  const [showMassCollect, setShowMassCollect] = useState(false);

  // Role-based permissions
  const isDriver = hasRole('chofer');
  const isOperator = hasRole('operador') || hasRole('bodega') || hasRole('admin') || hasRole('supervisor');
  const isBranchOperator = hasRole('sucursal') || hasRole('despachador') || hasRole('bodega');

  const playBeepSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 1200;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch {
      // Audio not supported - silently ignore
    }
  };

  const playWarningSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const osc1 = audioContext.createOscillator();
      const gain1 = audioContext.createGain();
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.frequency.value = 400;
      osc1.type = 'square';
      gain1.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      osc1.start(audioContext.currentTime);
      osc1.stop(audioContext.currentTime + 0.15);
      
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 300;
      osc2.type = 'square';
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35);
      osc2.start(audioContext.currentTime + 0.2);
      osc2.stop(audioContext.currentTime + 0.35);
    } catch {
      // Audio not supported - silently ignore
    }
  };

  const handleScan = async (data: string, mode: ScanMode = null) => {
    playBeepSound();
    setShowScanner(false);
    
    // Check if it's a route sheet QR (format: HR:uuid)
    if (data.startsWith('HR:')) {
      const hrId = data.replace('HR:', '');
      setRouteSheetId(hrId);
      return;
    }
    
    // Parse QR code to detect type
    const parsed = parseQRCode(data);
    
    // Handle ML shipment ID
    if (parsed.type === 'ml_shipment') {
      await searchShipmentByML(parsed.value, parsed.mlSenderId, mode);
      return;
    }
    
    // Extract tracking number from QR (may contain URL)
    let trackingNumber = parsed.type === 'tracking' ? parsed.value : data;
    
    // If it's a URL, extract the tracking parameter (fallback for legacy)
    if (parsed.type === 'unknown' && data.includes('/tracking')) {
      const urlMatch = data.match(/[?&]q=([^&]+)/);
      if (urlMatch) {
        trackingNumber = urlMatch[1];
      }
    }
    
    // Remove bulto suffix if present (e.g., "TRK-001-01" -> "TRK-001")
    const baseTacking = trackingNumber.split('-').slice(0, -1).join('-') || trackingNumber;
    
    await searchShipment(baseTacking.includes('-') && !baseTacking.endsWith('-') ? trackingNumber.replace(/-\d{2}$/, '') : trackingNumber, mode);
  };

  const searchShipmentByML = async (mlShipmentId: string, mlSenderId: string | undefined, mode: ScanMode = null) => {
    setIsSearching(true);
    
    try {
      const { data: shipment, error } = await supabase
        .from('envios')
        .select(`
          id,
          tracking_number,
          estado,
          requiere_retiro,
          direccion_retiro,
          ciudad_retiro,
          tipo_pago,
          precio_total,
          ml_shipment_id,
          ml_order_id,
          ml_sync_status,
          nombre_destinatario,
          direccion_entrega,
          ciudad_entrega,
          whatsapp_destinatario,
          pago_contra_entrega,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido),
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre, ciudad)
        `)
        .eq('ml_shipment_id', parseInt(mlShipmentId))
        .maybeSingle();

      if (error) throw error;

      if (!shipment) {
        // Shipment not found - show registration dialog
        setPendingMLData({ mlShipmentId, mlSenderId });
        setShowMLRegisterDialog(true);
        setIsSearching(false);
        return;
      }

      setScannedShipment(shipment as ScannedShipment);
      
      // For ML shipments, show the ML delivery dialog
      setShowMLDeliveryDialog(true);
    } catch (error: any) {
      console.error('Error searching ML shipment:', error);
      toast.error('Error al buscar envío ML Flex');
    } finally {
      setIsSearching(false);
    }
  };

  const handleMLRegisterSuccess = (envio: any) => {
    setShowMLRegisterDialog(false);
    setPendingMLData(null);
    
    // Set the newly registered shipment and show delivery dialog
    setScannedShipment({
      id: envio.id,
      tracking_number: envio.tracking_number,
      estado: envio.estado,
      requiere_retiro: false,
      direccion_retiro: null,
      ciudad_retiro: null,
      ml_shipment_id: envio.ml_shipment_id,
      nombre_destinatario: envio.nombre_destinatario,
      direccion_entrega: envio.direccion_entrega,
      ciudad_entrega: envio.ciudad_entrega,
      whatsapp_destinatario: envio.whatsapp_destinatario,
      precio_total: envio.precio_total,
      pago_contra_entrega: false,
    });
    
    setShowMLDeliveryDialog(true);
  };

  const searchShipment = async (tracking: string, mode: ScanMode = null) => {
    setIsSearching(true);
    
    try {
      // First try exact match
      let { data: shipments, error } = await supabase
        .from('envios')
        .select(`
          id,
          tracking_number,
          estado,
          requiere_retiro,
          direccion_retiro,
          ciudad_retiro,
          tipo_pago,
          precio_total,
          remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono),
          destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido),
          sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre, ciudad)
        `)
        .ilike('tracking_number', tracking)
        .limit(1);

      // If not found, try partial match (removing suffix or searching with wildcard)
      if ((!shipments || shipments.length === 0) && !error) {
        const baseTracking = tracking.replace(/-\d{1,2}$/, '');
        const { data: partialShipments, error: partialError } = await supabase
          .from('envios')
          .select(`
            id,
            tracking_number,
            estado,
            requiere_retiro,
            direccion_retiro,
            ciudad_retiro,
            tipo_pago,
            precio_total,
            remitente:clientes!envios_remitente_id_fkey(nombre, apellido, telefono),
            destinatario:clientes!envios_destinatario_id_fkey(nombre, apellido),
            sucursal_destino:sucursales!envios_sucursal_destino_id_fkey(nombre, ciudad)
          `)
          .ilike('tracking_number', `${baseTracking}%`)
          .limit(1);
        
        if (!partialError && partialShipments && partialShipments.length > 0) {
          shipments = partialShipments;
        }
      }

      if (error) throw error;

      if (!shipments || shipments.length === 0) {
        toast.error('Envío no encontrado');
        setIsSearching(false);
        return;
      }

      const shipment = shipments[0] as ScannedShipment;
      setScannedShipment(shipment);

      handleShipmentAction(shipment, mode);
    } catch (error: any) {
      console.error('Error searching shipment:', error);
      toast.error('Error al buscar el envío');
    } finally {
      setIsSearching(false);
    }
  };

  const handleShipmentAction = (shipment: ScannedShipment, mode: ScanMode) => {
    // If specific mode was selected
    if (mode === 'pickup') {
      if (shipment.estado !== 'pendiente') {
        playWarningSound();
        setDuplicateShipment(shipment);
        return;
      }
      setShowPickupConfirmation(true);
      return;
    }
    
    if (mode === 'receive_center') {
      setReceiveType('center');
      setShowReceiveDialog(true);
      return;
    }
    
    if (mode === 'receive_branch') {
      setReceiveType('branch');
      setShowReceiveDialog(true);
      return;
    }

    if (mode === 'branch_delivery') {
      if (!['en_sucursal', 'en_transito'].includes(shipment.estado)) {
        playWarningSound();
        toast.error('Este envío no está listo para entregar', {
          description: `Estado actual: ${STATUS_CONFIG[shipment.estado]?.label || shipment.estado}`,
        });
        setDuplicateShipment(shipment);
        return;
      }
      setShowBranchDeliveryDialog(true);
      return;
    }

    // Auto-detect action based on shipment status and user role
    if (isDriver && shipment.requiere_retiro && shipment.estado === 'pendiente') {
      setShowPickupConfirmation(true);
    } else if (isOperator && ['recogido', 'pendiente'].includes(shipment.estado)) {
      setReceiveType('center');
      setShowReceiveDialog(true);
    } else if (isBranchOperator && ['en_sucursal', 'en_transito'].includes(shipment.estado)) {
      setReceiveType('branch');
      setShowReceiveDialog(true);
    } else if (isDriver) {
      // Para choferes: mostrar info del envío en lugar de redirigir
      toast.info(`Envío ${shipment.tracking_number}`, {
        description: `Estado: ${STATUS_CONFIG[shipment.estado]?.label || shipment.estado}`,
        duration: 5000,
      });
      setScannedShipment(shipment);
      // Mostrar el diálogo de duplicado/info con detalles
      setDuplicateShipment(shipment);
    } else {
      // Default para otros roles: show shipment details
      navigate(`/shipments?search=${shipment.tracking_number}`);
    }
  };

  const handleManualSearch = async () => {
    if (!manualTracking.trim()) {
      toast.error('Ingresa un número de tracking');
      return;
    }
    await searchShipment(manualTracking.trim().toUpperCase(), scanMode);
  };

  const handleQuickAction = (mode: ScanMode) => {
    setScanMode(mode);
    setShowScanner(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
          <QrCode className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Escanear Código QR</h1>
        <p className="text-muted-foreground">Gestión rápida de envíos con escaneo de QR</p>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Acciones Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Role-based action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {isDriver && (
              <Button
                onClick={() => handleQuickAction('pickup')}
                size="lg"
                className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 h-24 flex flex-col gap-2"
              >
                <Truck className="h-6 w-6" />
                <span className="font-bold">Colectar</span>
                <span className="text-xs opacity-80">Retiro en domicilio</span>
              </Button>
            )}

            {isDriver && (
              <Button
                onClick={() => setShowMassCollect(true)}
                size="lg"
                className="bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-700 hover:to-blue-600 h-24 flex flex-col gap-2"
              >
                <PackageCheck className="h-6 w-6" />
                <span className="font-bold">Colecta Masiva</span>
                <span className="text-xs opacity-80">Escanear y colectar varios</span>
              </Button>
            )}
            
            {isOperator && (
              <Button
                onClick={() => handleQuickAction('receive_center')}
                size="lg"
                className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 h-24 flex flex-col gap-2"
              >
                <Building2 className="h-6 w-6" />
                <span className="font-bold">Recibir en Centro</span>
                <span className="text-xs opacity-80">Centro logístico</span>
              </Button>
            )}
            
            {isBranchOperator && (
              <Button
                onClick={() => handleQuickAction('receive_branch')}
                size="lg"
                className="bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600 h-24 flex flex-col gap-2"
              >
                <Store className="h-6 w-6" />
                <span className="font-bold">Recibir en Sucursal</span>
                <span className="text-xs opacity-80">Punto de venta</span>
              </Button>
            )}

            {isBranchOperator && (
              <Button
                onClick={() => handleQuickAction('branch_delivery')}
                size="lg"
                className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 h-24 flex flex-col gap-2"
              >
                <PackageCheck className="h-6 w-6" />
                <span className="font-bold">Entregar a Cliente</span>
                <span className="text-xs opacity-80">Entrega en sucursal</span>
              </Button>
            )}

          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                o escanea libremente
              </span>
            </div>
          </div>

          {/* General Scan Button */}
          <Button
            onClick={() => {
              setScanMode(null);
              setShowScanner(true);
            }}
            size="lg"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-500 hover:from-blue-700 hover:to-purple-600"
          >
            <QrCode className="h-5 w-5 mr-2" />
            Escanear QR General
          </Button>

          {/* Manual Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Búsqueda Manual</label>
            <div className="flex gap-2">
              <Input
                placeholder="Ingresa tracking..."
                value={manualTracking}
                onChange={(e) => setManualTracking(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
                className="font-mono"
              />
              <Button 
                onClick={handleManualSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Alert */}
      <Alert>
        <QrCode className="h-4 w-4" />
        <AlertDescription>
          <strong>💡 Cómo usar:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
            <li>Usa los botones de acción rápida para escanear con un propósito específico</li>
            <li>O escanea libremente y el sistema determinará la acción según tu rol</li>
            <li>También puedes ingresar el tracking manualmente</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScan={(data) => handleScan(data, scanMode)}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Pickup Confirmation Dialog */}
      {showPickupConfirmation && scannedShipment && (
        <PickupConfirmation
          shipment={scannedShipment}
          onClose={() => {
            setShowPickupConfirmation(false);
            setScannedShipment(null);
          }}
          onSuccess={() => {
            setScannedShipment(null);
            queryClient.invalidateQueries({ queryKey: ['envios'] });
          }}
        />
      )}

      {/* Receive Shipment Dialog */}
      {showReceiveDialog && scannedShipment && (
        <ReceiveShipmentDialog
          shipment={scannedShipment}
          type={receiveType}
          onClose={() => {
            setShowReceiveDialog(false);
            setScannedShipment(null);
          }}
          onSuccess={() => {
            setScannedShipment(null);
            queryClient.invalidateQueries({ queryKey: ['envios'] });
          }}
        />
      )}

      {/* Branch Delivery Dialog */}
      <BranchDeliveryDialog
        open={showBranchDeliveryDialog && !!scannedShipment}
        shipment={scannedShipment ? {
          id: scannedShipment.id,
          tracking_number: scannedShipment.tracking_number,
          tipo_pago: scannedShipment.tipo_pago,
          precio_total: scannedShipment.precio_total || 0,
          destinatario: scannedShipment.destinatario,
        } : null}
        onClose={() => {
          setShowBranchDeliveryDialog(false);
          setScannedShipment(null);
        }}
        onSuccess={() => {
          setShowBranchDeliveryDialog(false);
          setScannedShipment(null);
          queryClient.invalidateQueries({ queryKey: ['envios'] });
        }}
      />

      {/* Duplicate/Already Processed Alert */}
      {duplicateShipment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                {isDriver ? 'Información del Envío' : 'Envío Ya Procesado'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <Badge variant="outline" className="font-mono text-lg px-4 py-2">
                  {duplicateShipment.tracking_number}
                </Badge>
              </div>
              
              <div className="flex items-center justify-center gap-2">
                <span className="text-muted-foreground">Estado actual:</span>
                <Badge className={STATUS_CONFIG[duplicateShipment.estado]?.color}>
                  {STATUS_CONFIG[duplicateShipment.estado]?.label || duplicateShipment.estado}
                </Badge>
              </div>

              <p className="text-center text-muted-foreground text-sm">
                {isDriver 
                  ? 'Este envío no requiere retiro o ya fue procesado anteriormente.'
                  : 'Este envío ya fue procesado y no puede ser retirado nuevamente.'}
              </p>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setDuplicateShipment(null)}
                >
                  Cerrar
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => {
                    navigate(`/shipments?search=${duplicateShipment.tracking_number}`);
                    setDuplicateShipment(null);
                  }}
                >
                  Ver Detalles
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Route Sheet Receive Dialog */}
      <ReceiveRouteSheetDialog
        hojaRutaId={routeSheetId}
        onClose={() => {
          setRouteSheetId(null);
          queryClient.invalidateQueries({ queryKey: ['envios'] });
        }}
      />

      {/* ML Delivery Dialog */}
      {showMLDeliveryDialog && scannedShipment && scannedShipment.ml_shipment_id && (
        <MLDeliveryDialog
          open={showMLDeliveryDialog}
          shipment={{
            id: scannedShipment.id,
            tracking_number: scannedShipment.tracking_number,
            estado: scannedShipment.estado,
            ml_shipment_id: scannedShipment.ml_shipment_id,
            ml_order_id: scannedShipment.ml_order_id,
            ml_sync_status: scannedShipment.ml_sync_status,
            nombre_destinatario: scannedShipment.nombre_destinatario,
            direccion_entrega: scannedShipment.direccion_entrega,
            ciudad_entrega: scannedShipment.ciudad_entrega,
            whatsapp_destinatario: scannedShipment.whatsapp_destinatario,
            precio_total: scannedShipment.precio_total || 0,
            pago_contra_entrega: scannedShipment.pago_contra_entrega,
            destinatario: scannedShipment.destinatario,
          }}
          onClose={() => {
            setShowMLDeliveryDialog(false);
            setScannedShipment(null);
          }}
          onSuccess={() => {
            setShowMLDeliveryDialog(false);
            setScannedShipment(null);
            queryClient.invalidateQueries({ queryKey: ['envios'] });
          }}
        />
      )}

      {/* ML Register Dialog - for unregistered ML shipments */}
      {showMLRegisterDialog && pendingMLData && (
        <MLRegisterDialog
          open={showMLRegisterDialog}
          mlShipmentId={pendingMLData.mlShipmentId}
          mlSenderId={pendingMLData.mlSenderId}
          userId={user?.id}
          onClose={() => {
            setShowMLRegisterDialog(false);
            setPendingMLData(null);
          }}
          onSuccess={handleMLRegisterSuccess}
        />
      )}

      {/* Mass Collect Overlay */}
      {showMassCollect && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="flex flex-col h-full p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Colecta Masiva</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowMassCollect(false)}>
                Cerrar
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <CollectScanScreen onClose={() => setShowMassCollect(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
