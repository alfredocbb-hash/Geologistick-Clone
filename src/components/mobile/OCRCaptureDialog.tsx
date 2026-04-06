import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Camera, X, Check, MapPin, AlertTriangle, RefreshCw, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { useMobileCamera } from './MobileCameraContext';

export interface OCRConfirmData {
  direccion: string;
  localidad: string;
  codigoPostal: string;
  nombreDestinatario: string;
  mlShipmentId?: string;
  referencia?: string;
  barrio?: string;
  provincia?: string;
  telefonoDestinatario?: string;
  emailDestinatario?: string;
  dniDestinatario?: string;
  nombreRemitente?: string;
  direccionRetiro?: string;
  cantidadBultos?: string;
  pesoKg?: string;
  valorDeclarado?: string;
  tipoPago?: string;
}

export interface OCRQueueItem {
  id: string;
  status: 'processing' | 'saved' | 'error';
  trackingNumber?: string;
  error?: string;
  preview?: string;
}

interface OCRCaptureDialogProps {
  open: boolean;
  mlShipmentId?: string;
  onClose: () => void;
  onConfirm: (data: OCRConfirmData) => Promise<string | void> | string | void;
  continuousMode?: boolean;
  onQueueUpdate?: (item: OCRQueueItem) => void;
}

