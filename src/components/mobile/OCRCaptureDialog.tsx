import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Camera, Check, RotateCcw, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { supabase } from '@/integrations/supabase/client';

export interface OCRConfirmData {
  direccion: string;
  localidad: string;
  codigoPostal: string;
  nombreDestinatario: string;
  mlShipmentId?: string;
  referencia?: string;
  barrio?: string;
}

interface OCRCaptureDialogProps {
  open: boolean;
  mlShipmentId?: string;
  onClose: () => void;
  onConfirm: (data: OCRConfirmData) => Promise<string | void> | string | void;
  continuousMode?: boolean;
}

type Step = 'capture' | 'processing' | 'confirm' | 'success';

export function OCRCaptureDialog({ open, mlShipmentId, onClose, onConfirm, continuousMode = false }: OCRCaptureDialogProps) {
  const [step, setStep] = useState<Step>('capture');
  const [imageData, setImageData] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<Record<string, string> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [progressMsg, setProgressMsg] = useState('Analizando etiqueta...');
  const [ocrFailed, setOcrFailed] = useState(false);
  const [generatedTracking, setGeneratedTracking] = useState('');
  const [detectedMLId, setDetectedMLId] = useState<string | undefined>();

  // Editable fields
  const [direccion, setDireccion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [nombreDestinatario, setNombreDestinatario] = useState('');
  const [referencia, setReferencia] = useState('');
  const [barrio, setBarrio] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleConfirmRef = useRef<(() => void) | null>(null);
  const { isNative, cameraAvailable, takePhoto } = useNativeCamera();

  const resetFields = useCallback(() => {
    setStep('capture');
    setImageData(null);
    setOcrData(null);
    setDireccion('');
    setLocalidad('');
    setCodigoPostal('');
    setNombreDestinatario('');
    setReferencia('');
    setBarrio('');
    setOcrFailed(false);
    setGeneratedTracking('');
    setDetectedMLId(undefined);
  }, []);

  const skipToManual = useCallback(() => {
    setIsProcessing(false);
    setProgressMsg('');
    setOcrFailed(true);
    setStep('confirm');
    toast.info('Ingresá los datos manualmente.');
  }, []);

  const processImage = useCallback(async (dataUrl: string) => {
    setImageData(dataUrl);
    setStep('processing');
    setIsProcessing(true);
    setProgressMsg('Analizando etiqueta con IA...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const { data, error } = await supabase.functions.invoke('ocr-label', {
        body: { image: dataUrl },
      });

      clearTimeout(timeoutId);

      if (error) {
        // Try to get descriptive error from response
        let errMsg = 'Error al procesar';
        try {
          const ctx = await error.context?.json?.();
          if (ctx?.error) errMsg = ctx.error;
        } catch {}
        throw new Error(errMsg);
      }

      const extracted = data || {};
      setOcrData(extracted);
      setDireccion(extracted.direccion || '');
      setLocalidad(extracted.localidad || '');
      setCodigoPostal(extracted.codigoPostal || '');
      setNombreDestinatario(extracted.nombreDestinatario || '');
      setReferencia(extracted.referencia || '');
      setBarrio(extracted.barrio || '');

      const detectedId = extracted.mlShipmentId || undefined;
      setDetectedMLId(detectedId);

      const hasData = !!(extracted.direccion || extracted.localidad || extracted.codigoPostal || extracted.nombreDestinatario || extracted.mlShipmentId);
      setOcrFailed(!hasData);

      if (!hasData) {
        setStep('confirm');
        toast.warning('No se pudo leer la etiqueta. Ingresá los datos manualmente.');
      } else {
        // Check if we have enough data to auto-confirm
        const canAutoConfirm = !!(extracted.direccion && (extracted.localidad || extracted.codigoPostal));
        if (canAutoConfirm) {
          toast.info('Datos extraídos — guardando envío...');
          // Set step to confirm briefly then auto-trigger
          setStep('confirm');
          // Use setTimeout to let state settle before confirming
          setTimeout(() => {
            handleConfirmRef.current?.();
          }, 100);
        } else {
          setStep('confirm');
          toast.info('Datos extraídos — revisá y confirmá');
        }
      }
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError' || error.message === 'TIMEOUT') {
        toast.warning('OCR tardó demasiado. Ingresá los datos manualmente.');
        setOcrFailed(true);
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
    setOcrFailed(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!direccion.trim()) {
      toast.error('La dirección es obligatoria');
      return;
    }

    setIsConfirming(true);
    try {
      const effectiveMLId = detectedMLId || mlShipmentId;
      const result = await onConfirm({
        direccion: direccion.trim(),
        localidad: localidad.trim(),
        codigoPostal: codigoPostal.trim(),
        nombreDestinatario: nombreDestinatario.trim(),
        mlShipmentId: effectiveMLId,
        referencia: referencia.trim() || undefined,
        barrio: barrio.trim() || undefined,
      });

      if (continuousMode) {
        setSavedCount(prev => prev + 1);
        toast.success('✅ Paquete guardado', { duration: 1500 });
        resetFields();
      } else {
        // Show success step
        setGeneratedTracking(typeof result === 'string' ? result : '');
        setStep('success');
      }
    } catch (err: any) {
      toast.error('Error al guardar envío', { description: err.message });
    } finally {
      setIsConfirming(false);
    }
  }, [direccion, localidad, codigoPostal, nombreDestinatario, referencia, barrio, detectedMLId, mlShipmentId, onConfirm, continuousMode, resetFields]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      resetFields();
      setSavedCount(0);
      onClose();
    }
  }, [onClose, resetFields]);

  const effectiveMLId = detectedMLId || mlShipmentId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-md mx-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white">
              {step === 'capture' && '📷 Capturar etiqueta'}
              {step === 'processing' && '🔍 Procesando...'}
              {step === 'confirm' && '✏️ Confirmar datos'}
              {step === 'success' && '✅ Envío creado'}
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
            {/* OCR failed banner */}
            {ocrFailed && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <span className="text-xs text-amber-300">
                  No se pudo leer la etiqueta. Ingresá los datos manualmente.
                </span>
              </div>
            )}

            {imageData && (
              <img
                src={imageData}
                alt="Etiqueta"
                className="w-full max-h-28 object-contain rounded-lg border border-slate-800"
              />
            )}

            {/* ML Shipment ID detected */}
            {effectiveMLId && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <span className="text-xs text-blue-300 font-mono">ML Envío: {effectiveMLId}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-slate-300 text-xs">Dirección *</Label>
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
                <Label className="text-slate-300 text-xs">Destinatario</Label>
                <Input
                  value={nombreDestinatario}
                  onChange={(e) => setNombreDestinatario(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300 text-xs">Barrio / Partido</Label>
                  <Input
                    value={barrio}
                    onChange={(e) => setBarrio(e.target.value)}
                    placeholder="Ej: Centro"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Referencia</Label>
                  <Input
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Ej: Timbre 3B"
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
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
                {isConfirming ? 'Guardando...' : ocrFailed ? 'Crear envío' : 'Confirmar'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-1">Envío creado</h3>
              {generatedTracking && (
                <p className="text-sm text-slate-400 font-mono">{generatedTracking}</p>
              )}
              {effectiveMLId && (
                <p className="text-xs text-blue-400 mt-1">ML Envío: {effectiveMLId}</p>
              )}
            </div>
            <Button
              onClick={() => handleOpenChange(false)}
              className="w-full gap-2 bg-gradient-to-r from-primary to-emerald-500"
            >
              <Check className="h-4 w-4" />
              Listo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
