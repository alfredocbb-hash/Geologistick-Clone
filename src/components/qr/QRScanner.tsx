import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { BarcodeScanner, BarcodeFormat, LensFacing } from '@capacitor-mlkit/barcode-scanning';
import { Button } from '@/components/ui/button';
import { X, Camera, SwitchCamera, Loader2, Settings, RefreshCw, Globe, Smartphone, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useNativePlatform } from '@/hooks/useNativePlatform';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  continuousMode?: boolean;
  scannedCount?: number;
}

type NativeStep = 
  | 'idle'
  | 'checking_support'
  | 'checking_module'
  | 'installing_module'
  | 'checking_permissions'
  | 'requesting_permissions'
  | 'starting_scan'
  | 'scanning'
  | 'error';

// Helper function to add timeout to any promise
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`TIMEOUT: ${errorMsg}`)), ms)
    )
  ]);
}

export default function QRScanner({ onScan, onClose, continuousMode = false, scannedCount = 0 }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showOpenSettings, setShowOpenSettings] = useState(false);
  const [webStarted, setWebStarted] = useState(false);
  const [forceWebScanner, setForceWebScanner] = useState(false);
  const [nativeStep, setNativeStep] = useState<NativeStep>('idle');
  const [usingStartScan, setUsingStartScan] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scanningRef = useRef(false);
  const listenerCleanupRef = useRef<(() => void) | null>(null);
  const scanCooldownRef = useRef(false);
  const scannedCodesRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const autoFallbackTriggeredRef = useRef(false);
  
  // Ref to always have the latest onScan callback (avoids stale closures in continuous mode)
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  // Beep sound using AudioContext oscillator (works on all platforms)
  const playBeepSound = useCallback(() => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(1800, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.warn('[QRScanner] Could not play beep:', e);
    }
  }, []);
  
  // Use centralized native platform detection
  const { isNative, isAndroid, isIOS, platform } = useNativePlatform();
  
  // KEY CHANGE: On Android native, start with web scanner by default to avoid hanging
  // The native scanner can be tried via button if user wants
  const shouldStartWithWeb = isAndroid && isNative;
  
  // Determine if we should use native scanner
  const shouldUseNative = isNative && !forceWebScanner && !shouldStartWithWeb;

  // Timer for elapsed seconds and auto-fallback
  useEffect(() => {
    if (!isLoading) {
      setElapsedSeconds(0);
      return;
    }
    
    const interval = setInterval(() => {
      setElapsedSeconds(prev => {
        const newVal = prev + 1;
        
        // Auto-fallback after 6 seconds if still loading and on Android native
        if (newVal >= 6 && isAndroid && isNative && !forceWebScanner && !autoFallbackTriggeredRef.current) {
          console.log('[QRScanner] Auto-fallback triggered after 6s');
          autoFallbackTriggeredRef.current = true;
          // Trigger fallback
          handleAutoFallbackToWeb();
        }
        
        return newVal;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isLoading, isAndroid, isNative, forceWebScanner]);

  // Auto-fallback handler
  const handleAutoFallbackToWeb = useCallback(async () => {
    console.log('[QRScanner] Executing auto-fallback to web scanner');
    toast.info('Cambiando a cámara alternativa automáticamente...');
    
    // Cleanup any native scanner attempt
    document.body.classList.remove('barcode-scanner-active');
    try {
      await BarcodeScanner.removeAllListeners();
      await BarcodeScanner.stopScan();
    } catch (e) {
      console.warn('[QRScanner] Error during auto-fallback cleanup:', e);
    }
    
    setForceWebScanner(true);
    setError(null);
    setNativeStep('idle');
    setIsLoading(false);
    setWebStarted(false);
  }, []);

  // Cleanup function for native scanner
  const cleanupNativeScanner = useCallback(async () => {
    console.log('[QRScanner] Cleaning up native scanner...');
    
    // Remove body class for startScan visibility
    document.body.classList.remove('barcode-scanner-active');
    
    // Remove listeners
    if (listenerCleanupRef.current) {
      listenerCleanupRef.current();
      listenerCleanupRef.current = null;
    }
    
    try {
      await BarcodeScanner.removeAllListeners();
    } catch (e) {
      console.warn('[QRScanner] Error removing listeners:', e);
    }
    
    // Stop scan if active
    if (usingStartScan) {
      try {
        await BarcodeScanner.stopScan();
      } catch (e) {
        console.warn('[QRScanner] Error stopping scan:', e);
      }
    }
    
    setUsingStartScan(false);
    scanningRef.current = false;
  }, [usingStartScan]);

  useEffect(() => {
    console.log('[QRScanner] Detection details:', {
      platform,
      isNative,
      isAndroid,
      isIOS,
      shouldUseNative,
      shouldStartWithWeb,
      forceWebScanner,
      userAgent: navigator.userAgent.substring(0, 100),
      href: window.location.href,
    });
    
    // (debug toast removed for production)

    // Reset auto-fallback flag on mode change
    autoFallbackTriggeredRef.current = false;

    if (shouldStartWithWeb && !forceWebScanner) {
      // Android native: Start with web scanner automatically (skip native that hangs)
      console.log('[QRScanner] Android native detected - auto-starting web scanner');
      setForceWebScanner(true);
      setWebStarted(true);
      setIsLoading(true);
      setError(null);
      setShowOpenSettings(false);
      // Auto-init web scanner after DOM updates with the new state
      setTimeout(() => initWebScanner(), 200);
    } else if (shouldUseNative) {
      initNativeScannerWithStartScan();
    } else {
      // On web or forced web mode
      setIsLoading(false);
      setError(null);
      setShowOpenSettings(false);
    }

    return () => {
      scanningRef.current = false;
      if (shouldUseNative) {
        cleanupNativeScanner();
      } else {
        stopWebScanner();
      }
    };
  }, [shouldUseNative, shouldStartWithWeb, platform, isAndroid, forceWebScanner]);

  // Native scanner using startScan() - camera behind WebView (more reliable)
  const initNativeScannerWithStartScan = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[QRScanner] Initializing native scanner with startScan()...');
      
      // Step 1: Check support with timeout
      setNativeStep('checking_support');
      toast.info('Verificando soporte...');
      
      const { supported } = await withTimeout(
        BarcodeScanner.isSupported(),
        8000,
        'isSupported() no respondió'
      );
      
      console.log('[QRScanner] BarcodeScanner supported:', supported);
      
      if (!supported) {
        throw new Error('El escaneo de códigos no está soportado en este dispositivo');
      }
      
      toast.success('Dispositivo soportado ✓');

      // Step 2: For Android, check ML Kit module with timeout
      if (isAndroid) {
        setNativeStep('checking_module');
        toast.info('Verificando módulo ML Kit...');
        
        try {
          const { available } = await withTimeout(
            BarcodeScanner.isGoogleBarcodeScannerModuleAvailable(),
            10000,
            'Verificación de módulo no respondió'
          );
          
          console.log('[QRScanner] Google Barcode Scanner module available:', available);
          
          if (!available) {
            setNativeStep('installing_module');
            toast.info('Instalando módulo de escaneo...');
            
            // Add progress listener
            await BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', (event) => {
              console.log('[QRScanner] Module install progress:', event.progress, '%');
              toast.info(`Instalando: ${event.progress}%`);
            });
            
            await withTimeout(
              BarcodeScanner.installGoogleBarcodeScannerModule(),
              60000, // 60s for install
              'Instalación del módulo tardó demasiado'
            );
            
            toast.success('Módulo instalado ✓');
          } else {
            toast.success('Módulo ML Kit disponible ✓');
          }
        } catch (moduleError: any) {
          console.error('[QRScanner] Module error:', moduleError);
          // Don't fail completely - try to continue
          toast.warning('Advertencia: Error con módulo ML Kit, intentando continuar...');
        }
      }
      
      // Step 3: Check permissions with timeout
      setNativeStep('checking_permissions');
      toast.info('Verificando permisos...');
      
      const permissionStatus = await withTimeout(
        BarcodeScanner.checkPermissions(),
        8000,
        'Verificación de permisos no respondió'
      );
      
      console.log('[QRScanner] Permission status:', permissionStatus);
      
      if (permissionStatus.camera !== 'granted') {
        setNativeStep('requesting_permissions');
        toast.info('Solicitando permiso de cámara...');
        
        const { camera } = await withTimeout(
          BarcodeScanner.requestPermissions(),
          15000,
          'Solicitud de permisos no respondió'
        );
        
        console.log('[QRScanner] Permission request result:', camera);
        
        if (camera === 'denied') {
          setError('Permiso de cámara denegado. Abre la configuración para habilitarlo.');
          setShowOpenSettings(true);
          setIsLoading(false);
          setNativeStep('error');
          return;
        }
        
        if (camera !== 'granted') {
          setError('Se requiere permiso de cámara para escanear códigos QR');
          setIsLoading(false);
          setNativeStep('error');
          return;
        }
      }
      
      toast.success('Permisos concedidos ✓');

      // Step 4: Start scanning with startScan() - camera behind WebView
      setNativeStep('starting_scan');
      toast.info('Iniciando cámara...');
      
      // Add body class to make WebView transparent and show camera
      document.body.classList.add('barcode-scanner-active');
      
      // Set up barcode listener BEFORE starting scan - use barcodesScanned (plural) event
      const barcodeListener = await BarcodeScanner.addListener('barcodesScanned', async (event) => {
        console.log('[QRScanner] Barcodes scanned:', event);
        
        const barcode = event.barcodes?.[0];
        if (barcode?.rawValue) {
          if (continuousMode) {
            if (scannedCodesRef.current.has(barcode.rawValue) || scanCooldownRef.current) return;
            scannedCodesRef.current.add(barcode.rawValue);
            scanCooldownRef.current = true;
            setTimeout(() => { scanCooldownRef.current = false; }, 2000);
            try { navigator.vibrate?.(200); } catch(e) {}
            playBeepSound();
            onScanRef.current(barcode.rawValue);
          } else {
            await cleanupNativeScanner();
            toast.success(`Código escaneado: ${barcode.rawValue.substring(0, 20)}...`);
            onScanRef.current(barcode.rawValue);
          }
        }
      });
      
      // Set up error listener
      const errorListener = await BarcodeScanner.addListener('scanError', async (error) => {
        console.error('[QRScanner] Scan error:', error);
        await cleanupNativeScanner();
        setError(`Error de escaneo: ${error.message || 'Error desconocido'}`);
        setNativeStep('error');
      });
      
      // Store cleanup function
      listenerCleanupRef.current = () => {
        barcodeListener.remove();
        errorListener.remove();
      };
      
      // Start the scan with timeout
      setUsingStartScan(true);
      scanningRef.current = true;
      
      await withTimeout(
        BarcodeScanner.startScan({
          formats: [BarcodeFormat.QrCode],
          lensFacing: LensFacing.Back,
        }),
        12000,
        'startScan() no respondió'
      );
      
      console.log('[QRScanner] startScan() initiated successfully');
      setIsLoading(false);
      setNativeStep('scanning');
      toast.success('Cámara activa - Apunta al QR');
      
    } catch (err: any) {
      console.error('[QRScanner] Error in native scanner:', err);
      
      // Cleanup on error
      await cleanupNativeScanner();
      
      const errorMessage = err?.message || err?.toString() || 'Error desconocido';
      
      // Check if user cancelled
      if (errorMessage.includes('cancel') || err?.code === 'USER_CANCELED') {
        toast.info('Escaneo cancelado');
        onClose();
        return;
      }
      
      // Check if it's a timeout
      if (errorMessage.includes('TIMEOUT')) {
        setError(`El escáner tardó demasiado en responder. Prueba con "Cámara alternativa".`);
        toast.error('Timeout: El escáner no respondió');
      } else {
        setError(`Error del escáner: ${errorMessage}`);
        toast.error(`Error: ${errorMessage}`);
      }
      
      setNativeStep('error');
      setIsLoading(false);
    }
  };

  // Retry native scanner
  const handleRetryNative = async () => {
    setError(null);
    setNativeStep('idle');
    setForceWebScanner(false);
    autoFallbackTriggeredRef.current = false;
    await initNativeScannerWithStartScan();
  };

  // Switch to web scanner (fallback)
  const handleUseWebFallback = async () => {
    console.log('[QRScanner] Switching to web scanner fallback');
    await cleanupNativeScanner();
    setForceWebScanner(true);
    setError(null);
    setNativeStep('idle');
    setIsLoading(false);
    setWebStarted(false);
  };

  const openSettings = async () => {
    try {
      await BarcodeScanner.openSettings();
    } catch (err) {
      console.error('[QRScanner] Error opening settings:', err);
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

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
          });
        } catch (firstErr: any) {
          console.warn('[QRScanner] Back camera constraint failed, retrying with video:true', firstErr);
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        stream.getTracks().forEach((track) => track.stop());
        console.log('[QRScanner] Camera permission granted');
      } catch (permErr: any) {
        console.error('[QRScanner] Camera permission error:', permErr);

        if (permErr?.name === 'NotAllowedError' || permErr?.name === 'PermissionDeniedError') {
          setError('Permiso de cámara denegado. En Chrome: candado → Permisos → Cámara → Permitir.');
        } else if (permErr?.name === 'NotFoundError') {
          setError('No se encontró ninguna cámara en el dispositivo.');
        } else if (permErr?.name === 'NotReadableError') {
          setError('La cámara está en uso por otra app o no está disponible.');
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
        const backCameraIndex = devices.findIndex(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('trasera') ||
          d.label.toLowerCase().includes('posterior') ||
          d.label.toLowerCase().includes('rear')
        );
        const startIndex = backCameraIndex >= 0 ? backCameraIndex : 0;
        setCurrentCameraIndex(startIndex);

        const containerEl = await waitForQrReaderElement();
        if (!containerEl) {
          setError('No se pudo inicializar la cámara. Recarga e intenta de nuevo.');
          setIsLoading(false);
          return;
        }

        scannerRef.current = new Html5Qrcode('qr-reader');
        setIsLoading(false);
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
          if (continuousMode) {
            if (scannedCodesRef.current.has(decodedText) || scanCooldownRef.current) return;
            scannedCodesRef.current.add(decodedText);
            scanCooldownRef.current = true;
            setTimeout(() => { scanCooldownRef.current = false; }, 2000);
            try { navigator.vibrate?.(200); } catch(e) {}
            playBeepSound();
            onScanRef.current(decodedText);
          } else {
            onScanRef.current(decodedText);
          }
        },
        () => {}
      );
    } catch (err) {
      console.error('[QRScanner] Error starting web camera:', err);
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
        console.error('[QRScanner] Error stopping web scanner:', err);
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
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    await initWebScanner();
  };

  const handleClose = async () => {
    scanningRef.current = false;
    if (shouldUseNative) {
      await cleanupNativeScanner();
    }
    onClose();
  };

  // Get step description for UI
  const getStepDescription = (): string => {
    switch (nativeStep) {
      case 'checking_support': return 'Verificando soporte...';
      case 'checking_module': return 'Verificando módulo ML Kit...';
      case 'installing_module': return 'Instalando módulo de escaneo...';
      case 'checking_permissions': return 'Verificando permisos...';
      case 'requesting_permissions': return 'Solicitando permisos...';
      case 'starting_scan': return 'Iniciando cámara...';
      case 'scanning': return 'Escaneando...';
      default: return 'Iniciando...';
    }
  };

  // Determine background style based on scanning mode
  const containerBackground = usingStartScan && nativeStep === 'scanning' 
    ? 'transparent' 
    : 'bg-black/90';

  // Check if we're in Android native mode (for showing diagnostics option)
  const showNativeOption = isAndroid && isNative;

  return (
    <div 
      id="barcode-scanner-container" 
      className={`fixed inset-0 ${containerBackground} z-50 flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/70">
        <div className="flex items-center gap-2 text-white">
          <Camera className="h-5 w-5" />
          <span className="font-medium">Escáner QR</span>
          {continuousMode && scannedCount > 0 && (
            <span className="flex-shrink-0 bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full">
              {scannedCount} ✓
            </span>
          )}
          <span className="text-xs text-white/50 ml-2">
            ({forceWebScanner ? 'web' : platform})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!shouldUseNative && cameras.length > 1 && (
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
      <div className="flex-1 flex items-start justify-center pt-6 px-4">
        <div className="relative w-full max-w-sm">
          {/* Web scanner container */}
          {!shouldUseNative && (
            <div 
              id="qr-reader" 
              ref={containerRef}
              className={`w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 ${
                (isLoading || !webStarted || error) ? 'hidden' : ''
              }`}
            />
          )}

          {isLoading ? (
            <div className="text-center text-white p-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="mb-2">{getStepDescription()}</p>
              <p className="text-xs text-white/60 mb-4">
                {elapsedSeconds > 0 ? `${elapsedSeconds}s...` : 'Esto puede tardar unos segundos...'}
              </p>
              
              {/* Show fallback buttons even during loading */}
              <div className="flex flex-col gap-2 mt-4">
                <Button 
                  onClick={handleUseWebFallback} 
                  variant="outline" 
                  size="sm"
                  className="text-white border-white/30"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Usar cámara alternativa (web)
                </Button>
                <Button 
                  onClick={handleClose} 
                  variant="ghost" 
                  size="sm"
                  className="text-white/70"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : error ? (
            <div className="text-center text-white p-8">
              <p className="text-red-400 mb-4">{error}</p>

              <div className="flex flex-col gap-2 mb-4">
                {showOpenSettings && (
                  <Button onClick={openSettings} variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Abrir Configuración
                  </Button>
                )}

                {shouldUseNative && (
                  <>
                    <Button onClick={handleRetryNative} variant="outline" className="w-full">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reintentar escáner nativo
                    </Button>
                    <Button onClick={handleUseWebFallback} variant="secondary" className="w-full">
                      <Globe className="h-4 w-4 mr-2" />
                      Usar cámara alternativa (web)
                    </Button>
                  </>
                )}

                {!shouldUseNative && (
                  <>
                    <Button onClick={handleStartWebScanner} variant="outline" className="w-full">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reintentar cámara
                    </Button>
                    {showNativeOption && (
                      <Button onClick={handleRetryNative} variant="secondary" className="w-full">
                        <Smartphone className="h-4 w-4 mr-2" />
                        Probar escáner nativo
                      </Button>
                    )}
                  </>
                )}
              </div>

              <Button onClick={handleClose} variant="ghost" className="text-white">
                Cerrar
              </Button>
            </div>
          ) : shouldUseNative && nativeStep === 'scanning' ? (
            // Native scanner active with startScan() - show overlay frame
            <div className="flex flex-col items-center justify-center h-64">
              <div className="relative w-64 h-64">
                {/* Scan frame */}
                <div className="absolute inset-0 border-2 border-white/30 rounded-xl">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
                {/* Scanning line animation */}
                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-primary animate-pulse" />
              </div>
              <p className="text-white mt-4 text-center">Apunta hacia el código QR</p>
              <Button 
                onClick={handleUseWebFallback} 
                variant="ghost" 
                className="text-white/70 mt-4 text-sm"
              >
                ¿No funciona? Usa cámara alternativa
              </Button>
            </div>
          ) : shouldUseNative ? (
            // Native scanner preparing
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-white">
                <p className="mb-4">Preparando escáner...</p>
                <Button 
                  onClick={handleUseWebFallback} 
                  variant="outline" 
                  className="text-white border-white/30"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Usar cámara web (alternativa)
                </Button>
              </div>
            </div>
          ) : (
            // Web scanner UI
            <>
              {!webStarted ? (
                <div className="text-center text-white p-8">
                  <p className="mb-4 text-white/80">
                    Para escanear, primero debemos pedir permiso de cámara.
                  </p>
                  <Button onClick={handleStartWebScanner} className="w-full mb-3">
                    Activar cámara
                  </Button>
                  
                  {/* Option to try native scanner on Android */}
                  {showNativeOption && (
                    <Button 
                      onClick={handleRetryNative} 
                      variant="outline" 
                      className="w-full text-white border-white/30"
                    >
                      <Smartphone className="h-4 w-4 mr-2" />
                      Probar escáner nativo
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center text-white/60 text-sm mt-4">
                  <p>Apunta hacia el código QR</p>
                </div>
              )}
            </>
          )}

          {/* Scan frame overlay for web scanner */}
          {!shouldUseNative && webStarted && !isLoading && !error && (
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

      {/* Floating bottom button for continuous mode */}
      {continuousMode && scannedCount > 0 && (
        <div className="p-4 bg-black/80">
          <Button
            onClick={handleClose}
            className="w-full h-14 text-lg font-bold gap-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/30 text-white"
          >
            <Package className="h-5 w-5" />
            LISTO · {scannedCount} paquete{scannedCount !== 1 ? 's' : ''} ✓
          </Button>
        </div>
      )}

      {/* Instructions & Diagnostics */}
      <div className="p-4 text-center bg-black/50">
        <p className="text-white/70 text-sm">
          Coloca el código QR dentro del recuadro
        </p>
        {shouldUseNative && nativeStep === 'scanning' && (
          <p className="text-white/50 text-xs mt-1">
            La cámara está activa detrás de esta pantalla
          </p>
        )}
        
        {/* Diagnostics panel (Android native only) */}
        {showNativeOption && (
          <div className="mt-3">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="text-white/40 text-xs underline"
            >
              {showDiagnostics ? 'Ocultar diagnóstico' : 'Mostrar diagnóstico'}
            </button>
            
            {showDiagnostics && (
              <div className="mt-2 text-xs text-left bg-black/60 p-3 rounded-lg text-white/60 font-mono">
                <p>platform: {platform}</p>
                <p>isNative: {String(isNative)}</p>
                <p>isAndroid: {String(isAndroid)}</p>
                <p>forceWebScanner: {String(forceWebScanner)}</p>
                <p>shouldUseNative: {String(shouldUseNative)}</p>
                <p>nativeStep: {nativeStep}</p>
                <p>isLoading: {String(isLoading)}</p>
                <p>webStarted: {String(webStarted)}</p>
                <p>elapsed: {elapsedSeconds}s</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
