import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { X, Camera, MapPin, Navigation, Package, Loader2, Route, AlertCircle, Image, Zap, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { OCRCaptureDialog, type OCRQueueItem } from './OCRCaptureDialog';

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

interface QueueEntry {
  id: string;
  status: 'processing' | 'saved' | 'error';
  trackingNumber?: string;
  error?: string;
}

interface BulkOCRScreenProps {
  onClose: () => void;
}

const BATCH_SIZE = 3;

function getStoredMode(): BulkMode {
  try {
    const stored = localStorage.getItem('bulk_ocr_mode');
    if (stored === 'burst' || stored === 'album') return stored;
  } catch {}
  return 'select';
}

export function BulkOCRScreen({ onClose }: BulkOCRScreenProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<BulkMode>(getStoredMode());
  const [packages, setPackages] = useState<BulkPackage[]>([]);

  // Burst mode state
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [showOCR, setShowOCR] = useState(false);

  // Album mode state
  const [albumPhotos, setAlbumPhotos] = useState<AlbumPhoto[]>([]);
  const [albumPhase, setAlbumPhase] = useState<AlbumPhase>('capturing');
  const [processedCount, setProcessedCount] = useState(0);

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [sucursalId, setSucursalId] = useState<string | null>(null);

  const selectMode = useCallback((m: 'burst' | 'album') => {
    try { localStorage.setItem('bulk_ocr_mode', m); } catch {}
    setMode(m);
    if (m === 'burst') setShowOCR(true);
  }, []);

  const ensureTenantId = useCallback(async () => {
    if (tenantId) return tenantId;
    const { data } = await supabase
      .from('profiles')
      .select('tenant_id, sucursal_id')
      .eq('user_id', user!.id)
      .single();
    const tid = data?.tenant_id || null;
    setSucursalId(data?.sucursal_id || null);
    setTenantId(tid);
    return tid;
  }, [user, tenantId]);

  // ── Album: capture photo ──
  const handleFileCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAlbumPhotos(prev => [...prev, {
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          dataUrl,
          status: 'pending',
        }]);
      };
      reader.readAsDataURL(file);
    });
    // Reset input so same file can be captured again
    e.target.value = '';
  }, []);

  const removePhoto = useCallback((id: string) => {
    setAlbumPhotos(prev => prev.filter(p => p.id !== id));
  }, []);

  // ── Album: process all photos ──
  const processAlbum = useCallback(async () => {
    setAlbumPhase('processing');
    setProcessedCount(0);
    const tid = await ensureTenantId();
    const photos = albumPhotos.filter(p => p.status === 'pending' || p.status === 'error');

    // Process in batches
    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      const batch = photos.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (photo) => {
        // Mark processing
        setAlbumPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'processing' as PhotoStatus, error: undefined } : p));

        try {
          // Call OCR edge function
          const { data: ocrData, error: ocrError } = await supabase.functions.invoke('ocr-label', {
            body: { image: photo.dataUrl },
          });
          if (ocrError) throw new Error(ocrError.message || 'Error OCR');

          const parsed = typeof ocrData === 'string' ? JSON.parse(ocrData) : ocrData;
          if (parsed.error) throw new Error(parsed.error);

          const direccion = (parsed.direccion || '').trim();
          const localidad = (parsed.localidad || '').trim();
          const codigoPostal = (parsed.codigoPostal || '').trim();

          if (!direccion || (!localidad && !codigoPostal)) {
            throw new Error('Datos insuficientes: falta dirección o localidad/CP');
          }

          // Auto-save
          const trackingNumber = `OCR-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
          const { data: envio, error: insertError } = await supabase
            .from('envios')
            .insert({
              tracking_number: trackingNumber,
              direccion_entrega: direccion,
              ciudad_entrega: localidad,
              cp_entrega: codigoPostal,
              nombre_destinatario: (parsed.nombreDestinatario || '').trim() || null,
              notas: (parsed.referencia || '').trim() || null,
              estado: 'pendiente',
              precio_total: 0,
              is_manual_entry: true,
              source_module: 'bulk_ocr_album',
              tenant_id: tid,
              sucursal_origen_id: sucursalId || null,
              sucursal_entrega_id: sucursalId || null,
              ml_shipment_id: parsed.mlShipmentId ? parseInt(parsed.mlShipmentId) : null,
              created_by: user?.id,
            })
            .select('id, tracking_number')
            .single();

          if (insertError) throw insertError;

          setAlbumPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'saved' as PhotoStatus, trackingNumber: envio.tracking_number } : p));
          setPackages(prev => [...prev, {
            id: envio.id,
            tracking_number: envio.tracking_number,
            direccion,
            localidad,
            codigoPostal,
            nombreDestinatario: (parsed.nombreDestinatario || '').trim(),
          }]);
        } catch (err: any) {
          setAlbumPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'error' as PhotoStatus, error: err.message || 'Error desconocido' } : p));
        }
        setProcessedCount(c => c + 1);
      }));
    }
    setAlbumPhase('done');
  }, [albumPhotos, ensureTenantId, sucursalId, user?.id]);

  const retryErrors = useCallback(() => {
    setAlbumPhotos(prev => prev.map(p => p.status === 'error' ? { ...p, status: 'pending' as PhotoStatus, error: undefined } : p));
    setAlbumPhase('capturing');
  }, []);

  // ── Burst mode handlers ──
  const handleOCRConfirm = useCallback(async (data: {
    direccion: string; localidad: string; codigoPostal: string;
    nombreDestinatario: string; mlShipmentId?: string; referencia?: string; barrio?: string;
  }): Promise<string> => {
    const tid = await ensureTenantId();
    const trackingNumber = `OCR-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const { data: envio, error } = await supabase
      .from('envios')
      .insert({
        tracking_number: trackingNumber, direccion_entrega: data.direccion,
        ciudad_entrega: data.localidad, cp_entrega: data.codigoPostal,
        nombre_destinatario: data.nombreDestinatario || null, notas: data.referencia || null,
        estado: 'pendiente', precio_total: 0, is_manual_entry: true, source_module: 'bulk_ocr',
        tenant_id: tid, sucursal_origen_id: sucursalId || null, sucursal_entrega_id: sucursalId || null,
        ml_shipment_id: data.mlShipmentId ? parseInt(data.mlShipmentId) : null, created_by: user?.id,
      })
      .select('id, tracking_number')
      .single();
    if (error) throw error;
    setPackages(prev => [...prev, {
      id: envio.id, tracking_number: envio.tracking_number,
      direccion: data.direccion, localidad: data.localidad,
      codigoPostal: data.codigoPostal, nombreDestinatario: data.nombreDestinatario,
    }]);
    return trackingNumber;
  }, [ensureTenantId, user?.id, sucursalId]);

  const handleQueueUpdate = useCallback((item: OCRQueueItem) => {
    setQueue(prev => {
      const existing = prev.findIndex(q => q.id === item.id);
      const entry: QueueEntry = { id: item.id, status: item.status, trackingNumber: item.trackingNumber, error: item.error };
      if (existing >= 0) { const u = [...prev]; u[existing] = entry; return u; }
      return [...prev, entry];
    });
  }, []);

  // ── Common actions ──
  const handleFinish = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['envios'] });
    toast.success(`${packages.length} envío${packages.length !== 1 ? 's' : ''} creado${packages.length !== 1 ? 's' : ''} por OCR`);
    onClose();
  }, [packages.length, queryClient, onClose]);

  const handleGoToPlanner = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['envios'] });
    const ids = packages.map(p => p.id).join(',');
    navigate(`/route-planner?envio_ids=${ids}`);
    onClose();
  }, [packages, queryClient, navigate, onClose]);

  const removePackage = useCallback(async (id: string) => {
    await supabase.from('envios').delete().eq('id', id);
    setPackages(prev => prev.filter(p => p.id !== id));
  }, []);

  // ── Stats ──
  const processingCount = mode === 'burst'
    ? queue.filter(q => q.status === 'processing').length
    : albumPhotos.filter(p => p.status === 'processing').length;
  const errorCount = mode === 'burst'
    ? queue.filter(q => q.status === 'error').length
    : albumPhotos.filter(p => p.status === 'error').length;
  const pendingPhotos = albumPhotos.filter(p => p.status === 'pending').length;
  const totalAlbum = albumPhotos.length;
  const progressPercent = totalAlbum > 0 ? Math.round((processedCount / totalAlbum) * 100) : 0;

  // ── Mode selector ──
  if (mode === 'select') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Escaneo Masivo OCR</h1>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-muted-foreground text-center mb-4">¿Cómo querés escanear las etiquetas?</p>
          <Button
            onClick={() => selectMode('album')}
            variant="outline"
            className="w-full h-24 gap-4 justify-start text-left border-primary/30 hover:border-primary"
          >
            <Image className="h-8 w-8 text-primary flex-shrink-0" />
            <div>
              <div className="font-semibold text-base">Álbum (recomendado)</div>
              <div className="text-xs text-muted-foreground font-normal">
                Tomá todas las fotos primero, después procesá todo junto
              </div>
            </div>
          </Button>
          <Button
            onClick={() => selectMode('burst')}
            variant="outline"
            className="w-full h-24 gap-4 justify-start text-left"
          >
            <Zap className="h-8 w-8 text-amber-500 flex-shrink-0" />
            <div>
              <div className="font-semibold text-base">Ráfaga (al vuelo)</div>
              <div className="text-xs text-muted-foreground font-normal">
                Cada foto se procesa inmediatamente con IA en background
              </div>
            </div>
          </Button>
        </div>
      </div>
    );
  }

  // ── Album mode ──
  if (mode === 'album') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Modo Álbum</h1>
            <p className="text-sm text-muted-foreground">
              {albumPhase === 'capturing' && `${totalAlbum} foto${totalAlbum !== 1 ? 's' : ''} capturada${totalAlbum !== 1 ? 's' : ''}`}
              {albumPhase === 'processing' && `Procesando ${processedCount} de ${totalAlbum}...`}
              {albumPhase === 'done' && `${packages.length} envío${packages.length !== 1 ? 's' : ''} creado${packages.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Progress bar during processing */}
        {albumPhase === 'processing' && (
          <div className="mb-3 space-y-1.5">
            <Progress value={progressPercent} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{processedCount} de {totalAlbum}</span>
              {errorCount > 0 && <span className="text-destructive">{errorCount} error{errorCount !== 1 ? 'es' : ''}</span>}
            </div>
          </div>
        )}

        {/* Status badges */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {packages.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Package className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-500">{packages.length} guardados</span>
            </div>
          )}
          {errorCount > 0 && albumPhase !== 'processing' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-semibold text-destructive">{errorCount} error{errorCount !== 1 ? 'es' : ''}</span>
            </div>
          )}
        </div>

        {/* Camera button (capturing phase) */}
        {albumPhase === 'capturing' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileCapture}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-14 text-lg font-semibold gap-3 bg-gradient-to-br from-primary via-primary to-amber-500 hover:opacity-90 shadow-xl shadow-primary/30 mb-3"
            >
              <Camera className="h-6 w-6" />
              {totalAlbum === 0 ? 'TOMAR PRIMERA FOTO' : 'TOMAR SIGUIENTE FOTO'}
            </Button>
          </>
        )}

        {/* Photo grid */}
        {totalAlbum > 0 ? (
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="grid grid-cols-3 gap-2 pr-2 pb-2">
                {albumPhotos.map((photo, idx) => (
                  <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={photo.dataUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    {/* Status overlay */}
                    {photo.status === 'processing' && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-primary animate-spin" />
                      </div>
                    )}
                    {photo.status === 'saved' && (
                      <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Package className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}
                    {photo.status === 'error' && (
                      <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center">
                          <AlertCircle className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}
                    {/* Index badge */}
                    <div className="absolute top-1 left-1 bg-background/80 rounded-full w-5 h-5 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-foreground">{idx + 1}</span>
                    </div>
                    {/* Delete button (only during capturing) */}
                    {albumPhase === 'capturing' && photo.status === 'pending' && (
                      <button
                        onClick={() => removePhoto(photo.id)}
                        className="absolute top-1 right-1 bg-background/80 rounded-full w-5 h-5 flex items-center justify-center hover:bg-destructive/80"
                      >
                        <X className="h-3 w-3 text-foreground" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Image className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Sin fotos</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Tomá fotos de las etiquetas. Todas se guardan localmente hasta que presiones "Procesar todo".
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 space-y-2">
          {albumPhase === 'capturing' && totalAlbum > 0 && (
            <Button
              onClick={processAlbum}
              className="w-full h-14 text-lg font-semibold gap-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/30"
            >
              <Loader2 className="h-5 w-5" style={{ animation: 'none' }} />
              PROCESAR TODO · {totalAlbum} FOTO{totalAlbum !== 1 ? 'S' : ''}
            </Button>
          )}
          {albumPhase === 'done' && errorCount > 0 && (
            <Button onClick={retryErrors} variant="outline" className="w-full h-12 gap-2 border-amber-500/30 text-amber-500">
              <RefreshCw className="h-4 w-4" /> REINTENTAR {errorCount} CON ERROR
            </Button>
          )}
          {albumPhase === 'done' && packages.length > 0 && (
            <>
              <Button
                onClick={handleGoToPlanner}
                className="w-full h-14 text-lg font-semibold gap-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/30"
              >
                <Route className="h-5 w-5" />
                PLANIFICAR RUTA · {packages.length} ENVÍO{packages.length !== 1 ? 'S' : ''}
              </Button>
              <Button onClick={handleFinish} variant="outline" className="w-full h-12 text-base font-semibold gap-3 border-border text-muted-foreground">
                <Navigation className="h-5 w-5" />
                FINALIZAR SIN PLANIFICAR
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Burst mode (original) ──
  const burstProcessingCount = queue.filter(q => q.status === 'processing').length;
  const burstErrorCount = queue.filter(q => q.status === 'error').length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Modo Ráfaga</h1>
          <p className="text-sm text-muted-foreground">
            {packages.length} paquete{packages.length !== 1 ? 's' : ''} guardado{packages.length !== 1 ? 's' : ''}
            {burstProcessingCount > 0 && ` · ${burstProcessingCount} procesando`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        {packages.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Package className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-500">{packages.length}</span>
          </div>
        )}
        {burstProcessingCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-pulse">
            <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
            <span className="text-sm font-semibold text-amber-500">{burstProcessingCount} procesando</span>
          </div>
        )}
        {burstErrorCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">{burstErrorCount} error{burstErrorCount !== 1 ? 'es' : ''}</span>
          </div>
        )}
      </div>

      <Button
        onClick={() => setShowOCR(true)}
        className="w-full h-16 text-lg font-semibold gap-3 bg-gradient-to-br from-primary via-primary to-amber-500 hover:opacity-90 shadow-xl shadow-primary/30 mb-4"
      >
        <Camera className="h-7 w-7" />
        {packages.length === 0 && burstProcessingCount === 0 ? 'TOMAR PRIMERA FOTO' : 'TOMAR SIGUIENTE FOTO'}
      </Button>

      {(packages.length > 0 || queue.length > 0) ? (
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-2">
              {queue.filter(q => q.status === 'processing').map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-950/30 border border-amber-800/30 animate-pulse">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                  </div>
                  <span className="text-sm text-amber-300">Procesando con IA...</span>
                </div>
              ))}
              {queue.filter(q => q.status === 'error').map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-950/30 border border-red-800/30">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  </div>
                  <span className="text-sm text-destructive">{item.error || 'Error al procesar'}</span>
                </div>
              ))}
              {packages.map((pkg, index) => (
                <div key={pkg.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 font-bold text-sm flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-foreground truncate">{pkg.tracking_number}</span>
                      <Badge variant="outline" className="text-[10px] border-amber-600 text-amber-500">OCR</Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground truncate">{pkg.direccion}</span>
                    </div>
                    {pkg.nombreDestinatario && (
                      <span className="text-xs text-muted-foreground truncate block">{pkg.nombreDestinatario}</span>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removePackage(pkg.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Camera className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Sin paquetes</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Tomá fotos de las etiquetas — se procesan en paralelo sin bloquear la cámara.
          </p>
        </div>
      )}

      {packages.length > 0 && (
        <div className="mt-4 space-y-2">
          <Button onClick={handleGoToPlanner} disabled={burstProcessingCount > 0}
            className="w-full h-14 text-lg font-semibold gap-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/30">
            <Route className="h-5 w-5" />
            PLANIFICAR RUTA · {packages.length} ENVÍO{packages.length !== 1 ? 'S' : ''}
          </Button>
          <Button onClick={handleFinish} disabled={burstProcessingCount > 0} variant="outline"
            className="w-full h-12 text-base font-semibold gap-3 border-border text-muted-foreground">
            <Navigation className="h-5 w-5" />
            FINALIZAR SIN PLANIFICAR
          </Button>
        </div>
      )}

      <OCRCaptureDialog open={showOCR} onClose={() => setShowOCR(false)}
        onConfirm={handleOCRConfirm} continuousMode onQueueUpdate={handleQueueUpdate} />
    </div>
  );
}
