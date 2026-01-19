import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Button } from '@/components/ui/button';
import { X, Camera, SwitchCamera, Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useNativePlatform } from '@/hooks/useNativePlatform';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [showOpenSettings, setShowOpenSettings] = useState(false);
  const [installingModule, setInstallingModule] = useState(false);
  const [webStarted, setWebStarted] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scanningRef = useRef(false);
  
  // Use centralized native platform detection
  const { isNative, isAndroid, platform } = useNativePlatform();

  useEffect(() => {
    console.log('[QRScanner] Detection details:', {
      platform,
      isNative,
      isAndroid,
      userAgent: navigator.userAgent.substring(0, 100),
      href: window.location.href,
    });
    // More detailed toast for debugging
    toast.info(`Plataforma: ${platform}, Nativo: ${isNative}, Android: ${isAndroid}`);

    if (isNative) {
      initNativeScanner();
    } else {
      // On web, require an explicit user action to trigger camera permissions reliably
      setIsLoading(false);
      setError(null);
      setShowOpenSettings(false);
    }

    return () => {
      scanningRef.current = false;
      if (!isNative) {
        stopWebScanner();
      }
    };
  }, [isNative, platform, isAndroid]);

  // Native scanner using ML Kit
  const initNativeScanner = async () => {
    let scanTimeout: NodeJS.Timeout | null = null;
    
    try {
      setIsLoading(true);
      console.log('[QRScanner] Initializing native scanner...');
      toast.info('Iniciando escáner nativo...');
      
      // Check if barcode scanning is supported
      toast.info('Verificando soporte del dispositivo...');
      const { supported } = await BarcodeScanner.isSupported();
      console.log('[QRScanner] BarcodeScanner supported:', supported);
      
      if (!supported) {
        const errorMsg = 'El escaneo de códigos no está soportado en este dispositivo';
        toast.error(errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        return;
      }
      
      toast.success('Dispositivo soportado ✓');

      // For Android: Check if Google Barcode Scanner module is available
      // IMPORTANT: Check isAndroid again here since platform detection might have changed
      console.log('[QRScanner] Checking Android module, isAndroid:', isAndroid, 'platform:', platform);
      if (isAndroid) {
        try {
          toast.info('Verificando módulo ML Kit (Android)...');
          const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
          console.log('[QRScanner] Google Barcode Scanner module available:', available);
          
          if (!available) {
            setInstallingModule(true);
            toast.info('Instalando módulo de escaneo... Esto puede tardar unos segundos.');
            console.log('[QRScanner] Installing Google Barcode Scanner module...');
            
            // Listen to installation progress
            await BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', (event) => {
              console.log('[QRScanner] Module install progress:', event.progress, '%');
              toast.info(`Instalando: ${event.progress}%`);
            });
            
            await BarcodeScanner.installGoogleBarcodeScannerModule();
            console.log('[QRScanner] Module installed successfully');
            toast.success('Módulo instalado correctamente ✓');
            setInstallingModule(false);
          } else {
            toast.success('Módulo ML Kit disponible ✓');
          }
        } catch (moduleError: any) {
          console.error('[QRScanner] Error checking/installing module:', moduleError);
          toast.error(`Error módulo: ${moduleError?.message || 'Error desconocido'}`);
          // Continue anyway, might work
        }
      }
      
      // Check and request permissions
      toast.info('Verificando permisos de cámara...');
      const permissionStatus = await BarcodeScanner.checkPermissions();
      console.log('[QRScanner] Current permission status:', permissionStatus);
      
      if (permissionStatus.camera !== 'granted') {
        toast.info('Solicitando permiso de cámara...');
        const { camera } = await BarcodeScanner.requestPermissions();
        console.log('[QRScanner] Permission request result:', camera);
        
        if (camera === 'denied') {
          const errorMsg = 'Permiso de cámara denegado. Abre la configuración para habilitarlo.';
          toast.error(errorMsg);
          setError(errorMsg);
          setShowOpenSettings(true);
          setIsLoading(false);
          return;
        }
        
        if (camera !== 'granted') {
          const errorMsg = 'Se requiere permiso de cámara para escanear códigos QR';
          toast.error(errorMsg);
          setError(errorMsg);
          setIsLoading(false);
          return;
        }
      }
      
      toast.success('Permisos concedidos ✓');

      setIsLoading(false);
      setIsScanning(true);
      scanningRef.current = true;
      
      console.log('[QRScanner] Starting scan...');
      toast.info('Abriendo cámara... Apunta hacia el código QR');
      
      // Set timeout for security - if scanner doesn't respond in 15 seconds
      scanTimeout = setTimeout(() => {
        console.error('[QRScanner] Scan timeout - scanner not responding');
        toast.error('El escáner está tardando mucho. Verifica Google Play Services.');
        setError('Timeout: El escáner no respondió después de 15 segundos');
        setIsLoading(false);
        setIsScanning(false);
      }, 15000);
      
      // Use scan() method - opens native scanner UI
      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode],
      });
      
      // Clear timeout if scan completed
      if (scanTimeout) {
        clearTimeout(scanTimeout);
        scanTimeout = null;
      }
      
      console.log('[QRScanner] Scan result:', barcodes);
      
      if (barcodes.length > 0 && barcodes[0].rawValue) {
        toast.success(`Código escaneado: ${barcodes[0].rawValue.substring(0, 20)}...`);
        onScan(barcodes[0].rawValue);
      } else {
        toast.info('Escaneo cancelado');
        onClose();
      }
    } catch (err: any) {
      // Clear timeout if error occurred
      if (scanTimeout) {
        clearTimeout(scanTimeout);
        scanTimeout = null;
      }
      
      console.error('[QRScanner] Error in native scanner:', err);
      
      const errorMessage = err?.message || err?.toString() || 'Error desconocido';
      console.error('[QRScanner] Error message:', errorMessage);
      console.error('[QRScanner] Error code:', err?.code);
      console.error('[QRScanner] Full error object:', JSON.stringify(err, null, 2));
      
      // Check if user cancelled
      if (err?.message?.includes('cancel') || err?.code === 'USER_CANCELED') {
        toast.info('Escaneo cancelado por el usuario');
        onClose();
        return;
      }
      
      // Fallback to web scanner if native fails
      console.log('[QRScanner] Native scanner failed, falling back to web scanner...');
      toast.warning('Escáner nativo falló, usando alternativa web...');
      setError(null);
      await initWebScanner();
    }
  };

  const openSettings = async () => {
    try {
      await BarcodeScanner.openSettings();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[QRScanner] Error opening settings:', err);
      }
    }
  };

  // Wait for qr-reader element to exist in DOM
  const waitForQrReaderElement = async (maxAttempts = 20): Promise<HTMLElement | null> => {
    for (let i = 0; i < maxAttempts; i++) {
      const element = document.getElementById('qr-reader');
      if (element) {
        console.log('[QRScanner] qr-reader element found after', i + 1, 'attempts');
        return element;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.error('[QRScanner] qr-reader element not found after', maxAttempts, 'attempts');
    return null;
  };

  // Web scanner using html5-qrcode
  const initWebScanner = async () => {
    try {
      setIsLoading(true);
      console.log('[QRScanner] Initializing web scanner...');

      if (!window.isSecureContext) {
        setError('La cámara solo funciona en una conexión segura (HTTPS).');
        setIsLoading(false);
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Tu navegador no soporta acceso a cámara (getUserMedia).');
        setIsLoading(false);
        return;
      }

      // First, request camera permission explicitly before listing devices
      let stream: MediaStream | null = null;
      try {
        console.log('[QRScanner] Requesting camera permission...');

        // Try back camera first (best for QR)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
          });
        } catch (firstErr: any) {
          // Fallback: any camera (some devices/browsers fail with facingMode constraints)
          console.warn('[QRScanner] Back camera constraint failed, retrying with video:true', firstErr);
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        // Stop the stream immediately - we just needed to trigger permission prompt
        stream.getTracks().forEach((track) => track.stop());
        console.log('[QRScanner] Camera permission granted');
      } catch (permErr: any) {
        console.error('[QRScanner] Camera permission error:', permErr);

        if (permErr?.name === 'NotAllowedError' || permErr?.name === 'PermissionDeniedError') {
          setError('Permiso de cámara denegado. En Chrome: candado → Permisos → Cámara → Permitir.');
        } else if (permErr?.name === 'NotFoundError') {
          setError('No se encontró ninguna cámara en el dispositivo.');
        } else if (permErr?.name === 'NotReadableError') {
          setError('La cámara está en uso por otra app o no está disponible en este momento.');
        } else {
          setError(`Error al acceder a la cámara: ${permErr?.message || permErr?.name || 'desconocido'}`);
        }

        setIsLoading(false);
        return;
      }

      // Now list cameras after permission is granted
      const devices = await Html5Qrcode.getCameras();
      console.log('[QRScanner] Cameras found:', devices.length);

      if (devices && devices.length) {
        setCameras(devices);
        // Prefer back camera
        const backCameraIndex = devices.findIndex(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('trasera') ||
          d.label.toLowerCase().includes('posterior') ||
          d.label.toLowerCase().includes('rear')
        );
        const startIndex = backCameraIndex >= 0 ? backCameraIndex : 0;
        setCurrentCameraIndex(startIndex);

        // Wait for qr-reader element to exist
        const containerEl = await waitForQrReaderElement();
        if (!containerEl) {
          setError('No se pudo inicializar la cámara. Recarga la página e intenta de nuevo.');
          setIsLoading(false);
          return;
        }

        scannerRef.current = new Html5Qrcode('qr-reader');
        setIsLoading(false); // Set loading false BEFORE starting camera so container is visible
        await startWebCamera(devices[startIndex].id);
      } else {
        setError('No se encontraron cámaras disponibles');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[QRScanner] Error initializing web scanner:', err);
      setError(`Error al inicializar el escáner: ${err.message || 'Error desconocido'}`);
      setIsLoading(false);
    }
  };

  const startWebCamera = async (cameraId: string) => {
    if (!scannerRef.current) return;

    try {
      const state = scannerRef.current.getState();
      if (state === Html5QrcodeScannerState.SCANNING) {
        await scannerRef.current.stop();
      }

      await scannerRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          onScan(decodedText);
        },
        () => {} // Ignore errors during scanning
      );
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[QRScanner] Error starting web camera:', err);
      }
      setError('Error al iniciar la cámara');
    }
  };

  const stopWebScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[QRScanner] Error stopping web scanner:', err);
        }
      }
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startWebCamera(cameras[nextIndex].id);
  };

  const handleStartWebScanner = async () => {
    setError(null);
    setShowOpenSettings(false);
    setWebStarted(true);
    // Espera un tick para que se renderice #qr-reader antes de inicializar html5-qrcode
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    await initWebScanner();
  };

  const handleClose = async () => {
    scanningRef.current = false;
    onClose();
  };

  return (
    <div id="barcode-scanner-container" className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <div className="flex items-center gap-2 text-white">
          <Camera className="h-5 w-5" />
          <span className="font-medium">Escáner QR</span>
          {/* Debug: show platform only in dev */}
          {import.meta.env.DEV && (
            <span className="text-xs text-white/50 ml-2">({platform})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNative && cameras.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={switchCamera}
              className="text-white hover:bg-white/20"
            >
              <SwitchCamera className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm">
          {/* Always render qr-reader container for web scanner - visibility controlled by className */}
          {!isNative && (
            <div 
              id="qr-reader" 
              ref={containerRef}
              className={`w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 ${
                (isLoading || !webStarted || error) ? 'hidden' : ''
              }`}
            />
          )}

          {isLoading || installingModule ? (
            <div className="text-center text-white p-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>{installingModule ? 'Instalando módulo de escaneo...' : 'Iniciando cámara...'}</p>
            </div>
          ) : error ? (
            <div className="text-center text-white p-8">
              <p className="text-red-400 mb-4">{error}</p>

              {showOpenSettings && (
                <Button onClick={openSettings} variant="outline" className="mb-2">
                  <Settings className="h-4 w-4 mr-2" />
                  Abrir Configuración
                </Button>
              )}

              {!isNative && (
                <Button onClick={handleStartWebScanner} variant="outline" className="mb-2">
                  Reintentar cámara
                </Button>
              )}

              <div className="text-xs text-white/60 mb-4">
                {!isNative && (
                  <p>
                    Tip: en Chrome → Ajustes del sitio → Cámara → Permitir.
                  </p>
                )}
              </div>

              <div>
                <Button onClick={handleClose} variant="ghost" className="text-white">
                  Cerrar
                </Button>
              </div>
            </div>
          ) : isNative ? (
            // Native scanner - shows message while native camera is active
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-white">
                {isScanning ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="mb-2">Escáner activo</p>
                    <p className="text-sm text-white/70">Apunta hacia el código QR</p>
                  </>
                ) : (
                  <>
                    <p className="mb-4">Preparando escáner...</p>
                    <Button 
                      onClick={handleStartWebScanner} 
                      variant="outline" 
                      className="text-white border-white/30"
                    >
                      Usar cámara web (alternativa)
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {!webStarted ? (
                <div className="text-center text-white p-8">
                  <p className="mb-4 text-white/80">
                    Para escanear, primero debemos pedir permiso de cámara.
                  </p>
                  <Button onClick={handleStartWebScanner} className="w-full">
                    Activar cámara
                  </Button>
                </div>
              ) : (
                /* Camera is active - qr-reader div is visible above */
                <div className="text-center text-white/60 text-sm mt-4">
                  <p>Apunta hacia el código QR</p>
                </div>
              )}
            </>
          )}

          {/* Scan frame overlay for active scanning */}
          {!isNative && webStarted && !isLoading && !error && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-primary/50 rounded-xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 text-center">
        <p className="text-white/70 text-sm">
          Coloca el código QR dentro del recuadro
        </p>
      </div>
    </div>
  );
}
