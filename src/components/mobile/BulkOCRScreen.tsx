import { useState, useCallback, useRef, useEffect, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { X, Camera, MapPin, Package, Loader2, Route, AlertCircle, Image, Zap, RefreshCw, Trash2, Check, Smartphone, Info, Pencil, Upload, Copy, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useNativeCamera } from '@/hooks/useNativeCamera';
import { useMobileCamera } from './MobileCameraContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ManualEditData {
  direccion: string;
  localidad: string;
  codigoPostal: string;
  nombreDestinatario: string;
  telefono: string;
  nombreRemitente: string;
}

type BulkMode = 'select' | 'burst' | 'album';
type AlbumPhase = 'capturing' | 'processing' | 'done';
type PhotoStatus = 'pending' | 'processing' | 'saved' | 'error' | 'duplicate';

interface AlbumPhoto {
  id: string;
  dataUrl: string;
  status: PhotoStatus;
  trackingNumber?: string;
  error?: string;
  ocrData?: any; // Store extracted OCR data for duplicates
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
  terciarizadoMode?: boolean;
  defaultEmpresaTerciarizadaId?: string;
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

export function BulkOCRScreen({ onClose, onPackagesReady, terciarizadoMode = false, defaultEmpresaTerciarizadaId }: BulkOCRScreenProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { takePhoto } = useNativeCamera();
  const { setCameraActive } = useMobileCamera();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hide bottom nav while this screen is open
  useEffect(() => {
    setCameraActive(true);
    return () => setCameraActive(false);
  }, [setCameraActive]);

  const [mode, setMode] = useState<BulkMode>(isMobile ? 'select' : 'album');
  const [packages, setPackages] = useState<BulkPackage[]>([]);
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhoto[]>([]);
  const [albumPhase, setAlbumPhase] = useState<AlbumPhase>('capturing');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  // Burst mode state
  const [burstProcessing, setBurstProcessing] = useState(0);
  const [editingPhoto, setEditingPhoto] = useState<AlbumPhoto | null>(null);
  const [manualData, setManualData] = useState<ManualEditData>({ direccion: '', localidad: '', codigoPostal: '', nombreDestinatario: '', telefono: '', nombreRemitente: '' });
  const [fechaIngreso, setFechaIngreso] = useState<Date>(new Date());

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

  // Auto-open camera when entering album mode (mobile only)
  useEffect(() => {
    if (isMobile && mode === 'album' && !isCameraOpen && albumPhase === 'capturing') {
      const timeout = setTimeout(startCamera, 200);
      return () => clearTimeout(timeout);
    }
  }, [mode, isMobile]);

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
    setIsCameraOpen(false);
  };

  const handleNativeFallback = async () => {
    const result = await takePhoto();
    if (result?.webPath || result?.dataUrl) {
      const img = result.webPath || result.dataUrl!;
      setAlbumPhotos(prev => [...prev, {
        id: `photo-${Date.now()}`,
        dataUrl: img,
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

  /** Check if OCR data matches an already-processed package */
  const checkDuplicate = (ocrData: any): boolean => {
    const tracking = ocrData.trackingNumber || ocrData.mlShipmentId;
    const nombre = ocrData.nombreDestinatario?.trim().toLowerCase();
    const dir = ocrData.direccion?.trim().toLowerCase();

    return packages.some(p => {
      // Match by tracking number
      if (tracking && (p.tracking_number === tracking || p.tracking_number === String(tracking))) return true;
      // Match by name + address
      if (nombre && dir && p.nombreDestinatario?.trim().toLowerCase() === nombre && p.direccion?.trim().toLowerCase() === dir) return true;
      return false;
    });
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
  }, [albumPhotos, user?.id, profileData, packages]);

  const processOnePhoto = async (photo: AlbumPhoto) => {
    setAlbumPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'processing', error: undefined } : p));

    try {
      const { data: ocrData, error: ocrError } = await supabase.functions.invoke('ocr-label', {
        body: { image: photo.dataUrl }
      });

      if (ocrError) throw new Error("Error IA: Verificá conexión");
      if (!ocrData || !ocrData.direccion) throw new Error("Sin dirección detectada");

      // Check for duplicates by tracking, name+address
      if (checkDuplicate(ocrData)) {
        setAlbumPhotos(prev => prev.map(p => p.id === photo.id ? {
          ...p,
          status: 'duplicate' as PhotoStatus,
          ocrData,
          error: 'Posible duplicado detectado'
        } : p));
        setProcessedCount(prev => prev + 1);
        return;
      }

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
        created_by: user?.id,
        created_at: fechaIngreso.toISOString()
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

  /** Force-save a duplicate photo */
  const forceSaveDuplicate = async (photo: AlbumPhoto) => {
    if (!profileData || !photo.ocrData) return;
    const ocrData = photo.ocrData;
    setAlbumPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'processing', error: undefined } : p));

    try {
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
        tenant_id: profileData.tenant_id,
        sucursal_origen_id: profileData.sucursal_id,
        ml_shipment_id: ocrData.mlShipmentId ? parseInt(ocrData.mlShipmentId) : null,
        created_by: user?.id,
        created_at: fechaIngreso.toISOString()
      }).select().single();