export function OCRCaptureDialog({ open, mlShipmentId, onClose, onConfirm, continuousMode = false, onQueueUpdate }: OCRCaptureDialogProps) {
  const [step, setStep] = useState<'capture' | 'confirm'>('capture');
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const { takePhoto } = useNativeCamera();
  const { setCameraActive } = useMobileCamera();

  // Hide bottom nav when open
  useEffect(() => {
    if (open) setCameraActive(true);
    return () => { if (open) setCameraActive(false); };
  }, [open, setCameraActive]);

  const [direccion, setDireccion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [nombreDestinatario, setNombreDestinatario] = useState('');
  const [provincia, setProvincia] = useState('');
  const [telefonoDestinatario, setTelefonoDestinatario] = useState('');
  const [nombreRemitente, setNombreRemitente] = useState('');
  const [dniDestinatario, setDniDestinatario] = useState('');
  const [referencia, setReferencia] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }

      // CONFIGURACIÓN ULTRA ESTRICTA PARA CÁMARA TRASERA
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        // Forzar reproducción para evitar el icono de play tachado
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Error al iniciar cámara interna:", err);
      toast.error("No se pudo activar la cámara interna. Usa el botón de celular.");
    }
  }, [stream]);

  useEffect(() => {
    if (open && step === 'capture') {
      // Pequeño delay para asegurar que el DOM está listo
      const timeout = setTimeout(startCamera, 300);
      return () => clearTimeout(timeout);
    }
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [open, step]);

  const handleNativeFallback = async () => {
    const result = await takePhoto();
    if (result?.dataUrl || result?.webPath) {
      const img = result.webPath || result.dataUrl!;
      if (continuousMode) {
        processInBackground(img);
        setSavedCount(prev => prev + 1);
      } else {
        setCapturedImage(img);
        processImage(img);
      }
    }
  };

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

    if (continuousMode) {
      processInBackground(dataUrl);
      setSavedCount(prev => prev + 1);
      toast.success("Foto capturada", { duration: 500 });
    } else {
      setCapturedImage(dataUrl);
      processImage(dataUrl);
    }
  }, [continuousMode]);

  const processInBackground = async (base64: string) => {
    const queueId = `ocr-${Date.now()}`;
    onQueueUpdate?.({ id: queueId, status: 'processing', preview: base64 });
    try {
      const { data, error } = await supabase.functions.invoke('ocr-label', { body: { image: base64 } });
      if (error) throw error;
      const result = await onConfirm(data);
      onQueueUpdate?.({ id: queueId, status: 'saved', trackingNumber: typeof result === 'string' ? result : 'OK' });
    } catch (e) {
      onQueueUpdate?.({ id: queueId, status: 'error', error: "Error de lectura" });
    }
  };

  const processImage = async (base64: string) => {
    setIsProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('ocr-label', { body: { image: base64 } });
      setDireccion(data.direccion || '');
      setLocalidad(data.localidad || '');
      setCodigoPostal(data.codigoPostal || '');
      setNombreDestinatario(data.nombreDestinatario || '');
      setProvincia(data.provincia || '');
      setTelefonoDestinatario(data.telefonoDestinatario || '');
      setNombreRemitente(data.nombreRemitente || '');
      setDniDestinatario(data.dniDestinatario || '');
      setReferencia(data.referencia || '');
      setStep('confirm');
    } catch (e) {
      setStep('confirm');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col pt-safe-extra pb-safe-extra">
      {/* Header ajustado para no ser tapado por el sistema */}
      <div className="flex items-center justify-between p-6">
        <h2 className="text-xl font-black text-white tracking-tighter">ESCÁNER IA</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            onClose();
          }}
          className="rounded-full bg-white/10 text-white h-12 w-12"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col px-4 min-h-0">
        {step === 'capture' ? (
          <div className="flex-1 flex flex-col gap-4">
            <div className="relative flex-1 bg-black rounded-[2.5rem] overflow-hidden border-2 border-slate-800 shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-8 border-2 border-warning/30 rounded-3xl pointer-events-none">
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-warning rounded-tl-2xl shadow-[0_0_15px_orange]" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-warning rounded-tr-2xl shadow-[0_0_15px_orange]" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-warning rounded-bl-2xl shadow-[0_0_15px_orange]" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-warning rounded-br-2xl shadow-[0_0_15px_orange]" />
              </div>
            </div>

            <div className="py-6 flex flex-col items-center gap-4">
              <div className="flex items-center gap-8">
                {/* Botón de Cámara Nativa (Sistema) como alternativa */}
                <Button
                  onClick={handleNativeFallback}
                  variant="outline"
                  className="rounded-full h-14 w-14 bg-white/5 border-white/10 hover:bg-white/20"
                  title="Usar cámara del sistema"
                >
                  <Smartphone className="h-6 w-6 text-white" />
                </Button>

                <Button
                  onClick={capturePhoto}
                  className="w-20 h-20 rounded-full bg-warning border-8 border-slate-900 shadow-[0_0_30px_rgba(245,158,11,0.3)] active:scale-90 transition-transform"
                >
                  <Camera className="h-8 w-8 text-black" />
                </Button>

                <Button
                  onClick={startCamera}
                  variant="outline"
                  className="rounded-full h-14 w-14 bg-white/5 border-white/10 hover:bg-white/20"
                  title="Refrescar cámara"
                >
                  <RefreshCw className="h-6 w-6 text-white" />
                </Button>
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center leading-relaxed">
                {continuousMode ? `${savedCount} CAPTURADAS` : 'TOCA EL BOTÓN PARA ANALIZAR'} <br/>
                <span className="text-warning/60 font-bold">¿Cámara en negro? Toca el icono del celular</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5 bg-slate-900 rounded-[2.5rem] border border-slate-800 space-y-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 max-h-[70vh] overflow-y-auto">
             <div className="space-y-3">
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Destinatario</label>
                 <input value={nombreDestinatario} onChange={e => setNombreDestinatario(e.target.value)} placeholder="Nombre destinatario" className="w-full bg-slate-800 p-3 rounded-2xl text-white border-none focus:ring-2 focus:ring-primary text-sm font-bold" />
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Dirección</label>
                 <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección completa" className="w-full bg-slate-800 p-3 rounded-2xl text-white border-none focus:ring-2 focus:ring-primary text-sm font-bold" />
               </div>
               <div className="grid grid-cols-3 gap-3">
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Localidad</label>
                   <input value={localidad} onChange={e => setLocalidad(e.target.value)} placeholder="Ciudad" className="w-full bg-slate-800 p-3 rounded-2xl text-white border-none focus:ring-2 focus:ring-primary text-sm font-bold" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Provincia</label>
                   <input value={provincia} onChange={e => setProvincia(e.target.value)} placeholder="Prov." className="w-full bg-slate-800 p-3 rounded-2xl text-white border-none focus:ring-2 focus:ring-primary text-sm font-bold" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">CP</label>
                   <input value={codigoPostal} onChange={e => setCodigoPostal(e.target.value)} placeholder="CP" className="w-full bg-slate-800 p-3 rounded-2xl text-white border-none focus:ring-2 focus:ring-primary text-sm font-bold" />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Teléfono</label>
                   <input value={telefonoDestinatario} onChange={e => setTelefonoDestinatario(e.target.value)} placeholder="Tel. destinatario" className="w-full bg-slate-800 p-3 rounded-2xl text-white border-none focus:ring-2 focus:ring-primary text-sm font-bold" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">DNI</label>
                   <input value={dniDestinatario} onChange={e => setDniDestinatario(e.target.value)} placeholder="DNI" className="w-full bg-slate-800 p-3 rounded-2xl text-white border-none focus:ring-2 focus:ring-primary text-sm font-bold" />
                 </div>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Remitente</label>
                 <input value={nombreRemitente} onChange={e => setNombreRemitente(e.target.value)} placeholder="Nombre remitente" className="w-full bg-slate-800 p-3 rounded-2xl text-white border-none focus:ring-2 focus:ring-primary text-sm font-bold" />
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Referencia / Observaciones</label>
                 <input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Entre calles, piso, depto..." className="w-full bg-slate-800 p-3 rounded-2xl text-white border-none focus:ring-2 focus:ring-primary text-sm font-bold" />
               </div>
             </div>
             <div className="flex flex-col gap-3">
               <Button onClick={() => {
                 const data: OCRConfirmData = {
                   direccion, localidad, codigoPostal, nombreDestinatario,
                   mlShipmentId, provincia, telefonoDestinatario,
                   dniDestinatario, nombreRemitente, referencia,
                 };
                 const result = onConfirm(data);
                 const resetFields = () => {
                   setStep('capture');
                   setDireccion(''); setLocalidad(''); setCodigoPostal(''); setNombreDestinatario('');
                   setProvincia(''); setTelefonoDestinatario(''); setNombreRemitente('');
                   setDniDestinatario(''); setReferencia('');
                   setCapturedImage(null);
                 };
                 if (result instanceof Promise) {
                   result.then(resetFields);
                 } else {
                   resetFields();
                 }
               }} className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-lg">
                 GUARDAR ENVÍO
               </Button>
               <Button variant="ghost" onClick={() => setStep('capture')} className="w-full text-slate-500 font-bold uppercase tracking-tighter">
                 REINTENTAR FOTO
               </Button>
             </div>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
