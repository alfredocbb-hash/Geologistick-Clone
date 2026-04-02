import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Camera, Check, RotateCcw, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { parseOCRText, type OCRExtractedData } from '@/lib/ocrParser';
import { useNativeCamera } from '@/hooks/useNativeCamera';

interface OCRCaptureDialogProps {
  open: boolean;
  mlShipmentId?: string;
  onClose: () => void;
  onConfirm: (data: {
    direccion: string;
    localidad: string;
    codigoPostal: string;
    nombreDestinatario: string;
    mlShipmentId?: string;
  }) => void;
}

type Step = 'capture' | 'processing' | 'confirm';

export function OCRCaptureDialog({ open, mlShipmentId, onClose, onConfirm }: OCRCaptureDialogProps) {
  const [step, setStep] = useState<Step>('capture');
  const [imageData, setImageData] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<OCRExtractedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Editable fields
  const [direccion, setDireccion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [nombreDestinatario, setNombreDestinatario] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isNative, cameraAvailable, takePhoto } = useNativeCamera();

  const processImage = useCallback(async (dataUrl: string) => {
    setImageData(dataUrl);
    setStep('processing');
    setIsProcessing(true);

    try {
      // Dynamic import to avoid bundle bloat
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('spa');
      const { data } = await worker.recognize(dataUrl);
      const rawText = data.text;
      await worker.terminate();
      console.log('[OCR] Raw text:', rawText);

      const extracted = parseOCRText(rawText);
      setOcrData(extracted);

      // Pre-fill editable fields
      setDireccion(extracted.direccion || '');
      setLocalidad(extracted.localidad || '');
      setCodigoPostal(extracted.codigoPostal || '');
      setNombreDestinatario(extracted.nombreDestinatario || '');

      setStep('confirm');

      if (!extracted.direccion) {
        toast.warning('No se detectó una dirección clara. Ingresala manualmente.');
      }
    } catch (error: any) {
      console.error('[OCR] Processing error:', error);
      toast.error('Error al procesar la imagen', { description: error.message });
      setStep('capture');
    } finally {
      setIsProcessing(false);
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
    
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [processImage]);

  const handleRetry = useCallback(() => {
    setStep('capture');
    setImageData(null);
    setOcrData(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!direccion.trim()) {
      toast.error('La dirección es obligatoria');
      return;
    }

    onConfirm({
      direccion: direccion.trim(),
      localidad: localidad.trim(),
      codigoPostal: codigoPostal.trim(),
      nombreDestinatario: nombreDestinatario.trim(),
      mlShipmentId,
    });
  }, [direccion, localidad, codigoPostal, nombreDestinatario, mlShipmentId, onConfirm]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setStep('capture');
      setImageData(null);
      setOcrData(null);
      onClose();
    }
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {step === 'capture' && '📷 Capturar etiqueta'}
            {step === 'processing' && '🔍 Procesando...'}
            {step === 'confirm' && '✏️ Confirmar datos'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Capture */}
        {step === 'capture' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-24 h-24 rounded-2xl bg-slate-800/50 flex items-center justify-center">
              <Camera className="h-12 w-12 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 text-center max-w-xs">
              Tomá una foto clara de la etiqueta del paquete para extraer la dirección de entrega.
            </p>

            {isNative && cameraAvailable ? (
              <Button
                onClick={handleNativeCapture}
                className="w-full h-14 text-lg gap-3 bg-gradient-to-r from-primary to-emerald-500"
              >
                <Camera className="h-6 w-6" />
                TOMAR FOTO
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-14 text-lg gap-3 bg-gradient-to-r from-primary to-emerald-500"
                >
                  <Camera className="h-6 w-6" />
                  TOMAR FOTO
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

            <Button variant="ghost" onClick={onClose} className="text-slate-400">
              Cancelar
            </Button>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-slate-400">Analizando etiqueta con OCR...</p>
            {imageData && (
              <img
                src={imageData}
                alt="Etiqueta capturada"
                className="w-full max-h-40 object-contain rounded-lg opacity-50"
              />
            )}
          </div>
        )}

        {/* Step 3: Confirm / Edit */}
        {step === 'confirm' && (
          <div className="space-y-4">
            {/* Preview thumbnail */}
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
                className="flex-1 gap-2 border-slate-700 text-slate-300"
              >
                <RotateCcw className="h-4 w-4" />
                Reintentar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!direccion.trim()}
                className="flex-1 gap-2 bg-gradient-to-r from-primary to-emerald-500"
              >
                <MapPin className="h-4 w-4" />
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
