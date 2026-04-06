import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { X, Camera, MapPin, Package, Loader2, Route, AlertCircle, Image, Zap, RefreshCw, Trash2, Check, Smartphone, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { useMobileCamera } from './MobileCameraContext';

type BulkMode = 'select' | 'burst' | 'album';
type AlbumPhase = 'capturing' | 'processing' | 'done';
type PhotoStatus = 'pending' | 'processing' | 'saved' | 'error';

interface AlbumPhoto {
  id: string;
  dataUrl: string;
  status: PhotoStatus;
  trackingNumber?: string;
  error?: string;
}

interface BulkPackage {
  id: string;
  tracking_number: string;
  direccion: string;
  localidad: string;
  codigoPostal: string;
  nombreDestinatario: string;
}

interface BulkOCRScreenProps {
  onClose: () => void;
  onPackagesReady?: (envioIds: string[]) => void;
}

async function geocodeAndUpdate(envioId: string, direccion: string, localidad: string) {
  try {
    const fullAddress = `${direccion}, ${localidad}`.trim();
    if (!fullAddress || fullAddress === ',') return;
    const { data: geoData } = await supabase.functions.invoke('geocode-address', {
      body: { address: fullAddress }
    });
    if (geoData?.location?.lat && geoData?.location?.lng) {
      await supabase.from('envios').update({
        destinatario_lat: geoData.location.lat,
        destinatario_lng: geoData.location.lng
      }).eq('id', envioId);
    }
  } catch {
    // Geocoding is best-effort, don't block flow
  }
}

export function BulkOCRScreen({ onClose, onPackagesReady }: BulkOCRScreenProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { takePhoto } = useNativeCamera();
  const { setCameraActive } = useMobileCamera();

  // Hide bottom nav while this screen is open
  useEffect(() => {
    setCameraActive(true);
    return () => setCameraActive(false);
  }, [setCameraActive]);

  const [mode, setMode] = useState<BulkMode>('select');
  const [packages, setPackages] = useState<BulkPackage[]>([]);
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhoto[]>([]);
  const [albumPhase, setAlbumPhase] = useState<AlbumPhase>('capturing');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  // Burst mode state
  const [burstProcessing, setBurstProcessing] = useState(0);

  const [profileData, setProfileData] = useState<{ tenant_id: string; sucursal_id: string | null } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('tenant_id, sucursal_id')
        .eq('user_id', user.id)
        .single();
      if (data) setProfileData(data);
    };
    fetchProfile();
  }, [user?.id]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      setStream(newStream);
      setIsCameraOpen(true);
    } catch (err) {
      toast.error("Usa la cámara del sistema (icono celular)");
    }
  };

  // Attach stream to video element once both are available
  useEffect(() => {
    if (stream && isCameraOpen && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, isCameraOpen]);

  // Auto-open camera when entering album mode
  useEffect(() => {
    if (mode === 'album' && !isCameraOpen && albumPhase === 'capturing') {
      const timeout = setTimeout(startCamera, 200);
      return () => clearTimeout(timeout);
    }
  }, [mode]);

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
    setIsCameraOpen(false);
  };

  const handleNativeFallback = async () => {
    const result = await takePhoto();
    if (result?.webPath || result?.dataUrl) {
      setAlbumPhotos(prev => [...prev, {
        id: `photo-${Date.now()}`,
        dataUrl: result.webPath || result.dataUrl!,
        status: 'pending'
      }]);
    }
  };

  const captureToAlbum = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
    setAlbumPhotos(prev => [...prev, { id: `photo-${Date.now()}`, dataUrl, status: 'pending' }]);
    toast.success("Foto añadida", { duration: 500 });
  };

  const processAlbum = useCallback(async () => {
    if (!profileData) {
      toast.error("Cargando perfil...");
      return;
    }

    setAlbumPhase('processing');
    setProcessedCount(0);

    const photosToProcess = albumPhotos.filter(p => p.status === 'pending' || p.status === 'error');

    // Process in parallel chunks of 3
    const chunkSize = 3;
    for (let i = 0; i < photosToProcess.length; i += chunkSize) {
      const chunk = photosToProcess.slice(i, i + chunkSize);
      await Promise.allSettled(chunk.map(photo => processOnePhoto(photo)));
    }
    setAlbumPhase('done');
  }, [albumPhotos, user?.id, profileData]);

  const processOnePhoto = async (photo: AlbumPhoto) => {
    setAlbumPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'processing', error: undefined } : p));

    try {
      const { data: ocrData, error: ocrError } = await supabase.functions.invoke('ocr-label', {
        body: { image: photo.dataUrl }
      });

      if (ocrError) throw new Error("Error IA: Verificá conexión");
      if (!ocrData || !ocrData.direccion) throw new Error("Sin dirección detectada");

      const tracking = ocrData.trackingNumber || ocrData.mlShipmentId || `OCR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const { data: envio, error: insertError } = await supabase.from('envios').insert({
        tracking_number: tracking,
        direccion_entrega: ocrData.direccion,
        ciudad_entrega: ocrData.localidad || '',
        cp_entrega: ocrData.codigoPostal || '',
        nombre_destinatario: ocrData.nombreDestinatario || null,
        notas: ocrData.referencia || ocrData.barrio || null,
        provincia: ocrData.provincia || null,
        whatsapp_destinatario: ocrData.telefonoDestinatario || null,
        email_destinatario: ocrData.emailDestinatario || null,
        dni_destinatario: ocrData.dniDestinatario || null,
        nombre_remitente: ocrData.nombreRemitente || null,
        direccion_retiro: ocrData.direccionRetiro || null,
        cantidad_bultos: ocrData.cantidadBultos ? parseInt(ocrData.cantidadBultos) || null : null,
        peso_kg: ocrData.pesoKg ? parseFloat(ocrData.pesoKg) || null : null,
        valor_declarado: ocrData.valorDeclarado ? parseFloat(ocrData.valorDeclarado) || null : null,
        tipo_pago: ocrData.tipoPago || null,
        estado: 'pendiente',
        precio_total: 0,
        source_module: 'bulk_ocr_album',
        tenant_id: profileData!.tenant_id,
        sucursal_origen_id: profileData!.sucursal_id,
        ml_shipment_id: ocrData.mlShipmentId ? parseInt(ocrData.mlShipmentId) : null,
        created_by: user?.id
      }).select().single();

      if (insertError) {
        if (insertError.code === '23505') throw new Error(`Tracking duplicado: ${tracking}`);
        throw new Error(`DB Error: ${insertError.message}`);
      }

      geocodeAndUpdate(envio.id, ocrData.direccion, ocrData.localidad || '');

      setPackages(prev => [...prev, {
        id: envio.id,
        tracking_number: tracking,
        direccion: ocrData.direccion,
        localidad: ocrData.localidad,
        codigoPostal: ocrData.codigoPostal || '',
        nombreDestinatario: ocrData.nombreDestinatario || ''
      }]);

      setAlbumPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'saved', trackingNumber: tracking } : p));
    } catch (e: any) {
      setAlbumPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'error', error: e.message } : p));
    }
    setProcessedCount(prev => prev + 1);
  };

  const handleGoToPlanner = useCallback(() => {
    if (packages.length === 0) {
      toast.error("No hay paquetes guardados para planificar");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['envios'] });
    queryClient.invalidateQueries({ queryKey: ['envios-planificador'] });
    const ids = packages.map(p => p.id);
    if (onPackagesReady) {
      onPackagesReady(ids);
    } else {
      navigate(`/route-planner?envio_ids=${ids.join(',')}`);
      onClose();
    }
  }, [packages, queryClient, navigate, onClose, onPackagesReady]);

  const showPhotoError = (photo: AlbumPhoto) => {
    if (photo.error) {
      toast.error("Error detallado:", { description: photo.error });
    }
  };

  const removePhoto = (id: string) => {
    setAlbumPhotos(prev => prev.filter(p => p.id !== id));
  };

  if (isCameraOpen) {
    return (
      <div className="fixed inset-0 z-[10001] bg-black flex flex-col pt-safe-extra">
        <div className="flex items-center justify-between p-6 mt-8">
          <h2 className="text-white font-black uppercase tracking-widest">Captura ({albumPhotos.length})</h2>
          <Button onClick={stopCamera} variant="ghost" className="text-white rounded-full bg-white/10 h-12 w-12"><X /></Button>
        </div>
        <div className="flex-1 relative overflow-hidden rounded-[2.5rem] mx-4 border-2 border-slate-800 shadow-2xl">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute inset-10 border-2 border-warning/20 rounded-2xl pointer-events-none">
             <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-warning rounded-tl-xl shadow-[0_0_10px_orange]" />
             <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-warning rounded-tr-xl shadow-[0_0_10px_orange]" />
             <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-warning rounded-bl-xl shadow-[0_0_10px_orange]" />
             <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-warning rounded-br-xl shadow-[0_0_10px_orange]" />
          </div>
        </div>
        <div className="p-10 flex flex-col items-center gap-4 mb-8">
          <div className="flex items-center gap-8">
            <Button onClick={handleNativeFallback} variant="outline" className="rounded-full h-14 w-14 bg-white/5 border-white/10"><Smartphone className="h-6 w-6 text-white" /></Button>
            <Button onClick={captureToAlbum} className="w-24 h-24 rounded-full bg-warning border-8 border-slate-900 shadow-2xl active:scale-95"><Camera className="text-black h-10 w-10" /></Button>
            <Button onClick={startCamera} variant="outline" className="rounded-full h-14 w-14 bg-white/5 border-white/10"><RefreshCw className="h-6 w-6 text-white" /></Button>
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase text-center tracking-[0.2em]">Toca para añadir al álbum</p>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  if (mode === 'select') {
    return (
      <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col p-6 pt-safe-extra">
        <div className="flex items-center justify-between mb-10 mt-10">
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">OCR Masivo</h1>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white/50 rounded-full bg-white/5 h-12 w-12"><X /></Button>
        </div>
        <div className="flex-1 flex flex-col gap-4">
          <Button onClick={() => setMode('album')} className="w-full h-32 flex-col bg-slate-900 border-slate-800 border-2 rounded-[2rem] active:scale-95 transition-all shadow-2xl">
            <Image className="h-8 w-8 text-primary mb-2" />
            <div className="font-black text-white uppercase tracking-tight text-lg leading-tight">Modo Álbum</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase">Saca fotos y procesa al final</div>
          </Button>
          <Button onClick={() => { setMode('burst'); const t = setTimeout(startCamera, 200); }} className="w-full h-32 flex-col bg-slate-900 border-slate-800 border-2 rounded-[2rem] active:scale-95 transition-all shadow-2xl">
            <Zap className="h-8 w-8 text-amber-500 mb-2" />
            <div className="font-black text-white uppercase tracking-tight text-lg leading-tight">Modo Ráfaga</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase">Procesamiento inmediato</div>
          </Button>
        </div>
      </div>
    );
  }

  // Burst mode: integrated camera + live processing
  if (mode === 'burst') {
    const savedCount = packages.length;

    const captureBurst = async () => {
      if (!profileData) return;
      let imageData: string | null = null;

      // Try video capture first, fallback to native
      if (videoRef.current && canvasRef.current && isCameraOpen) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        imageData = canvas.toDataURL('image/jpeg', 0.5);
      } else {
        const result = await takePhoto();
        if (result?.webPath || result?.dataUrl) {
          imageData = result.webPath || result.dataUrl!;
        }
      }

      if (!imageData) return;
      toast.success("Foto capturada", { duration: 500 });
      setBurstProcessing(prev => prev + 1);

      // Process in background
      try {
        const { data: ocrData, error: ocrError } = await supabase.functions.invoke('ocr-label', {
          body: { image: imageData }
        });
        if (ocrError || !ocrData?.direccion) throw new Error("Sin dirección");

        const tracking = ocrData.trackingNumber || ocrData.mlShipmentId || `OCR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const { data: envio, error: insertError } = await supabase.from('envios').insert({
          tracking_number: tracking,
          direccion_entrega: ocrData.direccion,
          ciudad_entrega: ocrData.localidad || '',
          cp_entrega: ocrData.codigoPostal || '',
          nombre_destinatario: ocrData.nombreDestinatario || null,
          notas: ocrData.referencia || ocrData.barrio || null,
          provincia: ocrData.provincia || null,
          whatsapp_destinatario: ocrData.telefonoDestinatario || null,
          email_destinatario: ocrData.emailDestinatario || null,
          dni_destinatario: ocrData.dniDestinatario || null,
          nombre_remitente: ocrData.nombreRemitente || null,
          direccion_retiro: ocrData.direccionRetiro || null,
          cantidad_bultos: ocrData.cantidadBultos ? parseInt(ocrData.cantidadBultos) || null : null,
          peso_kg: ocrData.pesoKg ? parseFloat(ocrData.pesoKg) || null : null,
          valor_declarado: ocrData.valorDeclarado ? parseFloat(ocrData.valorDeclarado) || null : null,
          tipo_pago: ocrData.tipoPago || null,
          estado: 'pendiente',
          precio_total: 0,
          tenant_id: profileData.tenant_id,
          sucursal_origen_id: profileData.sucursal_id,
          ml_shipment_id: ocrData.mlShipmentId ? parseInt(ocrData.mlShipmentId) : null,
          source_module: 'bulk_ocr_burst',
          created_by: user?.id
        }).select().single();

        if (insertError) throw insertError;
        if (envio) {
          geocodeAndUpdate(envio.id, ocrData.direccion, ocrData.localidad || '');
          setPackages(prev => [...prev, {
            id: envio.id,
            tracking_number: tracking,
            direccion: ocrData.direccion,
            localidad: ocrData.localidad,
            codigoPostal: ocrData.codigoPostal || '',
            nombreDestinatario: ocrData.nombreDestinatario || ''
          }]);
          toast.success(`✅ ${tracking}`, { duration: 1500 });
        }
      } catch {
        toast.error("Error al procesar foto", { duration: 1500 });
      } finally {
        setBurstProcessing(prev => prev - 1);
      }
    };

    return (
      <div className="fixed inset-0 z-[10000] bg-black flex flex-col pt-safe-extra">
        {/* Header */}
        <div className="flex items-center justify-between p-4 mt-6">
          <h2 className="text-white font-black uppercase tracking-widest text-sm">Ráfaga</h2>
          <Button onClick={() => { stopCamera(); setMode('select'); }} variant="ghost" className="text-white rounded-full bg-white/10 h-10 w-10"><X className="h-5 w-5" /></Button>
        </div>

        {/* Camera view */}
        <div className="flex-1 relative overflow-hidden rounded-[2rem] mx-4 border-2 border-slate-800 shadow-2xl">
          {isCameraOpen ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-900">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          <div className="absolute inset-10 border-2 border-warning/20 rounded-2xl pointer-events-none">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-warning rounded-tl-xl shadow-[0_0_10px_orange]" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-warning rounded-tr-xl shadow-[0_0_10px_orange]" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-warning rounded-bl-xl shadow-[0_0_10px_orange]" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-warning rounded-br-xl shadow-[0_0_10px_orange]" />
          </div>
        </div>

        {/* Stats + controls */}
        <div className="p-4 pb-8 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-white font-black text-lg">{savedCount}</span>
              <span className="text-slate-400 text-xs font-bold uppercase">guardados</span>
            </div>
            {burstProcessing > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Procesando {burstProcessing}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 justify-center">
            <Button onClick={handleNativeFallback} variant="outline" className="rounded-full h-12 w-12 bg-white/5 border-white/10"><Smartphone className="h-5 w-5 text-white" /></Button>
            <Button onClick={captureBurst} className="w-20 h-20 rounded-full bg-warning border-8 border-slate-900 shadow-2xl active:scale-95"><Camera className="text-black h-8 w-8" /></Button>
            <Button onClick={startCamera} variant="outline" className="rounded-full h-12 w-12 bg-white/5 border-white/10"><RefreshCw className="h-5 w-5 text-white" /></Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGoToPlanner}
              disabled={savedCount === 0}
              className="flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black shadow-lg disabled:opacity-40"
            >
              <Route className="mr-2 h-5 w-5" />
              PLANIFICAR ({savedCount})
            </Button>
            <Button
              onClick={() => { stopCamera(); onClose(); }}
              variant="outline"
              className="h-12 rounded-2xl border-slate-600 text-white font-black px-6"
            >
              LISTO
            </Button>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // Album mode UI
  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col p-4 pt-safe-extra pb-safe-extra overflow-hidden">
      <div className="flex items-center justify-between mb-6 mt-10 px-2">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">Álbum</h1>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{albumPhotos.length} fotos cargadas</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white/50 rounded-full bg-white/5 h-12 w-12"><X /></Button>
      </div>

      <div className="flex-1 min-h-0 bg-slate-900/50 rounded-[2.5rem] border border-slate-800 overflow-hidden mb-6 shadow-inner relative">
        <ScrollArea className="h-full p-4">
          {albumPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 pb-32">
              {albumPhotos.map((photo, idx) => (
                <div
                  key={photo.id}
                  onClick={() => photo.status === 'error' && showPhotoError(photo)}
                  className={`relative aspect-square rounded-2xl overflow-hidden border-2 shadow-md transition-all active:scale-95 ${photo.status === 'error' ? 'border-destructive' : 'border-slate-800'}`}
                >
                  <img src={photo.dataUrl} className="w-full h-full object-cover" alt="captured" />
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center">{idx + 1}</div>

                  {photo.status === 'processing' && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    </div>
                  )}
                  {photo.status === 'saved' && (
                    <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center">
                      <Check className="text-white h-8 w-8 drop-shadow-md" />
                    </div>
                  )}
                  {photo.status === 'error' && (
                    <div className="absolute inset-0 bg-destructive/40 flex flex-col items-center justify-center text-center p-1">
                      <AlertCircle className="text-white h-6 w-6 mb-1" />
                      <span className="text-[7px] font-black text-white uppercase leading-none">Error</span>
                    </div>
                  )}

                  {albumPhase === 'capturing' && photo.status === 'pending' && (
                    <button onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-destructive transition-colors"><Trash2 className="h-3 w-3" /></button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-20 opacity-30 text-center">
              <Image className="h-16 w-16 mb-4 text-slate-600" />
              <p className="font-black text-[10px] uppercase tracking-widest text-white leading-none">Sin fotos cargadas</p>
            </div>
          )}
        </ScrollArea>

        {albumPhotos.some(p => p.status === 'error') && albumPhase === 'done' && (
          <div className="absolute bottom-4 left-4 right-4 bg-destructive text-white p-3 rounded-2xl flex items-center gap-3 shadow-2xl animate-bounce">
            <Info className="h-5 w-5" />
            <p className="text-[10px] font-black uppercase leading-tight">Toca las fotos rojas para ver el error</p>
          </div>
        )}
      </div>

      <div className="space-y-3 px-2 pb-16 bg-slate-950 z-50">
        {albumPhase === 'capturing' && (
          <>
            <Button onClick={startCamera} className="w-full h-16 rounded-2xl bg-primary text-white font-black text-lg shadow-2xl shadow-primary/20 active:scale-95 transition-all">
              <Camera className="mr-3 h-6 w-6" /> ABRIR CÁMARA
            </Button>
            {albumPhotos.length > 0 && (
              <Button onClick={processAlbum} className="w-full h-14 rounded-2xl bg-white text-black font-black active:scale-95 transition-all border-2 border-slate-200">
                PROCESAR {albumPhotos.length} FOTOS
              </Button>
            )}
          </>
        )}
        {(albumPhase === 'done' || albumPhase === 'processing') && (
          <div className="flex flex-col gap-2">
            {albumPhase === 'done' && (
              <Button onClick={handleGoToPlanner} className="w-full h-16 rounded-2xl bg-emerald-500 text-white font-black text-lg shadow-xl active:scale-95 transition-all">
                <Route className="mr-3 h-6 w-6" /> PLANIFICAR RUTA ({packages.length})
              </Button>
            )}
            <Button onClick={() => { setAlbumPhase('capturing'); }} variant="ghost" className="text-slate-500 font-bold uppercase tracking-tighter hover:bg-white/5 rounded-xl">
              <RefreshCw className="h-4 w-4 mr-2" /> VOLVER A CAPTURAR
            </Button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