      if (insertError) throw new Error(insertError.message);

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
      toast.success("Guardado correctamente");
    } catch (e: any) {
      setAlbumPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'error', error: e.message } : p));
      toast.error("Error: " + e.message);
    }
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
      const targetPath = isMobile ? '/route-planner' : '/planner';
      navigate(`${targetPath}?envio_ids=${ids.join(',')}`);
      onClose();
    }
  }, [packages, queryClient, navigate, onClose, onPackagesReady]);

  const showPhotoError = (photo: AlbumPhoto) => {
    if (photo.error) {
      toast.error("Error detallado:", { description: photo.error });
    }
  };

  const openManualEdit = (photo: AlbumPhoto) => {
    setEditingPhoto(photo);
    // Pre-fill with OCR data if available (for duplicates)
    if (photo.ocrData) {
      setManualData({
        direccion: photo.ocrData.direccion || '',
        localidad: photo.ocrData.localidad || '',
        codigoPostal: photo.ocrData.codigoPostal || '',
        nombreDestinatario: photo.ocrData.nombreDestinatario || '',
        telefono: photo.ocrData.telefonoDestinatario || '',
        nombreRemitente: photo.ocrData.nombreRemitente || '',
      });
    } else {
      setManualData({ direccion: '', localidad: '', codigoPostal: '', nombreDestinatario: '', telefono: '', nombreRemitente: '' });
    }
  };

  const saveManualEntry = async () => {
    if (!editingPhoto || !profileData) return;
    if (!manualData.direccion.trim()) {
      toast.error("La dirección es obligatoria");
      return;
    }

    setAlbumPhotos(prev => prev.map(p => p.id === editingPhoto.id ? { ...p, status: 'processing', error: undefined } : p));
    setEditingPhoto(null);

    try {
      const tracking = `MAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { data: envio, error: insertError } = await supabase.from('envios').insert({
        tracking_number: tracking,
        direccion_entrega: manualData.direccion,
        ciudad_entrega: manualData.localidad || '',
        cp_entrega: manualData.codigoPostal || '',
        nombre_destinatario: manualData.nombreDestinatario || null,
        whatsapp_destinatario: manualData.telefono || null,
        nombre_remitente: manualData.nombreRemitente || null,
        estado: 'pendiente',
        precio_total: 0,
        source_module: 'bulk_ocr_manual',
        tenant_id: profileData.tenant_id,
        sucursal_origen_id: profileData.sucursal_id,
        created_by: user?.id,
        created_at: fechaIngreso.toISOString()
      }).select().single();

      if (insertError) throw new Error(insertError.message);

      geocodeAndUpdate(envio.id, manualData.direccion, manualData.localidad);

      setPackages(prev => [...prev, {
        id: envio.id,
        tracking_number: tracking,
        direccion: manualData.direccion,
        localidad: manualData.localidad,
        codigoPostal: manualData.codigoPostal,
        nombreDestinatario: manualData.nombreDestinatario
      }]);

      setAlbumPhotos(prev => prev.map(p => p.id === editingPhoto.id ? { ...p, status: 'saved', trackingNumber: tracking } : p));
      toast.success("Envío guardado manualmente");
    } catch (e: any) {
      setAlbumPhotos(prev => prev.map(p => p.id === editingPhoto.id ? { ...p, status: 'error', error: e.message } : p));
      toast.error("Error al guardar: " + e.message);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAlbumPhotos(prev => [...prev, { id: `photo-${Date.now()}-${Math.random()}`, dataUrl, status: 'pending' }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
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
          <div className="absolute inset-4 border-2 border-warning/20 rounded-2xl pointer-events-none">
             <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-warning rounded-tl-xl shadow-[0_0_10px_orange]" />
             <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-warning rounded-tr-xl shadow-[0_0_10px_orange]" />
             <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-warning rounded-bl-xl shadow-[0_0_10px_orange]" />
             <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-warning rounded-br-xl shadow-[0_0_10px_orange]" />
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
          <div className="absolute inset-4 border-2 border-warning/20 rounded-2xl pointer-events-none">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-warning rounded-tl-xl shadow-[0_0_10px_orange]" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-warning rounded-tr-xl shadow-[0_0_10px_orange]" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-warning rounded-bl-xl shadow-[0_0_10px_orange]" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-warning rounded-br-xl shadow-[0_0_10px_orange]" />
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
              {onPackagesReady ? <Package className="mr-2 h-5 w-5" /> : <Route className="mr-2 h-5 w-5" />}
              {onPackagesReady ? `COLECTAR (${savedCount})` : `PLANIFICAR (${savedCount})`}
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
  const pendingCount = albumPhotos.filter(p => p.status === 'pending').length;
  const errorCount = albumPhotos.filter(p => p.status === 'error').length;
  const duplicateCount = albumPhotos.filter(p => p.status === 'duplicate').length;

  return (
    <div className={isMobile ? "fixed inset-0 z-[10000] bg-slate-950 flex flex-col pt-safe-extra pb-safe-extra overflow-hidden" : "flex flex-col min-h-[60vh] max-h-[80vh] overflow-hidden"}>
      {/* Hidden file input for desktop */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      {/* Header */}
      <div className={`flex items-center justify-between px-6 mb-4 ${isMobile ? 'mt-10' : 'mt-4'}`}>
        <div>
          <h1 className={`font-black tracking-tighter uppercase leading-none ${isMobile ? 'text-2xl text-white' : 'text-xl text-foreground'}`}>
            {isMobile ? 'Álbum' : 'Importar Fotos con IA'}
          </h1>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{albumPhotos.length} fotos cargadas</p>
        </div>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <div className="flex flex-col items-end gap-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fecha de ingreso</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={albumPhase !== 'capturing'}
                    className={cn(
                      "h-9 justify-start text-left font-medium gap-2",
                      !fechaIngreso && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {format(fechaIngreso, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={fechaIngreso}
                    onSelect={(d) => d && setFechaIngreso(d)}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    locale={es}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white/50 rounded-full bg-white/5 h-12 w-12"><X /></Button>
          )}
        </div>
      </div>

      {/* Processing progress */}
      {albumPhase === 'processing' && (
        <div className="px-6 mb-2">
          <Progress value={(processedCount / albumPhotos.length) * 100} className="h-2" />
          <p className="text-[10px] text-slate-400 font-bold mt-1 text-center">{processedCount} / {albumPhotos.length} procesadas</p>
        </div>
      )}

      {/* Scrollable photo grid - takes all remaining space */}
      <div className="flex-1 min-h-0 overflow-hidden mx-4">
        <ScrollArea className="h-full">
          <div className="p-2">
            {albumPhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 pb-4">
                {albumPhotos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className={`relative aspect-square rounded-2xl overflow-hidden border-2 shadow-md transition-all ${
                      photo.status === 'error' ? 'border-destructive' :
                      photo.status === 'duplicate' ? 'border-amber-500' :
                      'border-slate-800'
                    }`}
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
                        <AlertCircle className="text-white h-5 w-5 mb-1" />
                        <span className="text-[7px] font-black text-white uppercase leading-none">Error</span>
                      </div>
                    )}
                    {photo.status === 'duplicate' && (
                      <div className="absolute inset-0 bg-amber-500/40 flex flex-col items-center justify-center text-center p-1">
                        <Copy className="text-white h-5 w-5 mb-1" />
                        <span className="text-[7px] font-black text-white uppercase leading-none">Duplicado</span>
                      </div>
                    )}

                    {/* Delete button for pending photos in capture phase */}
                    {albumPhase === 'capturing' && photo.status === 'pending' && (
                      <button onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-destructive transition-colors"><Trash2 className="h-3 w-3" /></button>
                    )}

                    {/* Edit button for error and duplicate photos */}
                    {(photo.status === 'error' || photo.status === 'duplicate') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openManualEdit(photo); }}
                        className="absolute bottom-1 right-1 bg-primary text-white rounded-full p-1.5 shadow-lg active:scale-90 transition-transform"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}

                    {/* Force save button for duplicates */}
                    {photo.status === 'duplicate' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); forceSaveDuplicate(photo); }}
                        className="absolute bottom-1 left-1 bg-emerald-500 text-white rounded-full p-1.5 shadow-lg active:scale-90 transition-transform"
                        title="Guardar igual"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 opacity-50 text-center">
                <Upload className="h-16 w-16 mb-4 text-muted-foreground" />
                <p className="font-black text-sm uppercase tracking-widest text-muted-foreground leading-none mb-2">Sin fotos cargadas</p>
                {!isMobile && <p className="text-xs text-muted-foreground">Hacé click en "Seleccionar Imágenes" para comenzar</p>}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Error/duplicate hint banners */}
      {errorCount > 0 && albumPhase === 'done' && (
        <div className="mx-6 mb-2 bg-destructive/90 text-white p-3 rounded-2xl flex items-center gap-3 shadow-2xl">
          <Pencil className="h-4 w-4 shrink-0" />
          <p className="text-[10px] font-black uppercase leading-tight">{errorCount} foto(s) con error — tocá el ícono ✏️ para cargar datos manual</p>
        </div>
      )}
      {duplicateCount > 0 && albumPhase === 'done' && (
        <div className="mx-6 mb-2 bg-amber-500/90 text-white p-3 rounded-2xl flex items-center gap-3 shadow-2xl">
          <Copy className="h-4 w-4 shrink-0" />
          <p className="text-[10px] font-black uppercase leading-tight">{duplicateCount} posible(s) duplicado(s) — ✏️ editar o ✅ guardar igual</p>
        </div>
      )}

      {/* STICKY action buttons — always visible */}
      <div className={`shrink-0 px-6 py-4 space-y-2 ${isMobile ? 'bg-slate-950 border-t border-slate-800' : 'border-t border-border'}`}>
        {albumPhase === 'capturing' && (
          <>
            {isMobile ? (
              <Button onClick={startCamera} className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black text-base shadow-2xl shadow-primary/20 active:scale-95 transition-all">
                <Camera className="mr-3 h-5 w-5" /> ABRIR CÁMARA
              </Button>
            ) : (
              <Button onClick={() => fileInputRef.current?.click()} className="w-full h-12 rounded-xl font-bold">
                <Upload className="mr-2 h-5 w-5" /> Seleccionar Imágenes
              </Button>
            )}
            {albumPhotos.length > 0 && (
              <Button onClick={processAlbum} className={isMobile ? "w-full h-12 rounded-2xl bg-white text-black font-black active:scale-95 transition-all border-2 border-slate-200" : "w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold"}>
                PROCESAR {pendingCount} FOTOS
              </Button>
            )}
          </>
        )}
        {albumPhase === 'processing' && (
          <Button disabled className={isMobile ? "w-full h-14 rounded-2xl bg-slate-800 text-white font-black" : "w-full h-12 rounded-xl font-bold"}>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> PROCESANDO...
          </Button>
        )}
        {albumPhase === 'done' && (
          <>
            <Button onClick={handleGoToPlanner} disabled={packages.length === 0} className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-xl disabled:opacity-40">
              {onPackagesReady ? <Package className="mr-3 h-5 w-5" /> : <Route className="mr-3 h-5 w-5" />} {onPackagesReady ? `COLECTAR (${packages.length})` : `PLANIFICAR RUTA (${packages.length})`}
            </Button>
            {(errorCount > 0 || duplicateCount > 0) && (
              <Button onClick={processAlbum} variant="outline" className="w-full h-10 rounded-xl font-bold text-xs">
                <RefreshCw className="mr-2 h-4 w-4" /> REINTENTAR {errorCount} CON ERROR
              </Button>
            )}
            <Button onClick={() => { setAlbumPhase('capturing'); }} variant="ghost" className="w-full font-bold uppercase text-xs">
              {isMobile ? <Camera className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {isMobile ? 'VOLVER A CAPTURAR' : 'AGREGAR MÁS IMÁGENES'}
            </Button>
          </>
        )}
      </div>

      {/* Manual edit dialog for error/duplicate photos */}
      <Dialog open={!!editingPhoto} onOpenChange={(open) => !open && setEditingPhoto(null)}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingPhoto?.status === 'duplicate' ? 'Editar datos (posible duplicado)' : 'Cargar datos manualmente'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Dirección *</Label>
              <Input value={manualData.direccion} onChange={e => setManualData(d => ({ ...d, direccion: e.target.value }))} placeholder="Av. San Martín 1234" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Localidad</Label>
                <Input value={manualData.localidad} onChange={e => setManualData(d => ({ ...d, localidad: e.target.value }))} placeholder="Córdoba" />
              </div>
              <div>
                <Label className="text-xs">Código Postal</Label>
                <Input value={manualData.codigoPostal} onChange={e => setManualData(d => ({ ...d, codigoPostal: e.target.value }))} placeholder="5000" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Nombre destinatario</Label>
              <Input value={manualData.nombreDestinatario} onChange={e => setManualData(d => ({ ...d, nombreDestinatario: e.target.value }))} placeholder="Juan Pérez" />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={manualData.telefono} onChange={e => setManualData(d => ({ ...d, telefono: e.target.value }))} placeholder="351-1234567" />
            </div>
            <div>
              <Label className="text-xs">Remitente</Label>
              <Input value={manualData.nombreRemitente} onChange={e => setManualData(d => ({ ...d, nombreRemitente: e.target.value }))} placeholder="Empresa ABC" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPhoto(null)}>Cancelar</Button>
            <Button onClick={saveManualEntry} disabled={!manualData.direccion.trim()}>Guardar envío</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
