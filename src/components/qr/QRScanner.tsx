import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Button } from '@/components/ui/button';
import { X, Camera, SwitchCamera, Loader2 } from 'lucide-react';

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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNative = Capacitor.isNativePlatform();
  const scanningRef = useRef(false);

  useEffect(() => {
    if (isNative) {
      initNativeScanner();
    } else {
      initWebScanner();
    }

    return () => {
      scanningRef.current = false;
      if (!isNative) {
        stopWebScanner();
      }
    };
  }, []);

  // Native scanner using ML Kit - uses scan() method for single scan
  const initNativeScanner = async () => {
    try {
      setIsLoading(true);
      
      // Check and request permissions
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== 'granted') {
        setError('Se requiere permiso de cámara para escanear códigos QR');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setIsScanning(true);
      scanningRef.current = true;
      
      // Add class to make WebView background transparent
      document.body.classList.add('barcode-scanner-active');

      // Continuously scan while the component is mounted
      while (scanningRef.current) {
        try {
          const { barcodes } = await BarcodeScanner.scan({
            formats: [BarcodeFormat.QrCode],
          });
          
          if (barcodes.length > 0 && barcodes[0].rawValue && scanningRef.current) {
            onScan(barcodes[0].rawValue);
            break;
          }
        } catch (scanError: any) {
          // User cancelled or error - check if we should continue
          if (!scanningRef.current || scanError?.message?.includes('cancel')) {
            break;
          }
        }
      }
    } catch (err) {
      console.error('Error initializing native scanner:', err);
      setError('Error al iniciar el escáner. Por favor, intenta de nuevo.');
      setIsLoading(false);
    } finally {
      document.body.classList.remove('barcode-scanner-active');
    }
  };

  // Web scanner using html5-qrcode
  const initWebScanner = async () => {
    try {
      setIsLoading(true);
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length) {
        setCameras(devices);
        // Prefer back camera
        const backCameraIndex = devices.findIndex(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('trasera') ||
          d.label.toLowerCase().includes('posterior')
        );
        const startIndex = backCameraIndex >= 0 ? backCameraIndex : 0;
        setCurrentCameraIndex(startIndex);
        
        scannerRef.current = new Html5Qrcode('qr-reader');
        await startWebCamera(devices[startIndex].id);
      } else {
        setError('No se encontraron cámaras');
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Error initializing web scanner:', err);
      setError('Error al acceder a la cámara. Por favor, permite el acceso.');
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
      console.error('Error starting web camera:', err);
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
        console.error('Error stopping web scanner:', err);
      }
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startWebCamera(cameras[nextIndex].id);
  };

  const handleClose = async () => {
    scanningRef.current = false;
    document.body.classList.remove('barcode-scanner-active');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <div className="flex items-center gap-2 text-white">
          <Camera className="h-5 w-5" />
          <span className="font-medium">Escáner QR</span>
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
          {isLoading ? (
            <div className="text-center text-white p-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Iniciando cámara...</p>
            </div>
          ) : error ? (
            <div className="text-center text-white p-8">
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={handleClose} variant="outline">
                Cerrar
              </Button>
            </div>
          ) : isNative ? (
            // Native scanner - shows message while native camera overlay is active
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-white">
                {isScanning ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="mb-2">Escáner activo</p>
                    <p className="text-sm text-white/70">Apunta hacia el código QR</p>
                  </>
                ) : (
                  <p>Preparando escáner...</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div 
                id="qr-reader" 
                ref={containerRef}
                className="rounded-lg overflow-hidden"
              />
              {/* Overlay corners */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-primary rounded-br-lg" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 text-center text-white/70">
        <p>Apunta la cámara hacia el código QR del envío</p>
      </div>
    </div>
  );
}
