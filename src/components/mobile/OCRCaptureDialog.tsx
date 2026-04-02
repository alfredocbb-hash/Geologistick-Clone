import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Camera, Check, RotateCcw, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { parseOCRText, type OCRExtractedData } from '@/lib/ocrParser';
import { useNativeCamera } from '@/hooks/useNativeCamera';

interface OCRConfirmData {
  direccion: string;
  localidad: string;
  codigoPostal: string;
  nombreDestinatario: string;
  mlShipmentId?: string;
}

interface OCRCaptureDialogProps {
  open: boolean;
  mlShipmentId?: string;
  onClose: () => void;
  onConfirm: (data: OCRConfirmData) => Promise<void> | void;
  continuousMode?: boolean;
}

type Step = 'capture' | 'processing' | 'confirm';

export function OCRCaptureDialog({ open, mlShipmentId, onClose, onConfirm, continuousMode = false }: OCRCaptureDialogProps) {
  const [step, setStep] = useState<Step>('capture');
  const [imageData, setImageData] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<OCRExtractedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [progressMsg, setProgressMsg] = useState('Analizando etiqueta...');

  // Editable fields
  const [direccion, setDireccion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [nombreDestinatario, setNombreDestinatario] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isNative, cameraAvailable, takePhoto } = useNativeCamera();

  const resetFields = useCallback(() => {
    setStep('capture');
    setImageData(null);
    setOcrData(null);
    setDireccion('');
    setLocalidad('');
    setCodigoPostal('');
    setNombreDestinatario('');
  }, []);

  const workerRef = useRef<any>(null);

  const skipToManual = useCallback(() => {
    workerRef.current?.terminate?.().catch(() => {});
    workerRef.current = null;
    setIsProcessing(false);
    setProgressMsg('');
    setStep('confirm');
    toast.info('Ingresá los datos manualmente.');
  }, []);

  const processImage = useCallback(async (dataUrl: string) => {
    setImageData(dataUrl);
    setStep('processing');
    setIsProcessing(true);
    setProgressMsg('Descargando motor OCR...');

    let worker: any = null;
    const timeoutId = setTimeout(() => {
      // Force resolve to manual entry after 30s
      worker?.terminate?.().catch(() => {});
      workerRef.current = null;
    }, 30000);

    try {
      const ocrProcess = async () => {
        const { createWorker } = await import('tesseract.js');
        setProgressMsg('Iniciando motor OCR...');
        worker = await createWorker('spa');
        workerRef.current = worker;
        setProgressMsg('Analizando imagen...');
        const { data } = await worker.recognize(dataUrl);
        await worker.terminate();
        workerRef.current = null;
        return data.text;
      };

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 30000)
      );

      const rawText = await Promise.race([ocrProcess(), timeout]);
      clearTimeout(timeoutId);
      console.log('[OCR] Raw text:', rawText);

      const extracted = parseOCRText(rawText);
      setOcrData(extracted);
      setDireccion(extracted.direccion || '');
      setLocalidad(extracted.localidad || '');
      setCodigoPostal(extracted.codigoPostal || '');
      setNombreDestinatario(extracted.nombreDestinatario || '');
      setStep('confirm');

      if (!extracted.direccion) {
        toast.warning('No se detectó una dirección clara. Ingresala manualmente.');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      worker?.terminate?.().catch(() => {});
      workerRef.current = null;

      if (error.message === 'TIMEOUT') {
        toast.warning('OCR tardó demasiado. Ingresá los datos manualmente.');
        setStep('confirm');
      } else {
        console.error('[OCR] Processing error:', error);
        toast.error('Error al procesar la imagen', { description: error.message });
        setStep('capture');
      }
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  }, []);

  const handleNativeCapture = useCallback(async () => {
    const result = await takePhoto();
    if (result?.dataUrl) {
      processImage(result.dataUrl);
    }
  }, [takePhoto, processImage]);

  const handleFileCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      processImage(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [processImage]);

  const handleRetry = useCallback(() => {
    setStep('capture');
    setImageData(null);
    setOcrData(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!direccion.trim()) {
      toast.error('La dirección es obligatoria');
      return;
    }

    setIsConfirming(true);
    try {
      await onConfirm({
        direccion: direccion.trim(),
        localidad: localidad.trim(),
        codigoPostal: codigoPostal.trim(),
        nombreDestinatario: nombreDestinatario.trim(),
        mlShipmentId,
      });

      if (continuousMode) {
        setSavedCount(prev => prev + 1);
        toast.success('✅ Paquete guardado', { duration: 1500 });
        resetFields();
      }
      // In non-continuous mode, the parent handles closing
    } catch (err: any) {
      toast.error('Error al guardar envío', { description: err.message });
    } finally {
      setIsConfirming(false);
    }
  }, [direccion, localidad, codigoPostal, nombreDestinatario, mlShipmentId, onConfirm, continuousMode, resetFields]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      resetFields();
      setSavedCount(0);
      onClose();
    }
  }, [onClose, resetFields]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-md mx-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white">
              {step === 'capture' && '📷 Capturar etiqueta'}
              {step === 'processing' && '🔍 Procesando...'}
              {step === 'confirm' && '✏️ Confirmar datos'}
            </DialogTitle>
            {continuousMode && savedCount > 0 && (
              <Badge className="bg-emerald-600 text-white">
                {savedCount} guardado{savedCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Step 1: Capture */}
        {step === 'capture' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-24 h-24 rounded-2xl bg-slate-800/50 flex items-center justify-center">
              <Camera className="h-12 w-12 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 text-center max-w-xs">
              {continuousMode
                ? 'Tomá una foto de la siguiente etiqueta para continuar.'
                : 'Tomá una foto clara de la etiqueta del paquete para extraer la dirección de entrega.'}
            </p>

            {isNative && cameraAvailable ? (
              <Button
                onClick={handleNativeCapture}
                className="w-full h-14 text-lg gap-3 bg-gradient-to-r from-primary to-emerald-500"
              >
                <Camera className="h-6 w-6" />
                {continuousMode ? 'SIGUIENTE FOTO' : 'TOMAR FOTO'}
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-14 text-lg gap-3 bg-gradient-to-r from-primary to-emerald-500"
                >
                  <Camera className="h-6 w-6" />
                  {continuousMode ? 'SIGUIENTE FOTO' : 'TOMAR FOTO'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileCapture}
                />
              </>
            )}

            <Button variant="ghost" onClick={() => handleOpenChange(false)} className="text-slate-400">
              {continuousMode && savedCount > 0 ? `Listo (${savedCount} guardados)` : 'Cancelar'}
            </Button>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-slate-400">{progressMsg || 'Analizando etiqueta con OCR...'}</p>
            {imageData && (
              <img
                src={imageData}
                alt="Etiqueta capturada"
                className="w-full max-h-40 object-contain rounded-lg opacity-50"
              />
            )}
            <Button
              variant="ghost"
              onClick={skipToManual}
              className="text-slate-400 underline text-xs"
            >
              Saltar OCR / Ingresar manualmente
            </Button>
          </div>
        )}

        {/* Step 3: Confirm / Edit */}
        {step === 'confirm' && (
          <div className="space-y-4">
            {imageData && (
              <img
                src={imageData}
                alt="Etiqueta"
                className="w-full max-h-28 object-contain rounded-lg border border-slate-800"
              />
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-slate-300 text-xs">Dirección detectada *</Label>
                <Input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej: Av. San Martín 1234"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300 text-xs">Localidad</Label>
                  <Input
                    value={localidad}
                    onChange={(e) => setLocalidad(e.target.value)}
                    placeholder="Ej: Quilmes"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Código Postal</Label>
                  <Input
                    value={codigoPostal}
                    onChange={(e) => setCodigoPostal(e.target.value)}
                    placeholder="Ej: 1878"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-300 text-xs">Nombre destinatario (opcional)</Label>
                <Input
                  value={nombreDestinatario}
                  onChange={(e) => setNombreDestinatario(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleRetry}
                disabled={isConfirming}
                className="flex-1 gap-2 border-slate-700 text-slate-300"
              >
                <RotateCcw className="h-4 w-4" />
                Reintentar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!direccion.trim() || isConfirming}
                className="flex-1 gap-2 bg-gradient-to-r from-primary to-emerald-500"
              >
                {isConfirming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                {isConfirming ? 'Guardando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
