import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Camera, MapPin, Navigation, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { OCRCaptureDialog } from './OCRCaptureDialog';

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
}

export function BulkOCRScreen({ onClose }: BulkOCRScreenProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [packages, setPackages] = useState<BulkPackage[]>([]);
  const [showOCR, setShowOCR] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [sucursalId, setSucursalId] = useState<string | null>(null);

  // Fetch tenant_id once
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

  const handleOCRConfirm = useCallback(async (data: {
    direccion: string;
    localidad: string;
    codigoPostal: string;
    nombreDestinatario: string;
    mlShipmentId?: string;
    referencia?: string;
    barrio?: string;
  }): Promise<string> => {
    const tid = await ensureTenantId();
    const trackingNumber = `OCR-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    const { data: envio, error } = await supabase
      .from('envios')
      .insert({
        tracking_number: trackingNumber,
        direccion_entrega: data.direccion,
        ciudad_entrega: data.localidad,
        cp_entrega: data.codigoPostal,
        nombre_destinatario: data.nombreDestinatario || null,
        notas: data.referencia || null,
        estado: 'pendiente',
        precio_total: 0,
        is_manual_entry: true,
        source_module: 'bulk_ocr',
        tenant_id: tid,
        ml_shipment_id: data.mlShipmentId ? parseInt(data.mlShipmentId) : null,
        created_by: user?.id,
      })
      .select('id, tracking_number')
      .single();

    if (error) throw error;

    setPackages(prev => [...prev, {
      id: envio.id,
      tracking_number: envio.tracking_number,
      direccion: data.direccion,
      localidad: data.localidad,
      codigoPostal: data.codigoPostal,
      nombreDestinatario: data.nombreDestinatario,
    }]);

    return trackingNumber;
  }, [ensureTenantId, user?.id]);

  const handleFinish = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['envios'] });
    toast.success(`${packages.length} envío${packages.length !== 1 ? 's' : ''} creado${packages.length !== 1 ? 's' : ''} por OCR`);
    onClose();
  }, [packages.length, queryClient, onClose]);

  const removePackage = useCallback(async (id: string) => {
    await supabase.from('envios').delete().eq('id', id);
    setPackages(prev => prev.filter(p => p.id !== id));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Escaneo Masivo OCR</h1>
          <p className="text-sm text-slate-400">
            {packages.length} paquete{packages.length !== 1 ? 's' : ''} escaneado{packages.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Counter badge */}
      {packages.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-3">
          <Package className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">
            {packages.length} paquete{packages.length !== 1 ? 's' : ''} guardado{packages.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Scan button */}
      <Button
        onClick={() => setShowOCR(true)}
        className="w-full h-16 text-lg font-semibold gap-3 bg-gradient-to-br from-primary via-primary to-amber-500 hover:opacity-90 shadow-xl shadow-primary/30 mb-4"
      >
        <Camera className="h-7 w-7" />
        {packages.length === 0 ? 'TOMAR PRIMERA FOTO' : 'TOMAR SIGUIENTE FOTO'}
      </Button>

      {/* Package list */}
      {packages.length > 0 ? (
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-2">
              {packages.map((pkg, index) => (
                <div
                  key={pkg.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-sm flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-white truncate">{pkg.tracking_number}</span>
                      <Badge variant="outline" className="text-[10px] border-amber-600 text-amber-400">OCR</Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-slate-500" />
                      <span className="text-xs text-slate-400 truncate">{pkg.direccion}</span>
                    </div>
                    {pkg.nombreDestinatario && (
                      <span className="text-xs text-slate-500 truncate block">{pkg.nombreDestinatario}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePackage(pkg.id)}
                    className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-950/30 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
            <Camera className="h-10 w-10 text-slate-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">Sin paquetes</h3>
          <p className="text-sm text-slate-500 max-w-xs">
            Tomá fotos de las etiquetas de los paquetes para registrarlos masivamente.
          </p>
        </div>
      )}

      {/* Action buttons */}
      {packages.length > 0 && (
        <div className="mt-4 space-y-3">
          <Button
            onClick={handleFinish}
            className="w-full h-14 text-lg font-semibold gap-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/30"
          >
            <Navigation className="h-5 w-5" />
            LISTO · {packages.length} PAQUETE{packages.length !== 1 ? 'S' : ''}
          </Button>
        </div>
      )}

      {/* OCR Dialog in continuous mode */}
      <OCRCaptureDialog
        open={showOCR}
        onClose={() => setShowOCR(false)}
        onConfirm={handleOCRConfirm}
        continuousMode
      />
    </div>
  );
}
